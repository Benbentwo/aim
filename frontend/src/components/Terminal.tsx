import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { WebglAddon } from '@xterm/addon-webgl'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

declare const window: Window & {
  runtime?: {
    EventsOn: (event: string, callback: (...args: unknown[]) => void) => void
    EventsOff: (event: string) => void
  }
}

interface TerminalProps {
  sessionId: string
}

export default function Terminal({ sessionId }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerm | null>(null)
  const fitRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: 'MesloLGS NF, Menlo, Consolas, "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.2,
      theme: {
        background: '#0f1117',
        foreground: '#e2e8f0',
        cursor: '#7c85f3',
        selectionBackground: '#3d4166',
        black: '#1a1e2e',
        brightBlack: '#414868',
        red: '#f7768e',
        brightRed: '#f7768e',
        green: '#9ece6a',
        brightGreen: '#9ece6a',
        yellow: '#e0af68',
        brightYellow: '#ff9e64',
        blue: '#7aa2f7',
        brightBlue: '#7aa2f7',
        magenta: '#bb9af7',
        brightMagenta: '#bb9af7',
        cyan: '#7dcfff',
        brightCyan: '#7dcfff',
        white: '#a9b1d6',
        brightWhite: '#c0caf5',
      },
    })

    const fit = new FitAddon()
    const webgl = new WebglAddon()
    const webLinks = new WebLinksAddon()

    term.loadAddon(fit)
    term.loadAddon(webLinks)
    term.open(containerRef.current)

    // WebGL may fail in some envs, fall back gracefully
    try {
      term.loadAddon(webgl)
    } catch {
      // Canvas fallback is used automatically
    }

    fit.fit()
    termRef.current = term
    fitRef.current = fit

    // Load scrollback from backend
    import('../../wailsjs/go/session/Manager')
      .then(({ GetSessionLog }) => GetSessionLog(sessionId))
      .then((log: string) => {
        if (log) {
          term.write(log)
        }
      })
      .catch(() => {})

    // Subscribe to PTY output events
    const onData = (encoded: unknown) => {
      if (typeof encoded === 'string') {
        const bytes = atob(encoded)
        term.write(bytes)
      }
    }

    window.runtime?.EventsOn(`session:data:${sessionId}`, onData)

    // Forward keystrokes to backend
    const disposeInput = term.onData((data) => {
      import('../../wailsjs/go/session/Manager')
        .then(({ WriteToSession }) => WriteToSession(sessionId, data))
        .catch(() => {})
    })

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fit.fit()
      const { cols, rows } = term
      import('../../wailsjs/go/session/Manager')
        .then(({ ResizeSession }) => ResizeSession(sessionId, cols, rows))
        .catch(() => {})
    })
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => {
      window.runtime?.EventsOff(`session:data:${sessionId}`)
      disposeInput.dispose()
      resizeObserver.disconnect()
      webgl.dispose()
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
  }, [sessionId])

  return (
    <div
      ref={containerRef}
      className="w-full h-full p-1"
      style={{ background: '#0f1117' }}
    />
  )
}
