import { useAppState } from '../../core/store/AppContext.jsx'
import AgentTag from '../../components/ui/AgentTag.jsx'
import PanelHeader from '../../components/ui/PanelHeader.jsx'
import SeverityBadge from '../../components/ui/SeverityBadge.jsx'
import ConfidenceTier from '../../components/ui/ConfidenceTier.jsx'

const AGENTS = ['cpu', 'memory', 'storage', 'network_log']

export default function EvidenceMatrix({ alert }) {
  const { findings } = useAppState()

  const incidentFindings = alert?.findings_by_agent || {}

  const rows = AGENTS.map(agent => {
    const fromStore = findings.filter(f => f.agent === agent && (!alert || f.correlated_id === alert.id || !f.correlated_id)).slice(0, 3)
    const provided = incidentFindings[agent] || []
    const all = [...provided, ...fromStore].slice(0, 3)
    return { agent, findings: all }
  })

  return (
    <div style={{ marginTop: 10 }}>
      <PanelHeader title="Evidence Matrix" style={{ marginBottom: 8 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        {rows.map(({ agent, findings: aFindings }) => (
          <div key={agent} style={{ background: 'var(--color-bg-surface)', borderRadius: 6, padding: '8px 10px' }}>
            <div style={{ marginBottom: 6 }}><AgentTag agent={agent} /></div>
            {aFindings.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>No evidence</div>
            ) : (
              aFindings.map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '2px 0', fontSize: 11 }}>
                  <SeverityBadge severity={f.severity} />
                  <span style={{ flex: 1, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.anomaly_type}</span>
                  <ConfidenceTier value={f.confidence} compact />
                </div>
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
