'use client'
import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

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

const chartConfig = {
  ingresos: {
    label: 'Ingresos',
    color: 'hsl(28, 100%, 50%)',
  },
  gastos: {
    label: 'Gastos',
    color: 'hsl(225, 14%, 85%)',
  },
} satisfies ChartConfig

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
          ingresos: Math.round(d.ingresos),
          gastos: Math.round(d.gastos),
          key,
        }
      })
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-6)

    const tI = data.reduce((s, d) => s + d.ingresos, 0)
    const tG = data.reduce((s, d) => s + d.gastos, 0)
    const bal = tI - tG

    let tr: 'up' | 'down' | 'neutral' = 'neutral'
    if (data.length >= 2) {
      const last = data[data.length - 1].ingresos - data[data.length - 1].gastos
      const prev = data[data.length - 2].ingresos - data[data.length - 2].gastos
      tr = last > prev ? 'up' : last < prev ? 'down' : 'neutral'
    }

    return { chartData: data, totalIngresos: tI, totalGastos: tG, balance: bal, trend: tr }
  }, [traslados, gastos])

  const fmt = (v: number) => `$${v.toLocaleString('es-AR')}`

  if (chartData.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="font-display text-[15px] font-bold text-foreground mb-1">Resumen financiero</p>
          <p className="text-muted-foreground text-xs">Cuando completes traslados y registres gastos, veras el resumen aqui.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <p className="font-display text-[15px] font-bold text-foreground mb-4">Ingresos vs Gastos</p>
        <ChartContainer config={chartConfig} className="h-52 sm:h-64 w-full">
          <BarChart data={chartData} barGap={4} barCategoryGap="20%">
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={12}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              width={48}
              fontSize={11}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{chartConfig[name as keyof typeof chartConfig]?.label ?? name}:</span>
                      <span className="font-bold">{fmt(value as number)}</span>
                    </div>
                  )}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="ingresos"
              fill="var(--color-ingresos)"
              radius={[6, 6, 0, 0]}
            />
            <Bar
              dataKey="gastos"
              fill="var(--color-gastos)"
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ChartContainer>

        {/* Metrics below chart */}
        <div className="border-t border-border mt-4 pt-4 grid grid-cols-3 gap-3">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Ingresos</p>
            <p className="font-display text-lg sm:text-xl font-bold text-foreground mt-1">{fmt(totalIngresos)}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Gastos</p>
            <p className="font-display text-lg sm:text-xl font-bold text-muted-foreground mt-1">{fmt(totalGastos)}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Balance</p>
            <div className="flex items-center gap-1.5 mt-1">
              <p className={`font-display text-lg sm:text-xl font-bold ${balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                {fmt(Math.abs(balance))}
              </p>
              {trend === 'up' && <TrendingUp className="w-4 h-4 text-emerald-500" />}
              {trend === 'down' && <TrendingDown className="w-4 h-4 text-red-500" />}
              {trend === 'neutral' && <Minus className="w-4 h-4 text-muted-foreground" />}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
