import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'

function fmt(v) {
  if (v == null) return '—'
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)}G`
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  return v.toFixed(2)
}

export default function DualLineChart({
  data1 = [], data2 = [],
  color1 = 'var(--color-info)',
  color2 = 'var(--color-text-info)',
  label1 = 'A', label2 = 'B',
  unit = '',
  height = 80,
  style,
}) {
  const maxLen = Math.max(data1.length, data2.length)
  const chartData = Array.from({ length: maxLen }, (_, i) => ({
    i,
    a: data1[i] ?? null,
    b: data2[i] ?? null,
  }))

  return (
    <div style={{ flex: 1, minHeight: 0, ...style }}>
      <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <XAxis dataKey="i" hide />
        <YAxis hide domain={['auto', 'auto']} />
        <Tooltip
          contentStyle={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-primary)', fontSize: 11 }}
          formatter={v => [`${fmt(v)}${unit}`, '']}
          labelFormatter={() => ''}
        />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        <Line type="monotone" dataKey="a" name={label1} stroke={color1} strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
        <Line type="monotone" dataKey="b" name={label2} stroke={color2} strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
      </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
