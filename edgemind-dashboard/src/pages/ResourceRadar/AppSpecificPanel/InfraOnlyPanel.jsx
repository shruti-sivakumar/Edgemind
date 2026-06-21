import { useAppState } from '../../../core/store/AppContext.jsx'
import { POD_ROLES } from '../../../core/constants/pods.js'
import PvcGauge from '../../../components/ui/PvcGauge.jsx'
import TrendSparkline from '../../../components/charts/TrendSparkline.jsx'
import { findMetrics } from '../../../core/selectors/podHealth.js'

export default function InfraOnlyPanel({ podName }) {
  const { pvcs, metrics } = useAppState()
  const role = POD_ROLES[podName] || 'Infrastructure component'
  const m = findMetrics(metrics, podName)
  const isPrometheus = podName === 'prometheus'
  const promPvc = pvcs['prometheus-tsdb'] || {}

  const cpuArr = m.cpu_usage || []
  const cpu = cpuArr.length ? cpuArr[cpuArr.length - 1] : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', justifyContent: 'flex-start' }}>

      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', background: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)', boxShadow: '0 1px 3px var(--color-shadow)', borderRadius: 4, padding: '8px 10px', lineHeight: 1.5 }}>
        {role}
      </div>

      {cpu != null && (
        <div>
          <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginBottom: 4 }}>CPU trend</div>
          <TrendSparkline podName={podName} series="cpu_usage" />
        </div>
      )}

      {isPrometheus && (
        <>
          <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontWeight: 700 }}>TSDB STORAGE (PVC-3)</div>
          <PvcGauge
            pvcName="prometheus-tsdb"
            used={promPvc.used}
            capacity={promPvc.capacity}
            fillPct={promPvc.fill_pct}
            consumers={['prometheus']}
          />
        </>
      )}
    </div>
  )
}
