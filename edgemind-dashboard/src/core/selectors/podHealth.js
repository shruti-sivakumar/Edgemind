// Shared pod-health selectors derived from agent findings.
// Used by the Command Center KPI strip and the pod-health heatmap so both
// agree on a single source of truth (replaces the ad-hoc podIsCritical in
// the old VitalCards and the local helper in StatusStrip).

import { LAYERS, MONITORING_LAYER } from '../constants/topology.js'

export const ALL_PODS = [...LAYERS.flat(), ...MONITORING_LAYER]

const RANK = { healthy: 0, info: 0, warning: 1, critical: 2 }

// Classify each monitored pod by the worst severity among its findings.
// Returns { [pod]: 'healthy' | 'warning' | 'critical' }.
export function classifyPods(findings = [], pods = ALL_PODS) {
  const worst = {}
  pods.forEach(p => { worst[p] = 'healthy' })

  findings.forEach(f => {
    const pod = f?.pod
    if (pod == null || worst[pod] === undefined) return
    const sev = f.severity === 'info' ? 'healthy' : f.severity
    if ((RANK[sev] ?? 0) > (RANK[worst[pod]] ?? 0)) worst[pod] = sev
  })

  return worst
}

// Aggregate counts that partition the monitored-pod set.
export function healthCounts(findings = [], pods = ALL_PODS) {
  const worst = classifyPods(findings, pods)
  let healthy = 0, warning = 0, critical = 0
  Object.values(worst).forEach(s => {
    if (s === 'critical') critical++
    else if (s === 'warning') warning++
    else healthy++
  })
  return { healthy, warning, critical, total: pods.length }
}

// Name of the single most-degraded pod (critical first, then warning).
export function worstPod(findings = [], pods = ALL_PODS) {
  const worst = classifyPods(findings, pods)
  return Object.keys(worst).find(p => worst[p] === 'critical')
    || Object.keys(worst).find(p => worst[p] === 'warning')
    || null
}
