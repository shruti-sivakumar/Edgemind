import { useState } from 'react'
import { EVENT_BLOCK_COLORS, SEVERITY_COLORS } from '../../core/constants/colors.js'
import EventPopover from './EventPopover.jsx'

const ICONS = {
  oomkill_detected:    '✗',
  crash_loop:          '↻',
  pump_health_critical:'♥',
  pre_oom:             '⚠',
}

const ABBREV = {
  cpu_spike:            'CPU↑',
  cpu_throttle:         'THRT',
  memory_leak:          'LEAK',
  pre_oom:              '⚠OOM',
  oomkill_detected:     '✗OOM',
  io_saturation:        'IO-SAT',
  write_burst:          'WRT',
  pvc_fill:             'PVC',
  network_flood:        'FLOOD',
  crash_loop:           '↻CRH',
  log_error_surge:      'LOG↑',
  data_stale:           'STALE',
  pump_health_critical: '♥PUMP',
  correlated_alert:     'CORR',
}

function getLabel(anomaly_type, windowMs) {
  // > 3h: icon only
  if (windowMs > 3 * 60 * 60 * 1000) {
    return ICONS[anomaly_type] || anomaly_type?.slice(0, 3)
  }
  // > 30 min: abbreviated
  if (windowMs > 30 * 60 * 1000) {
    return ABBREV[anomaly_type] || anomaly_type?.slice(0, 8)
  }
  // ≤ 30 min: full text with icon prefix
  const icon = ICONS[anomaly_type]
  return icon ? `${icon} ${anomaly_type}` : anomaly_type
}

export default function EventBlock({ finding, xLeft, width, windowMs = 30 * 60 * 1000 }) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const color = EVENT_BLOCK_COLORS[finding.anomaly_type] || SEVERITY_COLORS[finding.severity] || 'var(--color-info)'
  const w = Math.max(12, width)
  const outlined = ['cpu_throttle', 'pvc_fill', 'data_stale'].includes(finding.anomaly_type)
  const isPulse = finding.anomaly_type === 'pre_oom'
  const isCritical = finding.severity === 'critical'
  const label = getLabel(finding.anomaly_type, windowMs)

  return (
    <>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        className={isPulse ? 'animate-oom-pulse' : ''}
        title={`${finding.pod} · ${finding.anomaly_type} · ${finding.severity}`}
        style={{
          position: 'absolute',
          left: xLeft,
          top: 4,
          width: w,
          height: 20,
          background: outlined ? (hovered ? `${color}1A` : 'transparent') : color,
          border: `1.5px ${finding.anomaly_type === 'data_stale' ? 'dashed' : 'solid'} ${color}`,
          borderRadius: 10, // Pill shape
          opacity: isPulse ? 1 : (hovered ? 1 : 0.9),
          cursor: 'pointer',
          overflow: 'hidden',
          display: 'flex', alignItems: 'center', paddingLeft: w > 20 ? 6 : 2,
          boxShadow: isCritical && !outlined ? `0 0 8px ${color}80` : (hovered ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'),
          transition: 'all 0.15s ease',
          transform: hovered ? 'scale(1.05)' : 'scale(1)',
          zIndex: hovered ? 10 : 1,
        }}
      >
        {w > 26 && label && (
          <span style={{ fontSize: 9, color: outlined ? color : '#fff', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', letterSpacing: '0.02em' }}>
            {label}
          </span>
        )}
      </div>
      {open && (
        <EventPopover finding={finding} onClose={() => setOpen(false)} xLeft={xLeft} />
      )}
    </>
  )
}
