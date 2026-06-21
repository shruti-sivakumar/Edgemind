import MetricTabs from '../../components/charts/MetricTabs.jsx'
import PanelHeader from '../../components/ui/PanelHeader.jsx'
import { useAppState } from '../../core/store/AppContext.jsx'
import { findMetrics } from '../../core/selectors/podHealth.js'

export default function CommonInfraPanel({ podName, isKubeSystem }) {
  const { metrics, findings } = useAppState()
  const m = findMetrics(metrics, podName)
  const restarts = m.restarts || 0
  const podFindings = findings.filter(f => f.pod === podName)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1vh' }}>
        <PanelHeader title="Infrastructure Metrics" />
        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--color-text-secondary)' }}>
          <span>Status: <span style={{ color: 'var(--color-success)' }}>Running</span></span>
          {restarts > 0 && <span>Restarts: <span style={{ color: 'var(--color-warning)' }}>{restarts}</span></span>}
          {podFindings.length > 0 && (
            <span style={{ color: 'var(--color-warning)' }}>{podFindings.length} active finding{podFindings.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
      <MetricTabs podName={podName} isKubeSystem={isKubeSystem} />
    </div>
  )
}
