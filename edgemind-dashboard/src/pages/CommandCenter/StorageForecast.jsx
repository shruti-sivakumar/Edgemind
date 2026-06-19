import { useAppState } from '../../core/store/AppContext.jsx'

// Storage forecast — fully real. PVC fill % from kubelet volume stats; fill
// rate and est-time-to-full derived in the reducer from 15s metric deltas.

function fmtMin(min) {
  if (min == null) return '—'
  if (min <= 0) return 'full'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function PvcRow({ label, pvc }) {
  const pct = pvc?.fill_pct
  const color = pct == null ? 'var(--color-text-tertiary)'
    : pct >= 85 ? 'var(--color-danger)'
    : pct >= 70 ? 'var(--color-warning)'
    : 'var(--color-success)'
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginBottom: 3 }}>
        <span style={{ color: 'var(--color-text-tertiary)' }}>{label}</span>
        <span style={{ color, fontVariantNumeric: 'tabular-nums' }}>{pct != null ? `${pct}%` : '—'}</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: 'var(--color-border-secondary)', overflow: 'hidden' }}>
        {pct != null && (
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.4s' }} />
        )}
      </div>
    </div>
  )
}

export default function StorageForecast() {
  const { pvcs, forecasts } = useAppState()

  const ratePerMin = forecasts.pvc2_fill_rate_bytes_per_min
  const ratePerHr = ratePerMin != null ? (ratePerMin * 60) / 1e6 : null  // MB/hr

  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-text-tertiary)', marginBottom: 5 }}>
        STORAGE FORECAST
      </div>
      <PvcRow label="PVC-1 historian-data" pvc={pvcs['historian-data']} />
      <PvcRow label="PVC-2 export-data" pvc={pvcs['export-data']} />
      <div style={{
        display: 'flex', justifyContent: 'space-between', fontSize: 10,
        marginTop: 4, paddingTop: 4, borderTop: '1px solid var(--color-border-secondary)',
        color: 'var(--color-text-tertiary)',
      }}>
        <span>Growth <b style={{ color: 'var(--color-text-secondary)' }}>{ratePerHr != null ? `+${ratePerHr.toFixed(1)} MB/hr` : '—'}</b></span>
        <span>Est. full <b style={{ color: forecasts.pvc2_ttf_minutes != null && forecasts.pvc2_ttf_minutes <= 120 ? 'var(--color-warning)' : 'var(--color-text-secondary)' }}>{fmtMin(forecasts.pvc2_ttf_minutes)}</b></span>
      </div>
    </div>
  )
}
