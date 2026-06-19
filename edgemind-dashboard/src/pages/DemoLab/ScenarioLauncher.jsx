import { useState } from 'react'
import { useDispatch, useAppState } from '../../core/store/AppContext.jsx'
import PanelHeader from '../../components/ui/PanelHeader.jsx'
import { useFaultInjection } from '../../core/api/useFaultInjection.js'
import { SCENARIOS } from '../../core/constants/faultModes.js'
import ScenarioCard from './ScenarioCard.jsx'

export default function ScenarioLauncher() {
  const { demoLab } = useAppState()
  const dispatch = useDispatch()
  const [runningScenario, setRunningScenario] = useState(null)
  const [completedScenario, setCompletedScenario] = useState(null)

  const pump1 = useFaultInjection('pump1')
  const pump2 = useFaultInjection('pump2')
  const pump3 = useFaultInjection('pump3')
  const injectors = { pump1, pump2, pump3 }

  const anyActiveFault = Object.values(demoLab.activeFaults || {}).some(Boolean)

  async function handleLaunch(scenario) {
    setRunningScenario(scenario.id)
    setCompletedScenario(null)
    if (scenario.faultMode && scenario.targetPump) {
      const inj = injectors[scenario.targetPump]
      if (inj) await inj.inject(scenario.faultMode)
    }
    dispatch({ type: 'SET_DEMO_SCENARIO', payload: { activeScenarioId: scenario.id, scenarioStartedAt: new Date().toISOString() } })
  }

  async function handleClear(scenario) {
    if (scenario.targetPump) {
      const inj = injectors[scenario.targetPump]
      if (inj) await inj.clear()
    }
    if (runningScenario === scenario.id) {
      setCompletedScenario(scenario.id)
      setRunningScenario(null)
    } else {
      setCompletedScenario(null)
    }
    dispatch({ type: 'SET_DEMO_SCENARIO', payload: { activeScenarioId: null } })
  }

  return (
    <div>
      <PanelHeader title="Scenarios" style={{ marginBottom: 10 }} />
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {SCENARIOS.map(scenario => (
          <ScenarioCard
            key={scenario.id}
            scenario={scenario}
            running={runningScenario === scenario.id}
            completed={completedScenario === scenario.id}
            disabled={anyActiveFault && runningScenario !== scenario.id}
            onLaunch={() => handleLaunch(scenario)}
            onClear={() => handleClear(scenario)}
          />
        ))}
      </div>
    </div>
  )
}
