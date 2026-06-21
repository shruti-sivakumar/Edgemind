import { useAppState } from '../../../core/store/AppContext.jsx'
import PvcGauge from '../../../components/ui/PvcGauge.jsx'
import TrendSparkline from '../../../components/charts/TrendSparkline.jsx'
import { findMetrics } from '../../../core/selectors/podHealth.js'

export default function BatchSyncPanel({ podName }) {
  const { pvcs, metrics } = useAppState()
  const exportPvc = pvcs['export-data'] || {}
  const m = findMetrics(metrics, podName)

  const fsReadArr = m.fs_read || []
  const fsRead = fsReadArr.length ? fsReadArr[fsReadArr.length - 1] : null

  const netTxArr = m.net_tx || []
  const netTx = netTxArr.length ? netTxArr[netTxArr.length - 1] : null

  const busy = netTx != null && netTx > 5000

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', justifyContent: 'center' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: busy ? 'var(--color-warning)' : 'var(--color-success)',
        }} />
        <span style={{ fontSize: 12, color: 'var(--color-text-primary)' }}>
          {busy ? 'Exporting Parquet…' : 'Idle'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)', boxShadow: '0 1px 3px var(--color-shadow)', borderRadius: 4, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>PVC-2 Read</div>
          <div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-primary)' }}>
            {fsRead != null ? `${(fsRead / 1024).toFixed(1)} KB/s` : '—'}
          </div>
        </div>
        <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)', boxShadow: '0 1px 3px var(--color-shadow)', borderRadius: 4, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>TX to upload</div>
          <div style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-primary)' }}>
            {netTx != null ? `${(netTx / 1024).toFixed(1)} KB/s` : '—'}
          </div>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 4 }}>TX trend</div>
        <TrendSparkline podName={podName} series="net_tx" />
      </div>

      <PvcGauge
        pvcName="export-data"
        used={exportPvc.used}
        capacity={exportPvc.capacity}
        fillPct={exportPvc.fill_pct}
        consumers={['alert-manager', 'batch-sync']}
      />
    </div>
  )
}
