import { useState, useMemo, useEffect } from 'react'
import { useAppState } from '../../core/store/AppContext.jsx'
import SeverityBadge from '../../components/ui/SeverityBadge.jsx'
import AgentTag from '../../components/ui/AgentTag.jsx'
import PodLabel from '../../components/ui/PodLabel.jsx'
import EventPopover from './EventPopover.jsx'
import AlertBracketPopover from './AlertBracketPopover.jsx'

const PAGE_SIZE = 50

function fmtRelative(isoStr) {
  if (!isoStr) return '-'
  const diffMs = Date.now() - new Date(isoStr).getTime()
  if (diffMs < 0) return 'just now'
  if (diffMs < 60000) return `${Math.floor(diffMs / 1000)}s ago`
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`
  if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`
  try { return new Date(isoStr).toLocaleDateString() } catch { return isoStr }
}

function fmtAbs(isoStr) {
  if (!isoStr) return '-'
  try { return new Date(isoStr).toLocaleString() } catch { return isoStr }
}

function getMetric(f) { return f.metric || f.metric_name || f.evidence?.metric || '-' }
function getValue(f)  { return f.value ?? f.current_value ?? f.metric_value ?? f.evidence?.value ?? '-' }
function getDeviation(f) { return f.deviation ?? f.z_score ?? f.ratio ?? f.evidence?.deviation ?? '-' }

