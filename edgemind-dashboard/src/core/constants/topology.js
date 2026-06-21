// Fixed layered DAG layout — positions never change at runtime.
// Column spacing: 130px, row spacing: 70px, origin: (40, 40)
// PVC row sits below the main chain at y=320.

const COL = 130
const ROW = 70
const OX = 40
const OY = 40

export const LAYERS = [
  ['sensor-sim-1', 'sensor-sim-2', 'sensor-sim-3'],  // col 0
  ['opc-ua-collector'],                               // col 1
  ['data-historian'],                                 // col 2
  ['feature-extractor', 'batch-sync'],                // col 3
  ['health-scorer'],                                  // col 4
  ['alert-manager'],                                  // col 5
]

export const MONITORING_LAYER = [
  'edgemind-agents',
  'edgemind-server',
  'prometheus',
  'redis',
  'kube-state-metrics',
  'node-exporter',
]

export const PVC_NODES = [
  { id: 'pvc-historian-data',    label: 'PVC-1', sublabel: 'historian-data',   col: 3 },
  { id: 'pvc-export-data',       label: 'PVC-2', sublabel: 'export-data',      col: 4.5 },
  { id: 'pvc-prometheus-tsdb',   label: 'PVC-3', sublabel: 'prometheus-tsdb',  col: 6.4 },
]

// Compute static (x, y) for each pod
function buildPositions() {
  const pos = {}
  const PVC_Y = OY + 3 * ROW // 250
  
  LAYERS.forEach((layer, colIdx) => {
    const totalRows = layer.length
    layer.forEach((pod, rowIdx) => {
      let x = OX + colIdx * COL
      let y = OY + rowIdx * ROW - ((totalRows - 1) * ROW) / 2 + ROW
      
      if (colIdx === 3) {
        if (pod === 'feature-extractor') {
          y = OY + ROW // 110
        } else if (pod === 'batch-sync') {
          y = PVC_Y // 250
        }
      }
      
      pos[pod] = { x, y }
    })
  })
  const MON_Y = OY + 3.8 * ROW
  MONITORING_LAYER.forEach((pod, i) => {
    pos[pod] = { x: OX + i * COL, y: MON_Y }
  })
  
  // PVC row below main chain
  PVC_NODES.forEach(pvc => {
    if (pvc.id === 'pvc-prometheus-tsdb') {
      // Place directly below Prometheus (which is index 2 in MONITORING_LAYER)
      pos[pvc.id] = { x: OX + 2 * COL, y: MON_Y + 75 }
    } else if (pvc.id === 'pvc-historian-data') {
      // User requested PVC-1 to take the old batch-sync spot (top row), but moved higher
      pos[pvc.id] = { x: OX + pvc.col * COL, y: OY - 30 }
    } else {
      pos[pvc.id] = { x: OX + pvc.col * COL, y: PVC_Y }
    }
  })
  return pos
}

export const NODE_POSITIONS = buildPositions()

// Pipeline service edges (solid)
export const SERVICE_EDGES = [
  { from: 'sensor-sim-1',    to: 'opc-ua-collector' },
  { from: 'sensor-sim-2',    to: 'opc-ua-collector' },
  { from: 'sensor-sim-3',    to: 'opc-ua-collector' },
  { from: 'opc-ua-collector',to: 'data-historian' },
  { from: 'data-historian',  to: 'feature-extractor' },
  { from: 'feature-extractor',to: 'health-scorer' },
  { from: 'feature-extractor',to: 'batch-sync', noArrow: true },
  { from: 'health-scorer',   to: 'alert-manager' },
  { from: 'batch-sync',      to: 'alert-manager' },
]

// Shared data / PVC edges (dashed)
export const DATA_EDGES = [
  { from: 'data-historian',    to: 'pvc-historian-data' },
  { from: 'feature-extractor', to: 'pvc-historian-data' },
  { from: 'health-scorer',     to: 'pvc-historian-data' },
  { from: 'alert-manager',     to: 'pvc-export-data' },
  { from: 'batch-sync',        to: 'pvc-export-data' },
  { from: 'prometheus',        to: 'pvc-prometheus-tsdb' },
]

// Upstream / downstream adjacency (for NodeDetailDrawer)
export const UPSTREAM = {}
export const DOWNSTREAM = {}
SERVICE_EDGES.forEach(({ from, to }) => {
  if (!DOWNSTREAM[from]) DOWNSTREAM[from] = []
  if (!UPSTREAM[to]) UPSTREAM[to] = []
  DOWNSTREAM[from].push(to)
  UPSTREAM[to].push(from)
})

// Role accent colors for left-edge stripe on each pod node
export const ROLE_COLORS = {
  'sensor-sim-1':     'var(--color-info)',
  'sensor-sim-2':     'var(--color-info)',
  'sensor-sim-3':     'var(--color-info)',
  'opc-ua-collector': '#8b5cf6',
  'data-historian':   '#06b6d4',
  'feature-extractor':'#f97316',
  'batch-sync':       '#10b981',
  'mock-upload':      '#10b981',
  'health-scorer':    'var(--color-warning)',
  'alert-manager':    'var(--color-danger)',
  'edgemind-agents':  'var(--color-text-tertiary)',
  'edgemind-server':  'var(--color-text-tertiary)',
  'prometheus':       'var(--color-text-tertiary)',
  'redis':            'var(--color-text-tertiary)',
  'kube-state-metrics':'var(--color-text-tertiary)',
  'node-exporter':    'var(--color-text-tertiary)',
}

// Total SVG canvas size
export const CANVAS_WIDTH  = 40 + LAYERS.length * COL + 80
export const CANVAS_HEIGHT = OY + 4 * ROW + 100
