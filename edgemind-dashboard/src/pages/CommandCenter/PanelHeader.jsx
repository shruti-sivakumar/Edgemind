// Consistent section header used by every Command Center panel.
// The short red left-bar accent mirrors ABB's professional UI convention
// of using a bold red rule to introduce section headings.
export default function PanelHeader({ title, hint }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          display: 'inline-block', width: 3, height: 14, borderRadius: 2,
          background: 'var(--color-danger)', flexShrink: 0,
        }} />
        <span style={{
          fontSize: 11, fontWeight: 800, letterSpacing: '0.06em',
          color: 'var(--color-text-primary)', textTransform: 'uppercase',
        }}>
          {title}
        </span>
      </div>
      {hint && (
        <span style={{
          fontSize: 11, color: 'var(--color-text-tertiary)',
          fontWeight: 400, letterSpacing: 0,
        }}>
          {hint}
        </span>
      )}
    </div>
  )
}
