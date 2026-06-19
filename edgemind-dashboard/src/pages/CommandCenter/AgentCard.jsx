import { AGENT_COLORS } from '../../core/constants/colors.js'
import SeverityBadge from '../../components/ui/SeverityBadge.jsx'

// One EdgeMind detection agent. Liveness comes from heartbeats; the headline
// comes from the agent's most recent finding (or a nominal state).

function relTime(ts) {
  if (!ts) return ''
  const diff = Math.round((Date.now() - new Date(ts)) / 1000)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  return `${Math.floor(diff / 3600)}h`
}

export default function AgentCard({ agent, label, alive, latest, activeCount }) {
  const color = AGENT_COLORS[agent] || 'var(--color-text-tertiary)'
  const dotColor = alive ? 'var(--color-success)' : 'var(--color-text-tertiary)'

  return (
    <div style={{
      flex: '1 1 0', minWidth: 0,
      background: 'var(--color-bg-card)',
      border: '1px solid var(--color-border-secondary)',
      borderTop: `3px solid ${color}`,
      borderRadius: 6, padding: '8px 10px',
      display: 'flex', flexDirection: 'column', gap: 5,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-primary)' }}>{label}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {activeCount > 0 && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '0 5px', borderRadius: 8,
              background: 'var(--color-danger-tint)', color: 'var(--color-danger)',
            }}>{activeCount}</span>
          )}
          <span
            className={alive ? '' : ''}
            style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor }}
            title={alive ? 'alive' : 'no heartbeat'}
          />
        </span>
      </div>

      {latest ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <SeverityBadge severity={latest.severity} />
            <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>{relTime(latest.timestamp)} ago</span>
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
            <strong style={{ color: 'var(--color-text-primary)' }}>{latest.anomaly_type || 'anomaly'}</strong>
            {latest.pod ? <> on {latest.pod}</> : null}
          </div>
        </>
      ) : (
        <div style={{ fontSize: 10.5, color: alive ? 'var(--color-success)' : 'var(--color-text-tertiary)' }}>
          {alive ? 'Nominal — no anomalies' : 'Awaiting heartbeat…'}
        </div>
      )}
    </div>
  )
}
