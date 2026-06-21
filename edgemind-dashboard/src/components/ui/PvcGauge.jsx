function fmtBytes(b) {
  if (b == null) return '—'
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`
  if (b >= 1e6) return `${(b / 1e6).toFixed(0)} MB`
  return `${(b / 1e3).toFixed(0)} KB`
}

export default function PvcGauge({ pvcName, used, capacity, fillPct, ttfMinutes, consumers = [] }) {
  const pct = fillPct ?? (used != null && capacity ? Math.round((used / capacity) * 100) : null)
  const color = pct == null ? 'var(--color-text-tertiary)' :
                pct >= 85 ? 'var(--color-danger)' :
                pct >= 70 ? 'var(--color-warning)' : 'var(--color-success)'
  const pulse = pct != null && pct >= 85

  return (
    <div style={{
      background: 'var(--color-bg-card)',
      border: `1px solid ${pulse ? 'var(--color-danger)' : 'var(--color-border-secondary)'}`,
      borderRadius: 6,
      padding: '10px 12px',
      minWidth: 140,
      boxSizing: 'border-box',
    }}
    className={pulse ? 'animate-pulse-border' : ''}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
        <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{pvcName}</span>
        <span style={{ color }}>{pct != null ? `${pct}%` : '—'}</span>
      </div>
      <div style={{
        height: 6, borderRadius: 3, background: 'var(--color-border-secondary)', overflow: 'hidden', marginBottom: 6,
      }}>
        {pct != null && (
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.4s' }} />
        )}
      </div>
      <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>
        {fmtBytes(used)} / {fmtBytes(capacity)}
      </div>
      {ttfMinutes != null && (
        <div style={{ fontSize: 10, color: 'var(--color-warning)', marginTop: 2 }}>
          TTF: {ttfMinutes < 60 ? `${ttfMinutes}m` : `${Math.floor(ttfMinutes / 60)}h ${ttfMinutes % 60}m`}
        </div>
      )}
      {consumers.length > 0 && (
        <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
          {consumers.join(' · ')}
        </div>
      )}
    </div>
  )
}
