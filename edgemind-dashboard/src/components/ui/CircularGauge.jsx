// Small SVG ring gauge for a 0–100 value (pump health, etc.).
// Color tiers match the health-score convention used across the app:
// >=75 green, 50–74 amber, <50 red; null -> grey "—".

export default function CircularGauge({ value, size = 52, stroke = 6, color, sublabel }) {
  const pct = value == null ? null : Math.max(0, Math.min(100, value))
  const c = color || (
    pct == null   ? 'var(--color-text-tertiary)' :
    pct >= 75     ? 'var(--color-success)' :
    pct >= 50     ? 'var(--color-warning)' :
                    'var(--color-danger)'
  )
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const dash = pct == null ? 0 : (pct / 100) * circ

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="var(--color-border-secondary)" strokeWidth={stroke}
        />
        {pct != null && (
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={c} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            style={{ transition: 'stroke-dasharray 0.5s ease' }}
          />
        )}
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: Math.round(size * 0.28), fontWeight: 700, color: c, lineHeight: 1 }}>
          {pct != null ? Math.round(pct) : '—'}
        </span>
        {sublabel && (
          <span style={{ fontSize: 8, color: 'var(--color-text-tertiary)', letterSpacing: '0.04em' }}>
            {sublabel}
          </span>
        )}
      </div>
    </div>
  )
}