function exportCsv(rows) {
  const header = 'timestamp,namespace,pod,agent,severity,anomaly_type,metric,value,deviation,correlated_id\n'
  const body = rows.map(r => {
    if (r._rowType === 'alert') {
      return [r.timestamp, '-', r.root_cause_pod, 'orchestrator', r.severity, r.alert_type,
        r.root_cause_metric, r.confidence, r.causal_chain?.length, r.id || r.alert_id]
        .map(v => `"${v ?? ''}"`).join(',')
    }
    return [r.timestamp, r.namespace, r.pod, r.agent, r.severity, r.anomaly_type,
      getMetric(r), getValue(r), getDeviation(r), r.correlated_alert_id || r.correlated_id]
      .map(v => `"${v ?? ''}"`).join(',')
  }).join('\n')
  const blob = new Blob([header + body], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'edgemind-findings.csv'; a.click()
  URL.revokeObjectURL(url)
}

export default function HistoryPanel({ typeFilter = 'all', nsFilter = '', windowMs = 30 * 60 * 1000, panOffsetMs = 0 }) {
  const { findings, correlatedAlerts } = useAppState()
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState(null)
  const [tick, setTick] = useState(0)

  // Tick every 30s so relative timestamps stay fresh
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000)
    return () => clearInterval(id)
  }, [])

  const sorted = useMemo(() => {
    const now = Date.now() - panOffsetMs
    const start = now - windowMs

    const filteredF = findings
      .filter(f => {
        const ms = f.timestamp ? new Date(f.timestamp).getTime() : 0
        if (ms < start || ms > now) return false
        if (typeFilter !== 'all' && f.anomaly_type !== typeFilter) return false
        if (nsFilter && f.namespace !== nsFilter) return false
        return true
      })
      .map(f => ({ ...f, _rowType: 'finding' }))

    const filteredA = (typeFilter === 'all' || typeFilter === 'correlated_alert')
      ? correlatedAlerts
          .filter(a => {
            const ms = a.timestamp ? new Date(a.timestamp).getTime() : 0
            return ms >= start && ms <= now
          })
          .map(a => ({ ...a, _rowType: 'alert' }))
      : []

    return [...filteredF, ...filteredA]
      .sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findings, correlatedAlerts, typeFilter, nsFilter, windowMs, panOffsetMs, tick])

  const total = sorted.length
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  if (total === 0) return (
    <div style={{
      padding: '6px 16px', borderTop: '1px solid var(--color-border-card)',
      display: 'flex', alignItems: 'center', gap: 6,
      fontSize: 11, color: 'var(--color-text-tertiary)',
    }}>
      <span style={{ color: 'var(--color-success)', fontSize: 12 }}>✓</span>
      No events in this window
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--color-border-card)', position: 'relative' }}>
      <style>{`
        .history-row {
          background: var(--color-bg-card);
          transition: background 0.15s ease;
        }
        .history-row:hover {
          background: var(--color-bg-card-hover);
        }
        .details-btn {
          font-size: 11px;
          font-weight: 600;
          color: var(--color-info);
          background: transparent;
          border: none;
          cursor: pointer;
          opacity: 0.8;
          transition: opacity 0.2s;
        }
        .details-btn:hover {
          opacity: 1;
          text-decoration: underline;
        }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 16px', background: 'var(--color-bg-surface)', borderBottom: '1px solid var(--color-border-card)' }}>
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600 }}>{total} EVENT{total !== 1 ? 'S' : ''}</span>
        <span style={{ flex: 1 }} />
        <button
          onClick={() => exportCsv(sorted)}
          style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 4, cursor: 'pointer', background: 'transparent', color: 'var(--color-info)', border: '1px solid var(--color-info)', transition: 'all 0.2s' }}
        >
          ↓ Export CSV
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border-card)', background: 'var(--color-bg-surface)' }}>
              {['Time', 'Namespace', 'Pod', 'Agent', 'Severity', 'Anomaly Type', 'Metric', 'Value', 'Deviation', 'Correlated', ''].map(h => (
                <th key={h} style={{ padding: '8px', textAlign: 'left', color: 'var(--color-text-tertiary)', fontWeight: 700, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => {
              if (row._rowType === 'alert') {
                return (
                  <tr key={`a-${i}`} className="history-row" style={{
                    borderBottom: '1px solid var(--color-border-card)',
                    borderLeft: '3px solid var(--color-info)',
                  }}>
                    <td style={{ padding: '8px', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }} title={fmtAbs(row.timestamp)}>
                      {fmtRelative(row.timestamp)}
                    </td>
                    <td style={{ padding: '8px', color: 'var(--color-text-tertiary)' }}>monitoring</td>
                    <td style={{ padding: '8px' }}><PodLabel pod={row.root_cause_pod || 'orchestrator'} /></td>
                    <td style={{ padding: '8px' }}><AgentTag agent="orchestrator" /></td>
                    <td style={{ padding: '8px' }}><SeverityBadge severity={row.severity} /></td>
                    <td style={{ padding: '8px' }}>
                      <span style={{ color: 'var(--color-info)', fontWeight: 700 }}>{row.alert_type}</span>
                      <span style={{ fontSize: 9, marginLeft: 4, color: 'var(--color-text-tertiary)' }}>CORR</span>
                    </td>
                    <td style={{ padding: '8px', color: 'var(--color-text-tertiary)' }}>{row.root_cause_metric || '-'}</td>
                    <td style={{ padding: '8px', color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                      {row.confidence != null ? `${(row.confidence * 100).toFixed(0)}% conf` : '-'}
                    </td>
                    <td style={{ padding: '8px', color: 'var(--color-text-tertiary)' }}>
                      {row.causal_chain?.length ? `${row.causal_chain.length} pods` : '-'}
                    </td>
                    <td style={{ padding: '8px', color: 'var(--color-info)', fontWeight: 600 }}>
                      {row.finding_ids?.length ? `${row.finding_ids.length} findings` : '-'}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>
                      <button className="details-btn" onClick={() => setSelected(row)}>
                        View Details →
                      </button>
                    </td>
                  </tr>
                )
              }

              // finding row
              const f = row
              const corrId = f.correlated_alert_id || f.correlated_id
              return (
                <tr key={`f-${i}`} className="history-row" style={{
                  borderBottom: '1px solid var(--color-border-card)',
                  borderLeft: corrId ? '3px solid var(--color-info)' : '3px solid transparent',
                }}>
                  <td style={{ padding: '8px', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }} title={fmtAbs(f.timestamp)}>
                    {fmtRelative(f.timestamp)}
                  </td>
                  <td style={{ padding: '8px', color: 'var(--color-text-tertiary)' }}>{f.namespace || '-'}</td>
                  <td style={{ padding: '8px' }}><PodLabel pod={f.pod} /></td>
                  <td style={{ padding: '8px' }}><AgentTag agent={f.agent} /></td>
                  <td style={{ padding: '8px' }}><SeverityBadge severity={f.severity} /></td>
                  <td style={{ padding: '8px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>{f.anomaly_type}</td>
                  <td style={{ padding: '8px', color: 'var(--color-text-tertiary)' }}>{getMetric(f)}</td>
                  <td style={{ padding: '8px', color: 'var(--color-text-secondary)' }}>{String(getValue(f))}</td>
                  <td style={{ padding: '8px', color: 'var(--color-text-tertiary)' }}>{String(getDeviation(f))}</td>
                  <td style={{ padding: '8px', color: corrId ? 'var(--color-info)' : 'var(--color-text-tertiary)' }}>
                    {corrId ? 'Linked' : '-'}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>
                    <button className="details-btn" onClick={() => setSelected(f)}>
                      Details →
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 12 }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            style={{ fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 4, cursor: page === 0 ? 'not-allowed' : 'pointer', background: 'var(--color-bg-card)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-primary)', opacity: page === 0 ? 0.4 : 1, transition: 'all 0.2s' }}
          >Prev</button>
          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', alignSelf: 'center', fontWeight: 600 }}>{page + 1} / {pages}</span>
          <button
            onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={page === pages - 1}
            style={{ fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 4, cursor: page === pages - 1 ? 'not-allowed' : 'pointer', background: 'var(--color-bg-card)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-primary)', opacity: page === pages - 1 ? 0.4 : 1, transition: 'all 0.2s' }}
          >Next</button>
        </div>
      )}

      {/* Popover for selected row */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 45, background: 'rgba(0,0,0,0.1)', backdropFilter: 'blur(2px)' }} onClick={() => setSelected(null)}>
          <div style={{ position: 'absolute', left: '50%', top: '48%', transform: 'translate(-50%, -50%)', filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.15))' }} onClick={e => e.stopPropagation()}>
            {selected._rowType === 'alert'
              ? <AlertBracketPopover alert={selected} onClose={() => setSelected(null)} />
              : <EventPopover finding={selected} onClose={() => setSelected(null)} xLeft={0} />
            }
          </div>
        </div>
      )}
    </div>
  )
}
