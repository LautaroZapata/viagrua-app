'use client'
import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

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

    // Process income from completed, paid transfers
    for (const t of traslados) {
      if (!t.created_at) continue
      const key = getMonthKey(t.created_at)
      if (!monthlyData[key]) monthlyData[key] = { ingresos: 0, gastos: 0 }
      monthlyData[key].ingresos += t.importe_total || 0
    }

    // Process expenses
    for (const g of gastos) {
      if (!g.fecha) continue
      const key = getMonthKey(g.fecha)
      if (!monthlyData[key]) monthlyData[key] = { ingresos: 0, gastos: 0 }
      monthlyData[key].gastos += g.importe || 0
    }

    // Convert to array and sort by month
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
      .slice(-12) // Last 12 months
  }, [traslados, gastos])

  if (chartData.length === 0) {
    return (
      <div className="card p-4 sm:p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Ingresos vs Gastos</h3>
        <div className="text-center py-8">
          <p className="text-gray-400 text-sm">No hay datos para mostrar gráficos</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-4 sm:p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Ingresos vs Gastos (últimos 12 meses)</h3>
      <div className="h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(value) => `$${Number(value).toLocaleString('es-AR')}`}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey="Ingresos" fill="#22c55e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
