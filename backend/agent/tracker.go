package agent

import (
	"context"
	"sync"
	"time"

	"github.com/Benbentwo/aim/backend/session"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	sampleInterval = 10 * time.Second
	maxHistory     = 180 // 30 minutes of 10s samples
	stuckThreshold = 60  // seconds in waiting before considered stuck
)

// SessionMetrics holds computed metrics for a single session.
type SessionMetrics struct {
	SessionID    string `json:"sessionId"`
	SessionName  string `json:"sessionName"`
	Agent        string `json:"agent"`
	Status       string `json:"status"`
	ThinkingTime int64  `json:"thinkingTime"` // cumulative seconds
	WaitingTime  int64  `json:"waitingTime"`
	IdleTime     int64  `json:"idleTime"`
	TotalTime    int64  `json:"totalTime"`
	LastActivity string `json:"lastActivity"`
	IsStuck      bool   `json:"isStuck"`
}

// MetricSnapshot is a point-in-time aggregate.
type MetricSnapshot struct {
	Timestamp     string `json:"timestamp"`
	ActiveCount   int    `json:"activeCount"`
	ThinkingCount int    `json:"thinkingCount"`
	WaitingCount  int    `json:"waitingCount"`
	IdleCount     int    `json:"idleCount"`
}

// DashboardData is the full payload returned to the frontend.
type DashboardData struct {
	Sessions    []SessionMetrics `json:"sessions"`
	History     []MetricSnapshot `json:"history"`
	StuckAgents []SessionMetrics `json:"stuckAgents"`
}

// Tracker monitors session activity and computes metrics.
type Tracker struct {
	ctx            context.Context
	mu             sync.RWMutex
	sessionManager *session.Manager
	metrics        map[string]*SessionMetrics
	history        []MetricSnapshot
	lastStatuses   map[string]string
	lastSample     time.Time
	stopCh         chan struct{}
	running        bool
}

// NewTracker creates a new Tracker.
func NewTracker(sm *session.Manager) *Tracker {
	return &Tracker{
		sessionManager: sm,
		metrics:        make(map[string]*SessionMetrics),
		lastStatuses:   make(map[string]string),
	}
}

// SetContext sets the Wails context and starts sampling.
func (t *Tracker) SetContext(ctx context.Context) {
	t.ctx = ctx
	t.startSampling()
}

func (t *Tracker) startSampling() {
	t.mu.Lock()
	if t.running {
		t.mu.Unlock()
		return
	}
	t.stopCh = make(chan struct{})
	t.running = true
	t.mu.Unlock()

	go func() {
		ticker := time.NewTicker(sampleInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				t.sample()
			case <-t.stopCh:
				return
			}
		}
	}()
}

func (t *Tracker) sample() {
	sessions := t.sessionManager.ListSessions()
	now := time.Now()

	t.mu.Lock()
	defer t.mu.Unlock()

	elapsed := int64(sampleInterval.Seconds())
	if !t.lastSample.IsZero() {
		elapsed = int64(now.Sub(t.lastSample).Seconds())
	}
	t.lastSample = now

	var thinkingCount, waitingCount, idleCount, activeCount int

	for _, s := range sessions {
		m, exists := t.metrics[s.ID]
		if !exists {
			m = &SessionMetrics{
				SessionID:   s.ID,
				SessionName: s.Name,
				Agent:       s.Agent,
			}
			t.metrics[s.ID] = m
		}

		m.Status = s.Status
		m.SessionName = s.Name
		m.Agent = s.Agent

		switch s.Status {
		case "thinking":
			m.ThinkingTime += elapsed
			thinkingCount++
			activeCount++
			m.LastActivity = now.Format(time.RFC3339)
		case "waiting":
			m.WaitingTime += elapsed
			waitingCount++
			activeCount++
		case "idle":
			m.IdleTime += elapsed
			idleCount++
			activeCount++
			m.LastActivity = now.Format(time.RFC3339)
		}

		if s.Status != "stopped" && s.Status != "errored" {
			m.TotalTime += elapsed
		}

		// Stuck detection: waiting for > threshold
		m.IsStuck = false
		if s.Status == "waiting" {
			prev := t.lastStatuses[s.ID]
			if prev == "waiting" {
				m.WaitingTime += 0 // already counted above
				if m.WaitingTime > int64(stuckThreshold) {
					m.IsStuck = true
				}
			}
		}

		t.lastStatuses[s.ID] = s.Status
	}

	// Remove metrics for sessions that no longer exist
	sessionIDs := make(map[string]bool)
	for _, s := range sessions {
		sessionIDs[s.ID] = true
	}
	for id := range t.metrics {
		if !sessionIDs[id] {
			delete(t.metrics, id)
			delete(t.lastStatuses, id)
		}
	}

	// Record snapshot
	snapshot := MetricSnapshot{
		Timestamp:     now.Format(time.RFC3339),
		ActiveCount:   activeCount,
		ThinkingCount: thinkingCount,
		WaitingCount:  waitingCount,
		IdleCount:     idleCount,
	}
	t.history = append(t.history, snapshot)
	if len(t.history) > maxHistory {
		t.history = t.history[len(t.history)-maxHistory:]
	}

	// Emit event
	if t.ctx != nil {
		data := t.buildDashboardDataLocked()
		runtime.EventsEmit(t.ctx, "agent:metrics:updated", data)
	}
}

func (t *Tracker) buildDashboardDataLocked() DashboardData {
	sessions := make([]SessionMetrics, 0, len(t.metrics))
	stuck := make([]SessionMetrics, 0)
	for _, m := range t.metrics {
		sessions = append(sessions, *m)
		if m.IsStuck {
			stuck = append(stuck, *m)
		}
	}
	history := make([]MetricSnapshot, len(t.history))
	copy(history, t.history)
	return DashboardData{
		Sessions:    sessions,
		History:     history,
		StuckAgents: stuck,
	}
}

// GetDashboardData returns the current dashboard data.
func (t *Tracker) GetDashboardData() DashboardData {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return t.buildDashboardDataLocked()
}

// Shutdown stops the sampling goroutine.
func (t *Tracker) Shutdown() {
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.running {
		close(t.stopCh)
		t.running = false
	}
}
