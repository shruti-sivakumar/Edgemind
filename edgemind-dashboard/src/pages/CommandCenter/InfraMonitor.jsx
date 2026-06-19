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
      <PodHealthHeatmap />
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 0', minWidth: 130 }}><ClusterLoadMini /></div>
        <div style={{ flex: '1 1 0', minWidth: 150 }}><StorageForecast /></div>
      </div>
    </div>
  )
}
