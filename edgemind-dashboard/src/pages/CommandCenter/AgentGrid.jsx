import { useMemo } from 'react'
import { useAppState } from '../../core/store/AppContext.jsx'
import PanelHeader from '../../components/ui/PanelHeader.jsx'
import SeverityBadge from '../../components/ui/SeverityBadge.jsx'
import { AGENT_COLORS } from '../../core/constants/colors.js'

function relTime(ts) {
  if (!ts) return ''
  const diff = Math.round((Date.now() - new Date(ts)) / 1000)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  return `${Math.floor(diff / 3600)}h`
}

const AGENTS = [
  { id: 'cpu',         label: 'CPU Agent' },
  { id: 'memory',      label: 'Memory Agent' },
  { id: 'storage',     label: 'Storage Agent' },
  { id: 'network_log', label: 'Network / Log Agent' },
]

export default function AgentGrid() {
  const { findings, agentHeartbeats, dmdForecasts } = useAppState()

  const byAgent = useMemo(() => {
    const map = {}
    AGENTS.forEach(a => { map[a.id] = { latest: null, activeCount: 0 } })
    const sorted = [...findings].sort((x, y) => new Date(y.timestamp) - new Date(x.timestamp))
    const cutoff = Date.now() - 10 * 60 * 1000
    sorted.forEach(f => {
      const slot = map[f.agent]
      if (!slot) return
      if (!slot.latest) slot.latest = f
      const recent = f.timestamp && new Date(f.timestamp).getTime() >= cutoff
      if (recent && (f.severity === 'critical' || f.severity === 'warning')) slot.activeCount++
    })
    return map
  }, [findings])

  const dmdAlive = agentHeartbeats['dmd'] != null
  const dmdWarnCount = (dmdForecasts?.warnings ?? []).length
  const dmdInstCount = (dmdForecasts?.instabilities ?? []).length
  const dmdActiveCount = dmdWarnCount + dmdInstCount
  const dmdLastUpdated = dmdForecasts?.lastUpdated

  return (
    <div style={{
      flex: 1,
      background: 'var(--color-bg-card)',
      border: '1.5px solid var(--color-border-card)',
      borderRadius: 6, padding: '10px 12px',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <PanelHeader title="Multi-Agent Intelligence Grid" hint="cognitive agent telemetry" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        {AGENTS.map(a => {
          const alive = agentHeartbeats[a.id] != null
          const latest = byAgent[a.id].latest
          const activeCount = byAgent[a.id].activeCount
          const color = AGENT_COLORS[a.id] || 'var(--color-text-tertiary)'
          const dotColor = alive ? 'var(--color-success)' : 'var(--color-text-tertiary)'

          return (
            <div key={a.id} style={{ display: 'flex', gap: 12, flex: 1 }}>
              {/* Left Square / Box */}
              <div style={{ 
                width: 180, flexShrink: 0,
                background: 'var(--color-bg-card)', border: '1px solid var(--color-border-secondary)',
                borderTop: `3px solid ${color}`, borderRadius: 6, padding: '12px 10px',
                display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center'
              }}>
                 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                   <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.3 }}>{a.label}</span>
                   <span style={{ width: 8, height: 8, flexShrink: 0, borderRadius: '50%', background: dotColor }} title={alive ? 'alive' : 'no heartbeat'} />
                 </div>
                 {activeCount > 0 && (
                   <div style={{ marginTop: 6 }}>
                     <span style={{
                       fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 8,
                       background: 'var(--color-danger-tint)', color: 'var(--color-danger)',
                     }}>{activeCount} active</span>
                   </div>
                 )}
              </div>

              {/* Right Rectangle */}
              <div style={{ 
                flex: 1, minWidth: 0,
                background: 'var(--color-bg-card)', border: '1px solid var(--color-border-secondary)',
                borderRadius: 6, padding: '8px 12px',
                display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6
              }}>
                {latest ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <SeverityBadge severity={latest.severity} />
                      <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>{relTime(latest.timestamp)} ago</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      <strong style={{ color: 'var(--color-text-primary)' }}>{latest.anomaly_type || 'anomaly'}</strong>
                      {latest.pod ? <> on {latest.pod}</> : null}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: alive ? 'var(--color-success)' : 'var(--color-text-tertiary)' }}>
                    {alive ? 'Nominal — no anomalies detected recently.' : 'Awaiting heartbeat…'}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* DMD agent — separate row, advisory forecaster */}
      <div style={{
        borderTop: '1px solid var(--color-border-secondary)',
        paddingTop: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        {/* Status dot */}
        <span style={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          background: dmdAlive ? 'var(--color-success)' : 'var(--color-text-tertiary)',
          display: 'inline-block',
        }} />

        {/* DMD badge */}
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '2px 5px',
          borderRadius: 3,
          background: 'rgba(255,190,0,0.12)',
          color: 'var(--color-warning)',
          letterSpacing: '0.04em',
        }}>DMD</span>

        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600 }}>
          Forecast Engine
        </span>
        <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>
          multivariate eigenstructure
        </span>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          {dmdActiveCount > 0 ? (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '2px 6px',
              borderRadius: 3,
              background: dmdInstCount > 0 ? 'rgba(255,0,15,0.1)' : 'rgba(255,190,0,0.1)',
              color: dmdInstCount > 0 ? 'var(--color-danger)' : 'var(--color-warning)',
            }}>
              {dmdActiveCount} active
            </span>
          ) : (
            <span style={{ fontSize: 9, color: 'var(--color-text-tertiary)' }}>no warnings</span>
          )}
          {dmdLastUpdated && (
            <span style={{ fontSize: 9, color: 'var(--color-text-tertiary)' }}>
              {new Date(dmdLastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
