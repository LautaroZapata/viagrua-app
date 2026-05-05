# Plan tecnico: exportacion CSV de respaldo

## Objetivo

Implementar una exportacion CSV para que el administrador de una empresa pueda descargar un respaldo de sus datos principales:

- Traslados.
- Gastos.
- Costos e ingresos asociados.
- Chofer/usuario relacionado a cada movimiento.

La exportacion debe servir como respaldo externo a la app y poder abrirse facilmente en Excel, Google Sheets o cualquier sistema contable basico.

## Enfoque recomendado

Crear un endpoint server-side en Next.js:

```txt
GET /api/export/empresa
```

Este endpoint valida la sesion, verifica que el usuario sea administrador, obtiene la empresa asociada y genera un CSV descargable con todos los movimientos de esa empresa.

No conviene generar el CSV directamente desde el frontend porque las pantallas actuales usan paginacion y limites de carga. El respaldo debe consultar la base completa desde el servidor.

## Alcance inicial

Exportar un CSV unificado de movimientos con traslados y gastos en el mismo archivo.

Archivo sugerido:

```txt
viagrua-respaldo-empresa-YYYY-MM-DD.csv
```

Columnas recomendadas:

```csv
tipo_movimiento;fecha;concepto;vehiculo;matricula;chofer_usuario;estado;estado_pago;ingreso;gasto;origen;destino;observaciones;id
```

Ejemplo:

```csv
tipo_movimiento;fecha;concepto;vehiculo;matricula;chofer_usuario;estado;estado_pago;ingreso;gasto;origen;destino;observaciones;id
traslado;2026-05-01;Toyota Corolla;Toyota Corolla;ABC123;Juan Perez;completado;efectivo;50000;0;CABA;La Plata;;uuid-1
gasto;2026-05-02;Combustible;;;Juan Perez;;;0;15000;;;Carga de combustible;uuid-2
```

## Permisos y seguridad

El endpoint debe cumplir estas reglas:

1. Rechazar usuarios sin sesion con `401`.
2. Rechazar usuarios que no tengan perfil con `403`.
3. Rechazar usuarios que no sean `admin` con `403`.
4. Exportar solamente datos cuyo `empresa_id` coincida con el perfil autenticado.
5. No aceptar `empresa_id` desde query params ni desde el body.
6. No usar el cliente publico del navegador para generar el respaldo.

La empresa se debe resolver asi:

```ts
const { data: perfil } = await supabase
  .from('perfiles')
  .select('id, empresa_id, rol')
  .eq('id', user.id)
  .single()
```

## Endpoint propuesto

Crear archivo:

```txt
app/api/export/empresa/route.ts
```

Estructura base:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
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

  // Consultar datos, transformar filas y devolver CSV.
}
```

## Consultas necesarias

### Traslados

Campos usados actualmente por la app:

- `id`
- `empresa_id`
- `chofer_id`
- `marca_modelo`
- `matricula`
- `es_0km`
- `estado`
- `estado_pago`
- `importe_total`
- `observaciones`
- `created_at`
- `desde`
- `hasta`
- relacion `perfiles(nombre_completo)`

Consulta sugerida:

```ts
const { data: traslados, error: trasladosError } = await supabase
  .from('traslados')
  .select(`
    id,
    marca_modelo,
    matricula,
    es_0km,
    estado,
    estado_pago,
    importe_total,
    observaciones,
    created_at,
    desde,
    hasta,
    perfiles(nombre_completo)
  `)
  .eq('empresa_id', perfil.empresa_id)
  .order('created_at', { ascending: false })
```

### Gastos

Campos usados actualmente por la app:

- `id`
- `empresa_id`
- `usuario_id`
- `tipo`
- `importe`
- `descripcion`
- `fecha`
- `created_at`
- relacion `perfiles(nombre_completo)`

Consulta sugerida:

```ts
const { data: gastos, error: gastosError } = await supabase
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
  .eq('empresa_id', perfil.empresa_id)
  .order('fecha', { ascending: false })
