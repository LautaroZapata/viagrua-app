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
  'tipo_movimiento', 'fecha', 'concepto', 'vehiculo', 'matricula',
  'chofer_usuario', 'estado', 'estado_pago', 'ingreso', 'gasto',
  'origen', 'destino', 'observaciones', 'id',
]

const PAGE_SIZE = 1000
const encoder = new TextEncoder()

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

    const empresaId = perfil.empresa_id
    const today = new Date().toISOString().split('T')[0]
    const fileName = `viagrua-respaldo-empresa-${today}.csv`

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const header = CSV_FIELDS.join(';') + '\r\n'
          controller.enqueue(encoder.encode('\uFEFF' + header))

          await streamFetchTraslados(supabase, empresaId, controller)
          await streamFetchGastos(supabase, empresaId, controller)

          controller.close()
        } catch (err) {
          controller.error(err)
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (error) {
    console.error('Error exportando datos de empresa:', error)
    return NextResponse.json({ error: 'No se pudo generar el respaldo' }, { status: 500 })
  }
}

async function streamFetchTraslados(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string,
  controller: ReadableStreamDefaultController<Uint8Array>
) {
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('traslados')
      .select(`
        id, marca_modelo, matricula, estado, estado_pago,
        importe_total, observaciones, created_at, desde, hasta,
        perfiles(nombre_completo)
      `)
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error
    if (!data || data.length === 0) break

    for (const t of data as TrasladoRecord[]) {
      const row: ExportRow = {
        tipo_movimiento: 'traslado',
        fecha: formatDate(t.created_at),
        concepto: t.marca_modelo || '',
        vehiculo: t.marca_modelo || '',
        matricula: t.matricula || '',
        chofer_usuario: getNombrePerfil(t.perfiles),
        estado: t.estado || '',
        estado_pago: t.estado_pago || '',
        ingreso: normalizeNumber(t.importe_total),
        gasto: 0,
        origen: t.desde || '',
        destino: t.hasta || '',
        observaciones: t.observaciones || '',
        id: t.id,
      }
      const line = CSV_FIELDS.map((f) => escapeCsvValue(row[f])).join(';') + '\r\n'
      controller.enqueue(encoder.encode(line))
    }

    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
}

async function streamFetchGastos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string,
  controller: ReadableStreamDefaultController<Uint8Array>
) {
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('gastos')
      .select(`
        id, tipo, importe, descripcion, fecha, created_at,
        perfiles(nombre_completo)
      `)
      .eq('empresa_id', empresaId)
      .order('fecha', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error
    if (!data || data.length === 0) break

    for (const g of data as GastoRecord[]) {
      const row: ExportRow = {
        tipo_movimiento: 'gasto',
        fecha: g.fecha || formatDate(g.created_at),
        concepto: getTipoGastoLabel(g.tipo),
        vehiculo: '',
        matricula: '',
        chofer_usuario: getNombrePerfil(g.perfiles),
        estado: '',
        estado_pago: '',
        ingreso: 0,
        gasto: normalizeNumber(g.importe),
        origen: '',
        destino: '',
        observaciones: g.descripcion || '',
        id: g.id,
      }
      const line = CSV_FIELDS.map((f) => escapeCsvValue(row[f])).join(';') + '\r\n'
      controller.enqueue(encoder.encode(line))
    }

    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
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
