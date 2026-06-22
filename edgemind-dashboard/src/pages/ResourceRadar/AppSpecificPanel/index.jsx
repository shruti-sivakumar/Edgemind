import PanelHeader from '../../../components/ui/PanelHeader.jsx'
import SensorSimPanel from './SensorSimPanel.jsx'
import CollectorPanel from './CollectorPanel.jsx'
import HistorianPanel from './HistorianPanel.jsx'
import FeatureExtractorPanel from './FeatureExtractorPanel.jsx'
import HealthScorerPanel from './HealthScorerPanel.jsx'
import AlertManagerPanel from './AlertManagerPanel.jsx'
import BatchSyncPanel from './BatchSyncPanel.jsx'
import MockUploadPanel from './MockUploadPanel.jsx'
import EdgeMindAgentsPanel from './EdgeMindAgentsPanel.jsx'
import EdgeMindServerPanel from './EdgeMindServerPanel.jsx'
import InfraOnlyPanel from './InfraOnlyPanel.jsx'

const PANEL_MAP = {
  'sensor-sim-1':   SensorSimPanel,
  'sensor-sim-2':   SensorSimPanel,
  'sensor-sim-3':   SensorSimPanel,
  'opc-ua-collector':  CollectorPanel,
  'data-historian':    HistorianPanel,
  'feature-extractor': FeatureExtractorPanel,
  'health-scorer':     HealthScorerPanel,
  'alert-manager':     AlertManagerPanel,
  'batch-sync':        BatchSyncPanel,
  'mock-upload':       MockUploadPanel,
  'edgemind-agents':   EdgeMindAgentsPanel,
  'edgemind-server':   EdgeMindServerPanel,
}

const HINTS = {
  'opc-ua-collector': 'COLLECTION STATS',
  'data-historian': 'STORAGE',
  'feature-extractor': 'BEARING HEALTH',
  'health-scorer': 'HEALTH SCORES',
  'alert-manager': 'ACTIVE ALERTS',
  'batch-sync': 'EXPORT BATCH',
  'mock-upload': 'CLOUD SINK',
  'edgemind-agents': 'AGENT STATUS',
  'edgemind-server': 'ORCHESTRATOR',
  'prometheus': 'METRICS SCRAPER',
  'redis': 'MESSAGE BROKER',
  'kube-state-metrics': 'K8S STATE',
  'node-exporter': 'HOST METRICS'
}

export default function AppSpecificPanel({ podName }) {
  const Panel = PANEL_MAP[podName] || InfraOnlyPanel
  const hint = HINTS[podName]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ marginBottom: '1vh', flexShrink: 0 }}>
        <PanelHeader title="Pod Output" hint={hint} />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Panel podName={podName} />
      </div>
    </div>
  )
}
