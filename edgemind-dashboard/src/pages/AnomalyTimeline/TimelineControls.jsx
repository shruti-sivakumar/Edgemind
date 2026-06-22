const EVENT_TYPES = [
  'cpu_spike', 'cpu_throttle', 'memory_leak', 'pre_oom', 'oomkill_detected',
  'io_saturation', 'write_burst', 'pvc_fill', 'network_flood', 'crash_loop',
  'log_error_surge', 'data_stale', 'pump_health_critical', 'correlated_alert',
]

export default function TimelineControls({
  windowMs, setWindowMs,
  typeFilter, setTypeFilter,
  nsFilter, setNsFilter,
  paused, setPaused,
  panOffsetMs, setPanOffsetMs,
  isNominal,
}) {
  const windows = [
    { label: '15 min', ms: 15 * 60 * 1000 },
    { label: '30 min', ms: 30 * 60 * 1000 },
    { label: '1 hr',   ms: 60 * 60 * 1000 },
    { label: '6 hr',   ms: 6 * 60 * 60 * 1000 },
  ]
  const zoomMinutes = Math.round(windowMs / 60000)
  const isLive = !paused && panOffsetMs === 0

  const buttonStyle = active => ({
    fontSize: 11, padding: '3px 10px', borderRadius: 4, cursor: 'pointer',
    background: active ? 'var(--color-info)' : 'transparent',
    color: active ? '#fff' : 'var(--color-text-secondary)',
    border: `1px solid ${active ? 'var(--color-info)' : 'var(--color-border-primary)'}`,
  })

  return (
    <div style={{
      minHeight: 'var(--header-height)',
      borderBottom: '1px solid var(--color-border-card)',
      marginTop: 12,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      background: 'var(--color-bg-card)', position: 'relative',
      padding: '8px 20px', flexWrap: 'wrap', gap: 16,
    }}>
      {/* LEFT SECTION (Title & Filters) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        {/* Title + live indicator */}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ display: 'inline-block', width: 3, height: 14, borderRadius: 2, background: 'var(--color-danger)' }} />
          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.04em', color: 'var(--color-text-primary)', textTransform: 'uppercase' }}>
            Anomaly Timeline
          </span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, padding: '4px 8px', borderRadius: 4, background: isLive ? 'var(--color-success-tint)' : 'var(--color-bg-chip)', flexShrink: 0 }}>
          <span className={isLive ? 'animate-blink' : ''} style={{
            width: 8, height: 8, borderRadius: '50%',
            background: isLive ? 'var(--color-success)' : 'var(--color-text-tertiary)',
            display: 'inline-block', flexShrink: 0,
          }} />
          <span style={{ color: isLive ? 'var(--color-success)' : 'var(--color-text-tertiary)' }}>
            {isLive ? 'Live' : 'Paused'}
          </span>
        </span>

        {isNominal && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 4, background: 'var(--color-success-tint)', border: '1px solid rgba(0, 180, 100, 0.2)', color: 'var(--color-success)', flexShrink: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 800 }}>✓</span> System Nominal
          </span>
        )}

        <div style={{ width: 1, height: 24, background: 'var(--color-border-card)' }} />

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            style={{
              background: 'var(--color-bg-card)', color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border-primary)', borderRadius: 4, padding: '4px 8px', fontSize: 11, fontWeight: 600,
              outline: 'none', cursor: 'pointer'
            }}
          >
            <option value="all">All Event Types</option>
            {EVENT_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
          </select>

          <select
            value={nsFilter}
            onChange={e => setNsFilter(e.target.value)}
            style={{
              background: 'var(--color-bg-card)', color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border-primary)', borderRadius: 4, padding: '4px 8px', fontSize: 11, fontWeight: 600,
              outline: 'none', cursor: 'pointer'
            }}
          >
            <option value="">All Namespaces</option>
            <option value="pump-station">pump-station</option>
            <option value="monitoring">monitoring</option>
          </select>
        </div>
      </div>

      {/* RIGHT SECTION (Time, Zoom, Playback) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        
        {/* Time window buttons */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--color-bg-input)', padding: 4, borderRadius: 6 }}>
          {windows.map(w => (
            <button key={w.ms} onClick={() => setWindowMs(w.ms)} style={{
              fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 4, cursor: 'pointer',
              background: windowMs === w.ms ? 'var(--color-bg-card)' : 'transparent',
              color: windowMs === w.ms ? 'var(--color-info)' : 'var(--color-text-secondary)',
              border: 'none',
              boxShadow: windowMs === w.ms ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s ease-in-out'
            }}>
              {w.label}
            </button>
          ))}
        </div>

        {/* Zoom slider */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 600, color: 'var(--color-text-secondary)' }}>
          Zoom
          <input
            type="range" min="1" max="360"
            value={Math.min(360, Math.max(1, zoomMinutes))}
            onChange={e => setWindowMs(Number(e.target.value) * 60 * 1000)}
            style={{ width: 100, accentColor: 'var(--color-info)', cursor: 'pointer' }}
          />
          <span style={{ color: 'var(--color-text-tertiary)', width: 32 }}>{zoomMinutes}m</span>
        </label>

        <div style={{ width: 1, height: 24, background: 'var(--color-border-card)', display: 'block' }} />

        {/* Play/Pause & Pan buttons */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => {
              if (!paused) window.__timelinePauseTs = Date.now() - panOffsetMs
              setPaused(p => !p)
            }}
            style={{
              fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 4, cursor: 'pointer',
              background: paused ? 'var(--color-warning-tint)' : 'var(--color-bg-input)',
              color: paused ? 'var(--color-warning)' : 'var(--color-text-primary)',
              border: `1px solid ${paused ? 'var(--color-warning-border)' : 'transparent'}`,
              display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.2s'
            }}
          >
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>

          <button onClick={() => setPanOffsetMs(v => v + 5 * 60 * 1000)} 
            style={{
              fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
              background: 'var(--color-bg-card)', color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border-primary)', transition: 'all 0.2s'
            }}>
            ← 5m
          </button>
          <button
            onClick={() => setPanOffsetMs(v => Math.max(0, v - 5 * 60 * 1000))}
            disabled={panOffsetMs === 0}
            style={{
              fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 4, cursor: panOffsetMs === 0 ? 'not-allowed' : 'pointer',
              background: 'var(--color-bg-card)', color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border-primary)', opacity: panOffsetMs === 0 ? 0.45 : 1, transition: 'all 0.2s'
            }}
          >
            5m →
          </button>
          
          {panOffsetMs > 0 && (
            <button onClick={() => { setPanOffsetMs(0); setPaused(false) }} 
              style={{
                fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 4, cursor: 'pointer',
                background: 'var(--color-info)', color: '#fff', border: '1px solid var(--color-info-border)', transition: 'all 0.2s'
              }}>
              Live Edge
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
