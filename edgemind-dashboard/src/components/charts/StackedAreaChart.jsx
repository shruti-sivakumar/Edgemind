import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

function fmt(v) {
  if (v == null) return '—'
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)}K`
  return v.toFixed(1)
}

export default function StackedAreaChart({
  dataTx = [], dataRx = [],
  colorTx = 'var(--color-info)',
  colorRx = 'var(--color-success)',
  unit = ' B/s',
  height = 80,
  style,
}) {
  const maxLen = Math.max(dataTx.length, dataRx.length)
  const chartData = Array.from({ length: maxLen }, (_, i) => ({
    i,
    tx: dataTx[i] ?? 0,
    rx: dataRx[i] ?? 0,
  }))

  return (
    <div style={{ flex: 1, minHeight: 0, ...style }}>
      <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <XAxis dataKey="i" hide />
        <YAxis hide domain={[0, 'auto']} />
        <Tooltip
          contentStyle={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-primary)', fontSize: 11 }}
          formatter={v => [`${fmt(v)}${unit}`, '']}
          labelFormatter={() => ''}
        />
        <Area type="monotone" dataKey="tx" name="TX" stroke={colorTx} fill={colorTx} fillOpacity={0.2} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        <Area type="monotone" dataKey="rx" name="RX" stroke={colorRx} fill={colorRx} fillOpacity={0.2} strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
