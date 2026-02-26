package session

import (
	"encoding/base64"
	"fmt"
	"io"
	"os"
	"os/exec"
	"sync"
	"syscall"
	"time"

	"github.com/creack/pty"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// statusPattern defines patterns for detecting agent status from PTY output.
type statusPattern struct {
	pattern string
	status  string
}

var claudePatterns = []statusPattern{
	{`╭─`, StatusIdle},           // Claude Code prompt border start
	{`> `, StatusIdle},            // generic prompt
	{`Thinking`, StatusThinking},  // Claude thinking
	{`◓`, StatusThinking},         // Claude spinner chars
	{`◑`, StatusThinking},
	{`◒`, StatusThinking},
	{`●`, StatusThinking},
}

type ptySession struct {
	mu        sync.Mutex
	id        string
	ptmx      *os.File
	cmd       *os.File
	process   *os.Process
	lastOutput time.Time
	status    string
	persister *persister
}

func spawnPTY(s *Session, mgr *Manager) (*ptySession, error) {
	var cmdName string
	var cmdArgs []string

	switch s.Config.Agent {
	case "claude":
		cmdName = "claude"
	case "codex":
		cmdName = "codex"
	default:
		// shell
		cmdName = os.Getenv("SHELL")
		if cmdName == "" {
			cmdName = "/bin/zsh"
		}
	}

	cmd := exec.Command(cmdName, cmdArgs...)
	cmd.Dir = s.WorkDir
	cmd.Env = append(os.Environ(),
		"TERM=xterm-256color",
		fmt.Sprintf("AIM_SESSION_ID=%s", s.ID),
	)

	ptmx, err := pty.Start(cmd)
	if err != nil {
		return nil, fmt.Errorf("pty.Start: %w", err)
	}

	ps := &ptySession{
		id:        s.ID,
		ptmx:      ptmx,
		process:   cmd.Process,
		lastOutput: time.Now(),
		status:    StatusIdle,
		persister: mgr.persister,
	}

	// Start read loop
	go ps.readLoop(mgr)

	// Start waiting-detection goroutine
	go ps.waitingDetector(mgr)

	// Wait for process exit asynchronously
	go func() {
		err := cmd.Wait()
		exitCode := 0
		if err != nil {
			if exitErr, ok := err.(*exec.ExitError); ok {
				exitCode = exitErr.ExitCode()
			}
		}
		status := StatusStopped
		if exitCode != 0 {
			status = StatusErrored
		}
		mgr.updateStatus(s.ID, status)
		runtime.EventsEmit(mgr.ctx, fmt.Sprintf("session:exit:%s", s.ID), exitCode)
	}()

	return ps, nil
}

func (ps *ptySession) readLoop(mgr *Manager) {
	buf := make([]byte, 4096)
	for {
		n, err := ps.ptmx.Read(buf)
		if n > 0 {
			chunk := make([]byte, n)
			copy(chunk, buf[:n])

			// Persist scrollback
			_ = ps.persister.appendScrollback(ps.id, chunk)

			// Detect status
			ps.mu.Lock()
			ps.lastOutput = time.Now()
			ps.mu.Unlock()
			mgr.detectStatus(ps.id, chunk)

			// Emit to frontend
			encoded := base64.StdEncoding.EncodeToString(chunk)
			runtime.EventsEmit(mgr.ctx, fmt.Sprintf("session:data:%s", ps.id), encoded)
		}
		if err != nil {
			if err != io.EOF {
				// PTY closed or process died
			}
			return
		}
	}
}

// waitingDetector watches for no-output periods while not idle.
func (ps *ptySession) waitingDetector(mgr *Manager) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		// If process is gone, stop
		if ps.process == nil {
			return
		}
		if err := ps.process.Signal(syscall.Signal(0)); err != nil {
			return
		}
		ps.mu.Lock()
		timeSince := time.Since(ps.lastOutput)
		currentStatus := ps.status
		ps.mu.Unlock()

		if timeSince > 5*time.Second && currentStatus == StatusThinking {
			mgr.updateStatus(ps.id, StatusWaiting)
		}
	}
}

func (ps *ptySession) write(data string) error {
	_, err := ps.ptmx.WriteString(data)
	return err
}

func (ps *ptySession) resize(cols, rows int) error {
	return pty.Setsize(ps.ptmx, &pty.Winsize{
		Cols: uint16(cols),
		Rows: uint16(rows),
	})
}

func (ps *ptySession) kill() error {
	if ps.process != nil {
		return ps.process.Kill()
	}
	return nil
}
