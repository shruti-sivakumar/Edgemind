import { useState } from 'react'
import { useDispatch, useAppState } from '../../core/store/AppContext.jsx'
import { useFaultInjection } from '../../core/api/useFaultInjection.js'
import { SCENARIOS } from '../../core/constants/faultModes.js'
import ScenarioCard from './ScenarioCard.jsx'

async function _setLeak(enabled) {
  try {
    await fetch('/featureextractor/leak', { method: enabled ? 'POST' : 'DELETE' })
  } catch {
    // feature-extractor not port-forwarded; skip
  }
}

async function _setFill(enabled) {
  try {
    await fetch('/alertmanager/fill', { method: enabled ? 'POST' : 'DELETE' })
  } catch {
    // alert-manager not reachable; skip
  }
}

export default function ScenarioLauncher({ showError }) {
  const { demoLab, sensorReadings } = useAppState()
  const dispatch = useDispatch()
  const [currentIndex, setCurrentIndex] = useState(0)

  const pump1 = useFaultInjection('pump1')
  const pump2 = useFaultInjection('pump2')
  const pump3 = useFaultInjection('pump3')
  const injectors = { pump1, pump2, pump3 }

  // A pump-targeted fault can still be live on the backend even after the
  // in-memory scenario state was wiped (e.g. page refresh). The /status poller
  // keeps sensorReadings up to date, so use it as the source of truth.
  const anyActiveFault =
    Object.values(demoLab.activeFaults || {}).some(Boolean) ||
    Object.values(sensorReadings || {}).some(r => r?.active_fault)

  async function handleLaunch(scenario) {
    // Block launching a second scenario while another fault/scenario is active
    if (anyActiveFault && demoLab.activeScenarioId !== scenario.id) {
      showError?.("Cannot launch scenario: Another fault or scenario is currently active. Please stop it first.")
      return
    }
    // Inject physical fault if this scenario targets a pump
    if (scenario.faultMode && scenario.targetPump) {
      const inj = injectors[scenario.targetPump]
      if (inj) await inj.inject(scenario.faultMode)
    }
    // Enable memory leak for scenario 2
    if (scenario.id === 2) {
      await _setLeak(true)
    }
    // Start PVC fill for scenario 3 (self-cleaning on the backend)
    if (scenario.id === 3) {
      await _setFill(true)
    }
    // Global store so scenario state persists across page navigation
    dispatch({ type: 'SET_DEMO_SCENARIO', payload: {
      activeScenarioId: scenario.id,
      completedScenarioId: null,
      scenarioStartedAt: new Date().toISOString(),
    }})
  }

  async function handleClear(scenario) {
    // Clear physical fault
    if (scenario.targetPump) {
      const inj = injectors[scenario.targetPump]
      if (inj) await inj.clear()
    }
    // Disable memory leak
    if (scenario.id === 2) {
      await _setLeak(false)
    }
    // Stop PVC fill + clean up
    if (scenario.id === 3) {
      await _setFill(false)
    }
    dispatch({ type: 'SET_DEMO_SCENARIO', payload: {
      activeScenarioId: null,
      completedScenarioId: scenario.id,
    }})
  }

  const nextScenario = () => setCurrentIndex((prev) => (prev + 1) % SCENARIOS.length)
  const prevScenario = () => setCurrentIndex((prev) => (prev === 0 ? SCENARIOS.length - 1 : prev - 1))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <span style={{ display: 'inline-block', width: 3, height: 14, borderRadius: 2, background: 'var(--color-info)', flexShrink: 0 }} />
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--color-text-primary)', textTransform: 'uppercase' }}>
            Scenarios
          </span>
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={prevScenario} style={navBtn}>‹</button>
          <button onClick={nextScenario} style={navBtn}>›</button>
        </div>
      </div>
      <div style={{ flex: 1, height: 210, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          display: 'flex',
          width: `${SCENARIOS.length * 100}%`,
          height: '100%',
          transform: `translateX(-${(currentIndex / SCENARIOS.length) * 100}%)`,
          transition: 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)'
        }}>
          {SCENARIOS.map(scen => {
            // Backend fault still live for this scenario's pump? Then treat the
            // card as running even if the volatile scenario state was lost, so
            // the Stop button is always reachable while a fault is active.
            const faultLive = !!(scen.targetPump && sensorReadings?.[scen.targetPump]?.active_fault)
            const isRunning = demoLab.activeScenarioId === scen.id || faultLive
            const isCompleted = demoLab.completedScenarioId === scen.id && !faultLive
            // Never disable the card that owns the active fault, otherwise its
            // Stop button becomes unclickable (pointerEvents: none).
            const isDisabled = !isRunning && (anyActiveFault || demoLab.activeScenarioId != null)
            return (
              <div key={scen.id} style={{ width: `${100 / SCENARIOS.length}%`, height: '100%', paddingBottom: 4, paddingRight: 4, paddingLeft: 2 }}>
                <ScenarioCard
                  scenario={scen}
                  running={isRunning}
                  completed={isCompleted}
                  disabled={isDisabled}
                  onLaunch={() => handleLaunch(scen)}
                  onClear={() => handleClear(scen)}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const navBtn = {
  width: 32, height: 32, borderRadius: '50%',
  background: 'var(--color-bg-card)', border: '1px solid var(--color-border-card)',
  color: 'var(--color-text-primary)', fontSize: 20,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', boxShadow: '0 2px 4px var(--color-shadow)',
  lineHeight: 0, paddingBottom: 2
}
