import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { MetricSnapshot } from '../../stores/dashboard'

interface ActivityChartProps {
  history: MetricSnapshot[]
}

export default function ActivityChart({ history }: ActivityChartProps) {
  const data = history.map((s) => ({
    time: new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    thinking: s.thinkingCount,
    waiting: s.waitingCount,
    idle: s.idleCount,
  }))

  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-600 text-xs">
        Collecting data...
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="thinkingGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#eab308" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="waitingGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="idleGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1a1e2e', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }}
          labelStyle={{ color: '#94a3b8' }}
        />
        <Area type="monotone" dataKey="thinking" stroke="#eab308" fill="url(#thinkingGrad)" strokeWidth={1.5} />
        <Area type="monotone" dataKey="waiting" stroke="#f97316" fill="url(#waitingGrad)" strokeWidth={1.5} />
        <Area type="monotone" dataKey="idle" stroke="#34d399" fill="url(#idleGrad)" strokeWidth={1.5} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
