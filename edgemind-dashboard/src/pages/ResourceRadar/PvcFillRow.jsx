import { useAppState } from '../../core/store/AppContext.jsx'
import PvcGauge from '../../components/ui/PvcGauge.jsx'

export default function PvcFillRow() {
  const { pvcs, forecasts } = useAppState()
  const historian = pvcs['historian-data']  || {}
  const exportPvc = pvcs['export-data']     || {}
  const promPvc   = pvcs['prometheus-tsdb'] || {}

  return (
    <div style={{ display: 'flex', gap: '1vw' }}>
      <PvcGauge
        pvcName="historian-data"
        used={historian.used}
        capacity={historian.capacity}
        fillPct={historian.fill_pct}
        consumers={['data-historian', 'feature-extractor']}
      />
      <PvcGauge
        pvcName="export-data"
        used={exportPvc.used}
        capacity={exportPvc.capacity}
        fillPct={exportPvc.fill_pct}
        ttfMinutes={forecasts.pvc2_ttf_minutes}
        consumers={['alert-manager', 'batch-sync']}
      />
      <PvcGauge
        pvcName="prometheus-tsdb"
        used={promPvc.used}
        capacity={promPvc.capacity}
        fillPct={promPvc.fill_pct}
        consumers={['prometheus']}
      />
    </div>
  )
}
