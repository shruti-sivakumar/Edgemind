import { useMemo } from 'react'
import { useAppState } from '../../core/store/AppContext.jsx'

// Cluster load built only from data we actually have: per-pod metrics summed
// across the fleet, plus live data-plane connectivity. (The backend does not
// expose node/API-server metrics, so we surface real aggregates instead.)

function lastVal(arr) {
  if (!Array.isArray(arr)) return null
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i]
  return null
}

function Row({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '1px 0' }}>
      <span style={{ color: 'var(--color-text-tertiary)' }}>{label}</span>
      <span style={{ color: color || 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}

function ConnPill({ label, ok }) {
  const color = ok ? 'var(--color-success)' : 'var(--color-danger)'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 8,
      background: `${color}1a`, color, border: `1px solid ${color}`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />
      {label}
    </span>
  )
}

export default function ClusterLoadMini() {
  const { metrics, ws, agentsReady } = useAppState()

  const { cores, memGb, reporting } = useMemo(() => {
    let cores = 0, memBytes = 0, reporting = 0
    Object.values(metrics).forEach(m => {
      const cpu = lastVal(m.cpu_usage)
      const mem = lastVal(m.mem_working_set)
      if (cpu != null) cores += cpu
      if (mem != null) memBytes += mem
      reporting++
    })
    return { cores, memGb: memBytes / 1e9, reporting }
  }, [metrics])

  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-text-tertiary)', marginBottom: 5 }}>
        CLUSTER LOAD
      </div>
      <Row label="Aggregate CPU" value={reporting ? `${cores.toFixed(2)} cores` : '—'} />
      <Row label="Aggregate memory" value={reporting ? `${memGb.toFixed(2)} GB` : '—'} />
      <Row label="Pods reporting" value={`${reporting}`} />
      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
        <ConnPill label="STREAM" ok={ws.connected} />
        <ConnPill label="AGENTS" ok={agentsReady} />
      </div>
    </div>
  )
}