```

## Transformacion a filas CSV

Crear un tipo interno para filas:

```ts
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
```

Mapeo de traslados:

```ts
const trasladoRows: ExportRow[] = (traslados || []).map((traslado) => ({
  tipo_movimiento: 'traslado',
  fecha: formatDate(traslado.created_at),
  concepto: traslado.marca_modelo || '',
  vehiculo: traslado.marca_modelo || '',
  matricula: traslado.matricula || '',
  chofer_usuario: getNombrePerfil(traslado.perfiles),
  estado: traslado.estado || '',
  estado_pago: traslado.estado_pago || '',
  ingreso: Number(traslado.importe_total || 0),
  gasto: 0,
  origen: traslado.desde || '',
  destino: traslado.hasta || '',
  observaciones: traslado.observaciones || '',
  id: traslado.id,
}))
```

Mapeo de gastos:

```ts
const gastoRows: ExportRow[] = (gastos || []).map((gasto) => ({
  tipo_movimiento: 'gasto',
  fecha: gasto.fecha || formatDate(gasto.created_at),
  concepto: getTipoGastoLabel(gasto.tipo),
  vehiculo: '',
  matricula: '',
  chofer_usuario: getNombrePerfil(gasto.perfiles),
  estado: '',
  estado_pago: '',
  ingreso: 0,
  gasto: Number(gasto.importe || 0),
  origen: '',
  destino: '',
  observaciones: gasto.descripcion || '',
  id: gasto.id,
}))
```

Orden final sugerido:

```ts
const rows = [...trasladoRows, ...gastoRows].sort(
  (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
)
```

## Generacion CSV

El proyecto ya tiene `json2csv` instalado.

Opcion recomendada:

```ts
import { Parser } from 'json2csv'
```

Configuracion sugerida:

```ts
const fields = [
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

const parser = new Parser({ fields, delimiter: ';' })
const csv = parser.parse(rows)
```

Para que Excel detecte bien caracteres especiales, devolver el CSV con BOM UTF-8:

```ts
const csvWithBom = `\uFEFF${csv}`
```

Respuesta del endpoint:

```ts
const today = new Date().toISOString().split('T')[0]
const fileName = `viagrua-respaldo-empresa-${today}.csv`

return new Response(csvWithBom, {
  headers: {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${fileName}"`,
    'Cache-Control': 'no-store',
  },
})
```

## Helpers recomendados

Mantenerlos dentro del endpoint al principio, salvo que luego se reutilicen.

```ts
function formatDate(value: string | null | undefined): string {
  if (!value) return ''
  return value.split('T')[0] || ''
}
```

```ts
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
```

Supabase a veces devuelve relaciones como objeto o array dependiendo del tipado inferido. Usar un helper defensivo:

```ts
function getNombrePerfil(perfiles: unknown): string {
  if (!perfiles) return ''

  if (Array.isArray(perfiles)) {
    const first = perfiles[0] as { nombre_completo?: string } | undefined
    return first?.nombre_completo || ''
  }

  return (perfiles as { nombre_completo?: string }).nombre_completo || ''
}
```

## Boton en el dashboard

Agregar una accion visible para administradores en `app/dashboard/page.tsx`.

Ubicacion sugerida:

- Cerca del boton `Nuevo Traslado`.
- O en la seccion de inicio junto a los indicadores.

Implementacion simple:

```tsx
<a
  href="/api/export/empresa"
  className="btn-secondary py-2.5 px-4 text-sm text-center"
>
  Exportar CSV
</a>
```

Si se quiere controlar estado de carga, usar `window.location.href = '/api/export/empresa'`, pero para la primera version el link directo alcanza.

## Manejo de errores en UI

Con link directo, si falla la autorizacion el navegador vera JSON de error. Para mejor experiencia, una segunda iteracion puede usar `fetch` y descargar Blob:

```ts
const descargarCsv = async () => {
  const response = await fetch('/api/export/empresa')

  if (!response.ok) {
    showError('No se pudo exportar el respaldo')
    return
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `viagrua-respaldo-empresa-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
```

Para mantener la primera implementacion simple, se recomienda empezar con el `<a href="/api/export/empresa">`.

## Escalabilidad

Supabase puede limitar la cantidad de filas devueltas por consulta segun configuracion del proyecto. Para empresas con pocos datos, una consulta directa alcanza. Para respaldo robusto, conviene paginar internamente.

Patron recomendado para mas adelante:

```ts
async function fetchAllRows<T>(buildQuery: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>) {
  const pageSize = 1000
  let from = 0
  const rows: T[] = []

  while (true) {
    const { data, error } = await buildQuery(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break

    rows.push(...data)

    if (data.length < pageSize) break
    from += pageSize
  }

  return rows
}
```

Para la primera version, si se quiere evitar limites desde el inicio, aplicar este patron a `traslados` y `gastos`.

## Filtros opcionales para una segunda etapa

Agregar query params opcionales:

```txt
GET /api/export/empresa?desde=2026-01-01&hasta=2026-05-05
```

Validaciones:

- `desde` y `hasta` deben cumplir formato `YYYY-MM-DD`.
- Si no vienen, exportar todo.
- No permitir fechas invalidas.

Aplicacion en consultas:

```ts
if (desde) query = query.gte('created_at', `${desde}T00:00:00.000Z`)
if (hasta) query = query.lte('created_at', `${hasta}T23:59:59.999Z`)
```

En gastos, filtrar por `fecha`:

```ts
if (desde) query = query.gte('fecha', desde)
if (hasta) query = query.lte('fecha', hasta)
```

## Alternativa futura: ZIP con varios CSV

Si despues hace falta un respaldo mas contable o tecnico, se puede exportar un ZIP con archivos separados:

- `traslados.csv`
- `gastos.csv`
- `choferes.csv`
- `resumen.csv`

No se recomienda empezar por ZIP porque agrega complejidad y otra dependencia. El CSV unificado cubre mejor la necesidad inicial.

## Checklist de implementacion

1. Crear `app/api/export/empresa/route.ts`.
2. Validar sesion con `createClient()` server-side.
3. Obtener perfil del usuario autenticado.
4. Verificar `perfil.rol === 'admin'`.
5. Consultar traslados de `perfil.empresa_id`.
6. Consultar gastos de `perfil.empresa_id`.
7. Transformar ambos datasets a `ExportRow`.
8. Ordenar filas por fecha descendente.
9. Generar CSV con `json2csv` y delimitador `;`.
10. Agregar BOM UTF-8.
11. Devolver `Response` con headers de descarga.
12. Agregar boton `Exportar CSV` en dashboard admin.
13. Probar descarga con usuario admin.
14. Probar que usuario chofer recibe `403`.
15. Probar que el CSV abre correctamente en Excel/Sheets.

## Pruebas manuales recomendadas

1. Admin con traslados y gastos: descarga archivo con ambos tipos de filas.
2. Admin sin datos: descarga CSV con encabezados y cero filas.
3. Chofer: no puede descargar respaldo.
4. Usuario sin sesion: recibe `401`.
5. Traslado con importe `null`: exporta ingreso `0`.
6. Gasto sin descripcion: exporta observaciones vacias.
7. Texto con coma, punto y coma o salto de linea: queda correctamente escapado por `json2csv`.

## Criterio de listo

La funcionalidad se considera lista cuando:

- El administrador puede descargar un CSV desde el dashboard.
- El CSV contiene todos los traslados y gastos de su empresa.
- Los importes quedan separados en columnas `ingreso` y `gasto`.
- Los choferes no pueden acceder a la exportacion.
- El archivo abre correctamente en Excel o Google Sheets.
