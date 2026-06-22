// Correlation lifecycle: a correlated alert is only "active" while its fault is
// still producing evidence. The backend never marks alerts resolved, so we
// derive liveness here — an alert auto-resolves once no related finding has
// arrived within TTL_MS (and it's older than that grace window).
//
// Findings carry full pod names (feature-extractor-7fb-8g8d5); causal_chain /
// root_cause_pod carry short deployment names — so match by prefix.

export const CORRELATION_TTL_MS = 180000  // 3 min of quiet → resolved

// Findings older than the TTL no longer reflect the live system state. The
// backend never deletes findings (it keeps a rolling buffer), so any view that
// shows "current health" — graph node colors, critical/warning counts — must
// filter to this window or it stays red long after a fault recovers.
export function recentFindings(findings, now = Date.now(), ttlMs = CORRELATION_TTL_MS) {
  return findings.filter(
    f => f.timestamp && (now - new Date(f.timestamp).getTime()) < ttlMs
  )
}

function matchesPod(findingPod, shortName) {
  return findingPod === shortName || findingPod.startsWith(shortName + '-')
}

export function isCorrelationActive(alert, findings, now = Date.now(), ttlMs = CORRELATION_TTL_MS) {
  if (!alert || alert.resolved) return false

  // Grace window: a freshly-created alert stays active even before the next
  // finding lands, so it never flickers off immediately after firing.
  const created = alert.timestamp ? new Date(alert.timestamp).getTime() : 0
  if (created && now - created < ttlMs) return true

  // Otherwise: active iff a related finding arrived within the TTL.
  const pods = [...(alert.causal_chain || [])]
  if (alert.root_cause_pod) pods.push(alert.root_cause_pod)
  if (pods.length === 0) return false

  let newest = 0
  for (const f of findings) {
    if (!f.pod || !f.timestamp) continue
    if (pods.some(p => matchesPod(f.pod, p))) {
      const t = new Date(f.timestamp).getTime()
      if (t > newest) newest = t
    }
  }
  return newest > 0 && now - newest < ttlMs
}

export function countActiveCorrelations(correlatedAlerts, findings, now = Date.now(), ttlMs = CORRELATION_TTL_MS) {
  return correlatedAlerts.filter(a => isCorrelationActive(a, findings, now, ttlMs)).length
}

export function latestActiveCorrelation(correlatedAlerts, findings, now = Date.now(), ttlMs = CORRELATION_TTL_MS) {
  return correlatedAlerts.find(a => isCorrelationActive(a, findings, now, ttlMs)) || null
}
