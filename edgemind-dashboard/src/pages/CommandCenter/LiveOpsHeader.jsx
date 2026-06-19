import { useState, useEffect } from 'react'
import { useAppState } from '../../core/store/AppContext.jsx'

// Band 0 — the always-on operations header. Communicates, at a glance:
//   what the product is, that the data is live, and the system clock.
// Every signal here is real: WebSocket connectivity and agent-ready state
// come straight from the store.

function Pill({ label, color, pulse }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 9px', borderRadius: 10,
      background: `${color}1a`, border: `1px solid ${color}`,
      color, fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
      whiteSpace: 'nowrap',
    }}>
      <span
        className={pulse ? 'animate-blink' : ''}
        style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }}
      />
      {label}
    </span>
  )
}

export default function LiveOpsHeader() {
  const { ws, agentsReady } = useAppState()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const live = ws.connected

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, flexWrap: 'wrap',
      background: 'var(--color-bg-card)',
      border: '1px solid var(--color-border-card)',
      borderRadius: 6, padding: '10px 16px',
    }}>
      {/* Identity + one-line solution caption */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-danger)', letterSpacing: '-0.01em' }}>
            EdgeMind
          </span>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)' }}>
            Command Center
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 1 }}>
          Edge-native multi-agent AI — detects &amp; root-causes pod-resource anomalies across the pump-station pipeline
        </div>
      </div>

      {/* Live status pills + clock + brand badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Pill
          label={live ? 'LIVE SCANNER' : 'STREAM OFFLINE'}
          color={live ? 'var(--color-success)' : 'var(--color-text-tertiary)'}
          pulse={live}
        />
        <Pill
          label={agentsReady ? 'AGENTS READY' : 'AGENTS WARMING'}
          color={agentsReady ? 'var(--color-success)' : 'var(--color-warning)'}
          pulse={!agentsReady}
        />
        <span style={{
          fontSize: 12, fontVariantNumeric: 'tabular-nums',
          color: 'var(--color-text-secondary)', fontFamily: 'monospace',
        }}>
          {now.toLocaleString('en-GB', { hour12: false }).replace(',', ' ·')}
        </span>
        <span style={{
          padding: '2px 9px', borderRadius: 4,
          background: 'var(--color-bg-chip)', color: 'var(--color-text-secondary)',
          fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
        }}>
          ABB INDUSTRIAL AI
        </span>
      </div>
    </div>
  )
}
