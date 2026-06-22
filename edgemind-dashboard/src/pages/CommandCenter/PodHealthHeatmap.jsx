import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
  const worst = useMemo(() => classifyPods(findings), [findings])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(5, 1fr)', gap: 4, flex: 1 }}>
        {ALL_PODS.map(pod => {
          const sev = worst[pod] || 'healthy'
          const color = sev === 'healthy' ? '#81c784' : SEVERITY_COLORS[sev]
          return (
            <div
              key={pod}
              title={`${pod} — ${sev}`}
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/radar?pod=${pod}`)
              }}
              style={{
                cursor: 'pointer',
                fontSize: 10, fontWeight: 600, textAlign: 'center',
                padding: '4px 6px', borderRadius: 3,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: sev === 'healthy' ? 'var(--color-text-secondary)' : color,
                background: sev === 'healthy' ? 'rgba(129, 199, 132, 0.15)' : `${color}1a`,
                border: `1px solid ${sev === 'healthy' ? 'rgba(129, 199, 132, 0.4)' : color}`,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {pod}
            </div>
          )
        })}
      </div>
    </div>
  )
}
