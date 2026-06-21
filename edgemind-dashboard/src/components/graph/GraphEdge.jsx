import { SEVERITY_COLORS } from '../../core/constants/colors.js'

const HEALTH_EDGE_COLORS = {
  critical: 'rgba(204, 0, 12, 0.90)',
  warning:  'rgba(184, 148, 0, 0.85)',
  healthy:  'rgba(100, 100, 100, 0.65)',
  unknown:  'rgba(130, 130, 130, 0.55)',
}

export default function GraphEdge({
  fromPos, toPos,
  type = 'service',
  routing,
  health = 'unknown',
  isActive = false,
  noArrow = false,
}) {
  if (!fromPos || !toPos) return null
  const { x: x1, y: y1 } = fromPos
  const { x: x2, y: y2 } = toPos

  const color = isActive         ? 'var(--color-coral)' :
                type === 'shared-data' ? 'rgba(100,100,100,0.50)' :
                HEALTH_EDGE_COLORS[health] || HEALTH_EDGE_COLORS.unknown

  const strokeWidth = isActive ? 2.5 : type === 'shared-data' ? 1.2 : 1.8
  const dashArray   = type === 'shared-data' ? '5 3' : undefined

  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len === 0) return null

  let pathD
  // Default diagonal entry calculation
  let ux = dx / len, uy = dy / len
  let tx = x2 - ux * 22, ty = y2 - uy * 22
  
  if (routing === 'up-right') {
    // Exits UP from node 1, enters RIGHT into node 2.
    // Node 2 is to the right, so we enter its left side horizontally.
    tx = x2 - 50
    ty = y2
    pathD = `M ${x1} ${y1} L ${x1} ${ty} L ${tx} ${ty}`
  } else if (routing === 'right-down') {
    // Exits RIGHT from node 1, enters DOWN into node 2.
    // Node 2 is below, so we enter its top side vertically.
    tx = x2
    ty = y2 - 26
    pathD = `M ${x1} ${y1} L ${tx} ${y1} L ${tx} ${ty}`
  } else if (routing === 'around-right') {
    // Exits UP, travels RIGHT above the entire graph, drops DOWN on the far right, enters LEFT into node.
    tx = x2 + 50
    ty = y2
    pathD = `M ${x1} ${y1} L ${x1} -10 L 780 -10 L 780 ${ty} L ${tx} ${ty}`
  } else {
    pathD = `M ${x1} ${y1} L ${tx} ${ty}`
  }
  const markerEnd = (type === 'service' && !noArrow)
    ? (isActive ? 'url(#arrow-active)' : `url(#arrow-${health})`)
    : undefined

  return (
    <>
      <path
        d={pathD}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={dashArray}
        fill="none"
        opacity={1}
        markerEnd={markerEnd}
      />
      {isActive && type === 'service' && (
        <circle r="3.5" fill="var(--color-coral)" opacity={0.9}>
          <animateMotion dur="1.3s" repeatCount="indefinite" path={pathD} />
        </circle>
      )}
    </>
  )
}

export function GraphEdgeMarkers() {
  const healths = ['healthy', 'warning', 'critical', 'unknown']
  return (
    <defs>
      {healths.map(h => (
        <marker key={h} id={`arrow-${h}`} markerWidth={6} markerHeight={6} refX={5} refY={3} orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill={HEALTH_EDGE_COLORS[h] || HEALTH_EDGE_COLORS.unknown} />
        </marker>
      ))}
      <marker id="arrow-active" markerWidth={6} markerHeight={6} refX={5} refY={3} orient="auto">
        <path d="M0,0 L0,6 L6,3 z" fill="var(--color-coral)" />
      </marker>
    </defs>
  )
}
