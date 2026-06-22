import { useState, useMemo } from 'react'
import { useAppState } from '../../core/store/AppContext.jsx'
import TimelineControls from './TimelineControls.jsx'
import TimelineCanvas from './TimelineCanvas.jsx'
import HistoryPanel from './HistoryPanel.jsx'

export default function AnomalyTimeline() {
  const [windowMs, setWindowMs] = useState(30 * 60 * 1000)
  const [typeFilter, setTypeFilter] = useState('all')
  const [nsFilter, setNsFilter] = useState('')
  const [paused, setPaused] = useState(false)
  const [panOffsetMs, setPanOffsetMs] = useState(0)

  const { findings, correlatedAlerts } = useAppState()

  const isNominal = useMemo(() => {
    const now = paused ? (window.__timelinePauseTs || Date.now()) : Date.now() - panOffsetMs
    const domainStart = now - windowMs

    const filteredFindings = findings.filter(f => {
      const ms = f.timestamp ? new Date(f.timestamp).getTime() : 0
      if (ms < domainStart || ms > now) return false
      if (typeFilter !== 'all' && f.anomaly_type !== typeFilter) return false
      if (nsFilter && f.namespace && f.namespace !== nsFilter) return false
      return true
    })

    const filteredAlerts = correlatedAlerts.filter(a => {
      const startMs = a.window_start ? new Date(a.window_start).getTime()
        : a.timestamp ? new Date(a.timestamp).getTime() : 0
      const endMs = a.window_end ? new Date(a.window_end).getTime()
        : startMs + (a.duration_s || 60) * 1000
      if (endMs < domainStart || startMs > now) return false
      return typeFilter === 'all' || typeFilter === 'correlated_alert'
    })

    return filteredFindings.length + filteredAlerts.length === 0
  }, [findings, correlatedAlerts, windowMs, typeFilter, nsFilter, paused, panOffsetMs])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <TimelineControls
        windowMs={windowMs} setWindowMs={setWindowMs}
        typeFilter={typeFilter} setTypeFilter={setTypeFilter}
        nsFilter={nsFilter} setNsFilter={setNsFilter}
        paused={paused} setPaused={setPaused}
        panOffsetMs={panOffsetMs} setPanOffsetMs={setPanOffsetMs}
        isNominal={isNominal}
      />
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', padding: 16 }}>
        <div style={{ minHeight: 420, flexShrink: 0 }}>
          <TimelineCanvas
            windowMs={windowMs} typeFilter={typeFilter}
            nsFilter={nsFilter} paused={paused}
            panOffsetMs={panOffsetMs}
          />
        </div>
        <HistoryPanel typeFilter={typeFilter} nsFilter={nsFilter} windowMs={windowMs} panOffsetMs={panOffsetMs} />
      </div>
    </div>
  )
}
