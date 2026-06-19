import { useMemo } from 'react'
import { useAppState } from '../../core/store/AppContext.jsx'
import { classifyPods, ALL_PODS } from '../../core/selectors/podHealth.js'
import { SEVERITY_COLORS } from '../../core/constants/colors.js'

// Compact per-pod health grid. One cell per monitored pod, colored by the
// worst finding severity (shared selector with the KPI strip).

const SHORT = {
  'sensor-sim-1': 'ss-1', 'sensor-sim-2': 'ss-2', 'sensor-sim-3': 'ss-3',
  'opc-ua-collector': 'opc', 'data-historian': 'hist', 'feature-extractor': 'feat',
  'batch-sync': 'batch', 'health-scorer': 'hlth', 'alert-manager': 'alert',
  'edgemind-agents': 'agts', 'edgemind-server': 'srv', 'prometheus': 'prom',
  'redis': 'redis', 'kube-state-metrics': 'ksm', 'node-exporter': 'node',
}

export default function PodHealthHeatmap() {
  const { findings } = useAppState()
  const worst = useMemo(() => classifyPods(findings), [findings])

  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-text-tertiary)', marginBottom: 5 }}>
        POD HEALTH ({ALL_PODS.length} PODS)
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
        {ALL_PODS.map(pod => {
          const sev = worst[pod] || 'healthy'
          const color = SEVERITY_COLORS[sev]
          return (
            <div
              key={pod}
              title={`${pod} — ${sev}`}
              style={{
                fontSize: 9, fontWeight: 600, textAlign: 'center',
                padding: '4px 2px', borderRadius: 3,
                color: sev === 'healthy' ? 'var(--color-text-secondary)' : color,
                background: `${color}1a`,
                border: `1px solid ${sev === 'healthy' ? 'var(--color-border-secondary)' : color}`,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {SHORT[pod] || pod}
            </div>
          )
        })}
      </div>
    </div>
  )
}
