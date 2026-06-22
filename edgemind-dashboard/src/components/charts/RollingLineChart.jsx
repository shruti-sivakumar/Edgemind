import { AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'

function fmt(v) {
  if (v == null) return '—'
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)}G`
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)}K`
  return v.toFixed(2)
}

export default function RollingLineChart({
  data = [],          // array of numbers (the 30-pt rolling window)
  color = 'var(--color-info)',
  unit = '',
  height = 80,
  anomalyThreshold,   // number — draws a ReferenceLine
  label,
  style,
}) {
  const chartData = data.map((v, i) => ({ i, v: v ?? 0 }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', ...style }}>
      {label && (
        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 2, flexShrink: 0 }}>{label}</div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`grad-${color.replace(/[^a-z]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="i" hide />
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-primary)', fontSize: 11 }}
            formatter={v => [`${fmt(v)}${unit}`, '']}
            labelFormatter={() => ''}
          />
          {anomalyThreshold != null && (
            <ReferenceLine y={anomalyThreshold} stroke="var(--color-warning)" strokeDasharray="3 3" />
          )}
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#grad-${color.replace(/[^a-z]/gi, '')})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      </div>
    </div>
  )
}
