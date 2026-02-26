import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { WebglAddon } from '@xterm/addon-webgl'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

/** Decode a base64 string to a Uint8Array for correct UTF-8 handling in xterm.js */
function b64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

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
      // Handle OSC 8 hyperlinks (e.g. "PR #4" links from Claude Code)
      // by opening them in the system default browser via Wails
      linkHandler: {
        activate(_event: MouseEvent, text: string) {
          import('../../wailsjs/runtime/runtime')
            .then(({ BrowserOpenURL }) => BrowserOpenURL(text))
            .catch(() => { window.open(text, '_blank') })
        },
      },
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
    // Open links in the system default browser via Wails runtime
    const webLinks = new WebLinksAddon((event, uri) => {
      if (event.metaKey || event.ctrlKey) {
        import('../../wailsjs/runtime/runtime')
          .then(({ BrowserOpenURL }) => BrowserOpenURL(uri))
          .catch(() => { window.open(uri, '_blank') })
      }
    })

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

    // Send initial size to backend so the PTY columns/rows are correct from the start
    const { cols, rows } = term
    import('../../wailsjs/go/session/Manager')
      .then(({ ResizeSession }) => ResizeSession(sessionId, cols, rows))
      .catch(() => {})

    // Load scrollback from backend (returned as base64 to preserve raw PTY bytes)
    import('../../wailsjs/go/session/Manager')
      .then(({ GetSessionLog }) => GetSessionLog(sessionId))
      .then((log: string) => {
        if (log) {
          term.write(b64ToBytes(log))
        }
      })
      .catch(() => {})

    // Subscribe to PTY output events
    // Must decode base64 → Uint8Array (not a JS string) so xterm.js handles
    // multi-byte UTF-8 sequences correctly instead of treating each byte as a
    // separate Unicode codepoint (which produces mojibake like â³, Â·, etc.)
    const onData = (encoded: unknown) => {
      if (typeof encoded === 'string') {
        term.write(b64ToBytes(encoded))
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
