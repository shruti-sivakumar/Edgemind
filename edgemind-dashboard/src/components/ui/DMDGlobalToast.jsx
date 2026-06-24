import { useState, useEffect } from 'react'
import { useAppState } from '../../core/store/AppContext.jsx'

function fmtSeconds(s) {
  if (s == null) return '—'
  if (s <= 0)   return 'now'
  if (s < 60)   return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`
}

function metricLabel(metric) {
  const MAP = {
    cpu_usage_cores:       'CPU',
    mem_rss_bytes:         'Memory RSS',
    net_tx_bytes_per_sec:  'Network TX',
    fs_io_saturation:      'I/O Saturation',
  }
  return MAP[metric] || metric
}

export default function DMDGlobalToast() {
  const { dmdForecasts } = useAppState()
  const { warnings = [], lastUpdated } = dmdForecasts ?? {}
  
  const [dismissedUntil, setDismissedUntil] = useState(null)
  
  // Reset dismissal if a completely new warning comes in (or if you want it to be manual only, skip this)
  useEffect(() => {
    if (dismissedUntil && lastUpdated && new Date(lastUpdated) > dismissedUntil) {
      setDismissedUntil(null)
    }
  }, [lastUpdated, dismissedUntil])

  // Get the most urgent warning
  const mostUrgent = [...warnings].sort(
    (a, b) => (a.predicted_breach_seconds ?? 9999) - (b.predicted_breach_seconds ?? 9999)
  )[0]

  if (!mostUrgent || dismissedUntil) return null
  
  // Only show if it's within 15 minutes (900 seconds)
  if (mostUrgent.predicted_breach_seconds > 900) return null

  const color = mostUrgent.predicted_breach_seconds <= 30 ? 'var(--color-danger)' : 
                mostUrgent.predicted_breach_seconds <= 75 ? 'var(--color-warning)' : 
                'var(--color-info)'

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 9999,
      background: 'var(--color-bg-card)',
      border: `2px solid ${color}`,
      borderLeft: `6px solid ${color}`,
      borderRadius: 8,
      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
      padding: '12px 16px',
      width: 320,
      animation: 'slideInRight 0.4s ease-out',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke={color} strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-text-primary)' }}>
            DMD EARLY WARNING
          </span>
        </div>
        <button 
          onClick={() => setDismissedUntil(new Date(Date.now() + 60000))} // Dismiss for 1 min
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-text-tertiary)', fontSize: 16, lineHeight: 1, padding: 0
          }}
          title="Dismiss for 1 minute"
        >
          &times;
        </button>
      </div>
      
      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
        <b>{mostUrgent.pod?.replace(/-[a-z0-9]+-[a-z0-9]+$/, '') ?? '—'}</b> is predicted to hit a critical <b>{metricLabel(mostUrgent.metric)}</b> breach in:
      </div>
      
      <div style={{ 
        fontSize: 18, 
        fontWeight: 800, 
        color: color,
        background: `${color}15`,
        padding: '6px 12px',
        borderRadius: 4,
        textAlign: 'center',
        marginTop: 4,
        fontVariantNumeric: 'tabular-nums'
      }}>
        {fmtSeconds(mostUrgent.predicted_breach_seconds)}
      </div>
    </div>
  )
}
