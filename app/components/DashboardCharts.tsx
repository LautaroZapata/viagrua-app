'use client'
import { useMemo } from 'react'
import type { MesResumen } from '@/lib/useSupabaseQuery'
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

interface Props {
  /** Serie ya agregada por get_resumen_mensual, en orden cronologico. */
  resumen: MesResumen[]
}

const MONTH_LABELS: Record<string, string> = {
  '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
}

// Los colores salen de los tokens --chart-*, que ya estan definidos para light
// y dark. Antes eran literales: el gris de 'gastos' quedaba en ~1.3:1 sobre la
// card en light mode, o sea invisible, y chillon en dark.
const chartConfig = {
  ingresos: {
    label: 'Ingresos',
    color: 'hsl(var(--chart-1))',
  },
  gastos: {
    label: 'Gastos',
    color: 'hsl(var(--chart-2))',
  },
} satisfies ChartConfig

export default function DashboardCharts({ resumen }: Props) {
  const { chartData, totalIngresos, totalGastos, balance, trend } = useMemo(() => {
    // La serie ya viene agrupada por mes y ordenada desde get_resumen_mensual.
    // Aca solo queda darle formato a la etiqueta y calcular los totales.
    const data = resumen.map((r) => {
      const [year, month] = r.mes.split('-')
      return {
        month: `${MONTH_LABELS[month] ?? month} ${year.slice(2)}`,
        ingresos: Math.round(Number(r.ingresos)),
        gastos: Math.round(Number(r.gastos)),
        key: r.mes,
      }
    })

    const tI = data.reduce((s, d) => s + d.ingresos, 0)
    const tG = data.reduce((s, d) => s + d.gastos, 0)
    const bal = tI - tG

    let tr: 'up' | 'down' | 'neutral' = 'neutral'
    if (data.length >= 2) {
      const last = data[data.length - 1]!.ingresos - data[data.length - 1]!.gastos
      const prev = data[data.length - 2]!.ingresos - data[data.length - 2]!.gastos
      tr = last > prev ? 'up' : last < prev ? 'down' : 'neutral'
    }

    return { chartData: data, totalIngresos: tI, totalGastos: tG, balance: bal, trend: tr }
  }, [resumen])

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
