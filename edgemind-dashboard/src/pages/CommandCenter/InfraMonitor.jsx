import { useNavigate } from 'react-router-dom'
import PanelHeader from '../../components/ui/PanelHeader.jsx'
import PodHealthHeatmap from './PodHealthHeatmap.jsx'
import ClusterLoadMini from './ClusterLoadMini.jsx'
import StorageForecast from './StorageForecast.jsx'

// Band 3 (right) — infrastructure layer: where the pods run and what they
// consume. Pod heatmap + cluster load + storage forecast, all real data.

export default function InfraMonitor() {
  const navigate = useNavigate()
  return (
    <div style={{
      flex: 1,
      background: 'var(--color-bg-card)',
      border: '1.5px solid var(--color-border-card)',
      borderRadius: 6, padding: '10px 12px',
      display: 'flex', flexDirection: 'column', gap: 10,
      cursor: 'pointer',
    }}
      onClick={() => navigate('/radar')}
      title="Click for full resource radar"
    >
      <PanelHeader title="Infrastructure Monitoring" hint="kubernetes layer →" />
      <div style={{ display: 'flex', gap: 16, flex: 1 }}>
        {/* Left: Pod Heatmap (3x5 grid) */}
        <div style={{ flex: '1 1 0', minWidth: 0 }}>
          <PodHealthHeatmap />
        </div>
        
        {/* Right: Cluster Load (top) and Storage Forecast (bottom) */}
        <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ClusterLoadMini />
          <StorageForecast />
        </div>
      </div>
    </div>
  )
}
