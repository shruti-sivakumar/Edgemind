import PvcFillRow from './PvcFillRow.jsx'
import PodCard from './PodCard.jsx'
import FaultInjectionControls from './FaultInjectionControls.jsx'
import { PUMP_STATION_PODS, MONITORING_PODS, KUBE_SYSTEM_PODS } from '../../core/constants/pods.js'
import PanelHeader from '../../components/ui/PanelHeader.jsx'

const NAMESPACE_GROUPS = [
  { ns: 'pump-station', pods: PUMP_STATION_PODS },
  { ns: 'monitoring',   pods: MONITORING_PODS },
  { ns: 'kube-system',  pods: KUBE_SYSTEM_PODS },
]

export default function OverviewGrid({ onSelectPod, nsFilter = 'pump-station', selectedPod }) {
  const groups = NAMESPACE_GROUPS.filter(g => g.ns === nsFilter)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', marginBottom: '1.5vh', gap: '1vw', flexShrink: 0 }}>
        <PvcFillRow />
        {selectedPod && selectedPod.startsWith('sensor-sim-') && (
          <FaultInjectionControls selectedPod={selectedPod} />
        )}
      </div>
      {groups.map(({ ns, pods }) => (
        <div key={ns} style={{ marginBottom: '2vh', display: 'flex', flexDirection: 'column', minHeight: 0, flexShrink: 1 }}>
          <div style={{ paddingBottom: '0.5vh', marginBottom: '1vh', borderBottom: '1px solid var(--color-border-card)', flexShrink: 0 }}>
            <PanelHeader title={ns} />
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'nowrap',
            gap: '0.8vw',
            width: '100%',
            justifyContent: 'center',
            minHeight: 0,
            flexShrink: 1,
          }}>
            {pods.map(pod => (
              <div key={pod} style={{ width: 'calc((100% - 9 * 0.8vw) / 10)', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <PodCard podName={pod} onClick={onSelectPod} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
