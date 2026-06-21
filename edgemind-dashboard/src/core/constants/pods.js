export const NAMESPACES = ['pump-station', 'monitoring', 'kube-system']

export const POD_ROLES = {
  'sensor-sim-1':         'OPC-UA pump simulator — emits telemetry for Pump 1',
  'sensor-sim-2':         'OPC-UA pump simulator — emits telemetry for Pump 2',
  'sensor-sim-3':         'OPC-UA pump simulator — emits telemetry for Pump 3',
  'opc-ua-collector':     'Subscribes to all three sensor-sims and writes batched telemetry to InfluxDB',
  'data-historian':       'InfluxDB time-series database — stores pump telemetry, features, and health scores',
  'feature-extractor':    'Queries InfluxDB every 10 s and computes bearing health, vibration trends, and statistical features per pump',
  'health-scorer':        'Classifies each pump as HEALTHY / WARNING / CRITICAL based on feature thresholds',
  'alert-manager':        'Enriches health-scorer output with context and persists alerts to PVC-2 JSONL',
  'batch-sync':           'Exports fault-episode Parquet files to PVC-2 and mocks upload to cloud on trigger',
  'mock-upload':          'Simulates a cloud upload endpoint — counts received files',
  'edgemind-agents':      'Hosts the four EdgeMind anomaly-detection agents: CPU, Memory, Storage, Network/Log',
  'edgemind-server':      'AI orchestrator — correlates agent findings with Claude and streams results via WebSocket',
  'prometheus':           'Scrapes Kubernetes node + container metrics; does NOT instrument application pods',
  'redis':                'Message broker between EdgeMind agents and the orchestrator server',
  'kube-state-metrics':   'Exposes Kubernetes object state (pod counts, resource limits) as Prometheus metrics',
  'node-exporter':        'Exposes Linux host-level metrics (CPU, memory, disk) as Prometheus metrics',
}

export const PUMP_STATION_PODS = [
  'sensor-sim-1',
  'sensor-sim-2',
  'sensor-sim-3',
  'opc-ua-collector',
  'data-historian',
  'feature-extractor',
  'health-scorer',
  'alert-manager',
  'batch-sync',
  'mock-upload',
]

export const MONITORING_PODS = [
  'edgemind-agents',
  'edgemind-server',
  'prometheus',
  'redis',
  'kube-state-metrics',
  'node-exporter',
]

export const KUBE_SYSTEM_PODS = [
  'coredns',
  'local-path-provisioner',
  'metrics-server',
]

export const INFO_ONLY_PODS = new Set([
  'mock-upload',
  'kube-state-metrics',
  'node-exporter',
])

export const SENSOR_SIM_PODS = ['sensor-sim-1', 'sensor-sim-2', 'sensor-sim-3']

export const POD_NAMESPACES = {
  ...Object.fromEntries(PUMP_STATION_PODS.map(p => [p, 'pump-station'])),
  ...Object.fromEntries(MONITORING_PODS.map(p => [p, 'monitoring'])),
  ...Object.fromEntries(KUBE_SYSTEM_PODS.map(p => [p, 'kube-system'])),
}

export const POD_TO_PUMP = {
  'sensor-sim-1': 'pump1',
  'sensor-sim-2': 'pump2',
  'sensor-sim-3': 'pump3',
}

export const PUMP_TO_SENSOR = {
  pump1: 'sensor-sim-1',
  pump2: 'sensor-sim-2',
  pump3: 'sensor-sim-3',
}

export const SENSOR_PORTS = {
  'sensor-sim-1': '/sensor1',
  'sensor-sim-2': '/sensor2',
  'sensor-sim-3': '/sensor3',
}
