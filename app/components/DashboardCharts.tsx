'use client'
import { useMemo } from 'react'
import { BarChart } from '@tremor/react'

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
  const chartData = useMemo(() => {
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

    return Object.entries(monthlyData)
      .map(([key, data]) => {
        const [year, month] = key.split('-')
        return {
          month: `${MONTH_LABELS[month]} ${year.slice(2)}`,
          Ingresos: Math.round(data.ingresos),
          Gastos: Math.round(data.gastos),
          key,
        }
      })
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-12)
  }, [traslados, gastos])

  if (chartData.length === 0) {
    return (
      <div className="card p-4 sm:p-6">
        <h3 className="text-sm font-semibold text-foreground mb-3">Ingresos vs Gastos</h3>
        <div className="text-center py-8">
          <p className="text-muted-foreground text-sm">No hay datos para mostrar graficos</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-4 sm:p-6">
      <h3 className="text-sm font-semibold text-foreground mb-3">Ingresos vs Gastos (ultimos 12 meses)</h3>
      <BarChart
        className="h-64 sm:h-72"
        data={chartData}
        index="month"
        categories={['Ingresos', 'Gastos']}
        colors={['emerald', 'red']}
        valueFormatter={(v) => `$${v.toLocaleString('es-AR')}`}
        yAxisWidth={56}
      />
    </div>
  )
}
