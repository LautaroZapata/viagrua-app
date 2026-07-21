'use client'
import { useMemo } from 'react'
import { BarChart } from '@tremor/react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface Traslado {
  importe_total: number | null
  created_at: string
}

interface Gasto {
  importe: number
  fecha: string
}

interface Props {
  traslados: Traslado[]
  gastos: Gasto[]
}

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const MONTH_LABELS: Record<string, string> = {
  '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
}

export default function DashboardCharts({ traslados, gastos }: Props) {
  const { chartData, totalIngresos, totalGastos, balance, trend } = useMemo(() => {
    const monthlyData: Record<string, { ingresos: number; gastos: number }> = {}

    for (const t of traslados) {
      if (!t.created_at) continue
      const key = getMonthKey(t.created_at)
      if (!monthlyData[key]) monthlyData[key] = { ingresos: 0, gastos: 0 }
      monthlyData[key].ingresos += t.importe_total || 0
    }

    for (const g of gastos) {
      if (!g.fecha) continue
      const key = getMonthKey(g.fecha)
      if (!monthlyData[key]) monthlyData[key] = { ingresos: 0, gastos: 0 }
      monthlyData[key].gastos += g.importe || 0
    }

    const data = Object.entries(monthlyData)
      .map(([key, d]) => {
        const [year, month] = key.split('-')
        return {
          month: `${MONTH_LABELS[month]} ${year.slice(2)}`,
          Ingresos: Math.round(d.ingresos),
          Gastos: Math.round(d.gastos),
          key,
        }
      })
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-6)

    const tI = data.reduce((s, d) => s + d.Ingresos, 0)
    const tG = data.reduce((s, d) => s + d.Gastos, 0)
    const bal = tI - tG

    // Trend: compare last 2 months
    let tr: 'up' | 'down' | 'neutral' = 'neutral'
    if (data.length >= 2) {
      const last = data[data.length - 1].Ingresos - data[data.length - 1].Gastos
      const prev = data[data.length - 2].Ingresos - data[data.length - 2].Gastos
      tr = last > prev ? 'up' : last < prev ? 'down' : 'neutral'
    }

    return { chartData: data, totalIngresos: tI, totalGastos: tG, balance: bal, trend: tr }
  }, [traslados, gastos])

  const fmt = (v: number) => `$${v.toLocaleString('es-AR')}`

  if (chartData.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <p className="text-sm font-medium text-foreground mb-1">Resumen financiero</p>
        <p className="text-muted-foreground text-xs">Cuando completes traslados y registres gastos, veras el resumen aqui.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Ingresos</p>
          <p className="text-lg sm:text-xl font-bold text-emerald-600 mt-1">{fmt(totalIngresos)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Gastos</p>
          <p className="text-lg sm:text-xl font-bold text-red-500 mt-1">{fmt(totalGastos)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Balance</p>
          <div className="flex items-center gap-1.5 mt-1">
            <p className={`text-lg sm:text-xl font-bold ${balance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {fmt(Math.abs(balance))}
            </p>
            {trend === 'up' && <TrendingUp className="w-4 h-4 text-emerald-500" />}
            {trend === 'down' && <TrendingDown className="w-4 h-4 text-red-500" />}
            {trend === 'neutral' && <Minus className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <p className="text-sm font-medium text-foreground mb-4">Ingresos vs Gastos</p>
        <BarChart
          className="h-52 sm:h-64"
          data={chartData}
          index="month"
          categories={['Ingresos', 'Gastos']}
          colors={['emerald', 'rose']}
          valueFormatter={fmt}
          yAxisWidth={52}
          showAnimation
          showGridLines={false}
        />
      </div>
    </div>
  )
}
