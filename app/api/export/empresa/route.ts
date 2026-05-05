import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type PerfilRelacion = { nombre_completo?: string | null } | { nombre_completo?: string | null }[] | null

type TrasladoRecord = {
  id: string
  marca_modelo: string | null
  matricula: string | null
  estado: string | null
  estado_pago: string | null
  importe_total: number | null
  observaciones: string | null
  created_at: string | null
  desde: string | null
  hasta: string | null
  perfiles?: PerfilRelacion
}

type GastoRecord = {
  id: string
  tipo: string | null
  importe: number | null
  descripcion: string | null
  fecha: string | null
  created_at: string | null
  perfiles?: PerfilRelacion
}

type ExportRow = {
  tipo_movimiento: 'traslado' | 'gasto'
  fecha: string
  concepto: string
  vehiculo: string
  matricula: string
  chofer_usuario: string
  estado: string
  estado_pago: string
  ingreso: number
  gasto: number
  origen: string
  destino: string
  observaciones: string
  id: string
}

const CSV_FIELDS: (keyof ExportRow)[] = [
  'tipo_movimiento',
  'fecha',
  'concepto',
  'vehiculo',
  'matricula',
  'chofer_usuario',
  'estado',
  'estado_pago',
  'ingreso',
  'gasto',
  'origen',
  'destino',
  'observaciones',
  'id',
]

const PAGE_SIZE = 1000

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data: perfil, error: perfilError } = await supabase
      .from('perfiles')
      .select('id, empresa_id, rol')
      .eq('id', user.id)
      .single()

    if (perfilError || !perfil) {
      return NextResponse.json({ error: 'No se pudo verificar el perfil' }, { status: 403 })
    }

    if (perfil.rol !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores pueden exportar datos' }, { status: 403 })
    }

    const [traslados, gastos] = await Promise.all([
      fetchTraslados(supabase, perfil.empresa_id),
      fetchGastos(supabase, perfil.empresa_id),
    ])

    const trasladoRows: ExportRow[] = traslados.map((traslado) => ({
      tipo_movimiento: 'traslado',
      fecha: formatDate(traslado.created_at),
      concepto: traslado.marca_modelo || '',
      vehiculo: traslado.marca_modelo || '',
      matricula: traslado.matricula || '',
      chofer_usuario: getNombrePerfil(traslado.perfiles),
      estado: traslado.estado || '',
      estado_pago: traslado.estado_pago || '',
      ingreso: normalizeNumber(traslado.importe_total),
      gasto: 0,
      origen: traslado.desde || '',
      destino: traslado.hasta || '',
      observaciones: traslado.observaciones || '',
      id: traslado.id,
    }))

    const gastoRows: ExportRow[] = gastos.map((gasto) => ({
      tipo_movimiento: 'gasto',
      fecha: gasto.fecha || formatDate(gasto.created_at),
      concepto: getTipoGastoLabel(gasto.tipo),
      vehiculo: '',
      matricula: '',
      chofer_usuario: getNombrePerfil(gasto.perfiles),
      estado: '',
      estado_pago: '',
      ingreso: 0,
      gasto: normalizeNumber(gasto.importe),
      origen: '',
      destino: '',
      observaciones: gasto.descripcion || '',
      id: gasto.id,
    }))

    const rows = [...trasladoRows, ...gastoRows].sort(
      (a, b) => getDateTime(b.fecha) - getDateTime(a.fecha)
    )

    const csv = buildCsv(rows)
    const csvWithBom = `\uFEFF${csv}`
    const today = new Date().toISOString().split('T')[0]
    const fileName = `viagrua-respaldo-empresa-${today}.csv`

    return new Response(csvWithBom, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error exportando datos de empresa:', error)
    return NextResponse.json({ error: 'No se pudo generar el respaldo' }, { status: 500 })
  }
}

async function fetchTraslados(supabase: Awaited<ReturnType<typeof createClient>>, empresaId: string): Promise<TrasladoRecord[]> {
  const rows: TrasladoRecord[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('traslados')
      .select(`
        id,
        marca_modelo,
        matricula,
        estado,
        estado_pago,
        importe_total,
        observaciones,
        created_at,
        desde,
        hasta,
        perfiles(nombre_completo)
      `)
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error
    if (!data || data.length === 0) break

    rows.push(...(data as TrasladoRecord[]))

    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return rows
}

async function fetchGastos(supabase: Awaited<ReturnType<typeof createClient>>, empresaId: string): Promise<GastoRecord[]> {
  const rows: GastoRecord[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('gastos')
      .select(`
        id,
        tipo,
        importe,
        descripcion,
        fecha,
        created_at,
        perfiles(nombre_completo)
      `)
      .eq('empresa_id', empresaId)
      .order('fecha', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error
    if (!data || data.length === 0) break

    rows.push(...(data as GastoRecord[]))

    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return rows
}

function buildCsv(rows: ExportRow[]): string {
  const header = CSV_FIELDS.join(';')
  const body = rows.map((row) => CSV_FIELDS.map((field) => escapeCsvValue(row[field])).join(';'))
  return [header, ...body].join('\r\n')
}

function escapeCsvValue(value: string | number): string {
  const text = String(value)
  if (/[;"\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function formatDate(value: string | null | undefined): string {
  if (!value) return ''
  return value.split('T')[0] || ''
}

function getDateTime(value: string): number {
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

function normalizeNumber(value: number | string | null | undefined): number {
  const num = Number(value || 0)
  return Number.isFinite(num) ? num : 0
}

function getTipoGastoLabel(tipo: string | null | undefined): string {
  const labels: Record<string, string> = {
    combustible: 'Combustible',
    seguro: 'Seguro',
    mantenimiento: 'Mantenimiento',
    peaje: 'Peaje',
    patente: 'Patente',
    multa: 'Multa',
    otro: 'Otro',
  }

  return tipo ? labels[tipo] || tipo : ''
}

function getNombrePerfil(perfiles: PerfilRelacion | undefined): string {
  if (!perfiles) return ''

  if (Array.isArray(perfiles)) {
    return perfiles[0]?.nombre_completo || ''
  }

  return perfiles.nombre_completo || ''
}
