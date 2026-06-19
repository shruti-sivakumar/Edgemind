import SensorSimControl from './SensorSimControl.jsx'
import PanelHeader from '../../components/ui/PanelHeader.jsx'

const PUMPS = ['pump1', 'pump2', 'pump3']

export default function ManualFaultControls() {
  return (
    <div>
      <PanelHeader title="Manual Fault Injection" style={{ marginBottom: 10 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {PUMPS.map(pump => <SensorSimControl key={pump} pumpId={pump} />)}
      </div>
    </div>
  )
}
