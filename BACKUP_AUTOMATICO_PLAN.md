# Plan tecnico: backup automatico gratuito

## Objetivo

Automatizar un respaldo periodico de los datos de cada empresa sin costo adicional, usando servicios que ya encajan con el stack actual:

- Next.js / Vercel para ejecutar una tarea programada.
- Supabase para consultar datos y guardar archivos.
- CSV como formato simple, portable y facil de abrir en Excel o Google Sheets.

El backup automatico no reemplaza un backup completo de PostgreSQL, pero sirve como respaldo operativo de traslados, gastos, ingresos y costos fuera de la interfaz de la app.

## Enfoque recomendado

Usar un cron gratuito que llame a un endpoint interno protegido:

```txt
Vercel Cron
  -> GET /api/backup/export
  -> valida CRON_SECRET
  -> genera CSV por empresa
  -> guarda archivos en Supabase Storage
```

## Por que esta opcion

- No requiere servidores propios.
- No requiere servicios pagos al inicio.
- Vercel Cron funciona bien para tareas simples.
- Supabase Storage permite guardar archivos privados.
- El CSV ya coincide con la exportacion manual implementada.
- Se puede limitar la retencion para no consumir demasiado storage.

## Alcance inicial

Implementar backups semanales por empresa.

Cada ejecucion debe generar un archivo CSV por empresa con:

- Traslados.
- Gastos.
- Ingresos por traslado.
- Costos por gasto.
- Usuario/chofer relacionado.

Ruta sugerida en Supabase Storage:

```txt
backups/{empresa_id}/viagrua-backup-YYYY-MM-DD.csv
```

Ejemplo:

```txt
backups/4e7f.../viagrua-backup-2026-05-05.csv
```

## Frecuencia recomendada

Para mantenerlo gratuito y liviano:

```txt
Semanal: lunes 03:00 UTC
```

Si en el futuro la app mueve muchos datos por dia, se puede cambiar a diario.

## Componentes necesarios

### 1. Bucket privado en Supabase Storage

Crear un bucket privado:

```txt
backups
```

Configuracion recomendada:

- Public bucket: no.
- Acceso directo desde navegador: no.
- Subidas solamente desde server usando `SUPABASE_SERVICE_ROLE_KEY`.

### 2. Variable secreta para cron

Crear una variable de entorno:

```txt
CRON_SECRET=valor-largo-random
```

Debe estar configurada en Vercel y tambien en local si se quiere probar el endpoint.

### 3. Endpoint interno

Crear:

```txt
app/api/backup/export/route.ts
```

Este endpoint debe:

1. Validar `Authorization: Bearer <CRON_SECRET>`.
2. Usar `supabaseAdmin`.
3. Consultar todas las empresas.
4. Generar un CSV por empresa.
5. Subir cada CSV al bucket privado `backups`.
6. Eliminar backups viejos para controlar espacio.
7. Devolver un resumen JSON de la ejecucion.

## Seguridad

El endpoint no debe depender de sesion de usuario porque lo ejecuta un cron.

Validacion recomendada:

```ts
const authHeader = request.headers.get('authorization')
const expected = `Bearer ${process.env.CRON_SECRET}`

if (!process.env.CRON_SECRET || authHeader !== expected) {
  return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
}
```

Reglas importantes:

- No aceptar `empresa_id` desde query params para backups globales.
- No exponer archivos en bucket publico.
- No usar `NEXT_PUBLIC_SUPABASE_ANON_KEY` para escribir backups.
- No loguear el `CRON_SECRET`.

## Configuracion Vercel Cron

Crear o actualizar:

```txt
vercel.json
```

Contenido sugerido:

```json
{
  "crons": [
    {
      "path": "/api/backup/export",
      "schedule": "0 3 * * 1"
    }
  ]
}
```

Esto ejecuta el backup todos los lunes a las 03:00 UTC.

## Headers de autenticacion en Vercel Cron

Vercel Cron llama el endpoint sin headers personalizados por defecto. Para mantener el endpoint protegido hay dos opciones:

### Opcion A: usar `CRON_SECRET` nativo de Vercel

Vercel Cron envia automaticamente este header si existe la variable `CRON_SECRET`:

```txt
Authorization: Bearer $CRON_SECRET
```

Esta es la opcion recomendada.

### Opcion B: endpoint con token en query param

No recomendada salvo que sea necesario:

```txt
/api/backup/export?secret=...
```

Es menos prolija porque el secreto puede quedar registrado en logs o historiales.

## Datos a exportar

Reutilizar el mismo formato de la exportacion manual:

```csv
tipo_movimiento;fecha;concepto;vehiculo;matricula;chofer_usuario;estado;estado_pago;ingreso;gasto;origen;destino;observaciones;id
```

Esto mantiene consistencia entre:

- Exportacion manual desde dashboard.
- Backup automatico semanal.

## Consultas necesarias

### Empresas

```ts
const { data: empresas, error } = await supabaseAdmin
  .from('empresas')
  .select('id, nombre')
```

### Traslados por empresa

```ts
const { data: traslados, error } = await supabaseAdmin
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
```

### Gastos por empresa

```ts
const { data: gastos, error } = await supabaseAdmin
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
```

## Paginacion interna

Para evitar limites de Supabase, usar paginacion por bloques de 1000 filas.

Patron recomendado:

```ts
const PAGE_SIZE = 1000

async function fetchAllRows<T>(buildQuery: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = []
  let from = 0

  while (true) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1)
    if (error) throw error
    if (!data || data.length === 0) break

    rows.push(...data)

    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return rows
}
```

## Subida a Supabase Storage

Subir cada CSV al bucket `backups`:

```ts
const path = `${empresaId}/viagrua-backup-${today}.csv`

const { error } = await supabaseAdmin.storage
  .from('backups')
  .upload(path, csvWithBom, {
    contentType: 'text/csv; charset=utf-8',
    upsert: true,
  })
```

Usar `upsert: true` permite reintentar el backup del mismo dia sin duplicar archivos.

## Retencion de backups

Para mantenerlo gratis, conservar pocos archivos.

Recomendacion inicial:

```txt
Conservar los ultimos 8 backups por empresa
```

Esto equivale aproximadamente a dos meses de backups semanales.

Logica sugerida:

1. Listar archivos de `backups/{empresa_id}`.
2. Ordenar por nombre descendente o por `created_at` descendente.
3. Mantener los primeros 8.
4. Eliminar el resto.

Ejemplo:

```ts
const { data: files } = await supabaseAdmin.storage
  .from('backups')
  .list(empresaId)

const oldFiles = (files || [])
  .filter((file) => file.name.endsWith('.csv'))
  .sort((a, b) => b.name.localeCompare(a.name))
  .slice(8)

if (oldFiles.length > 0) {
  await supabaseAdmin.storage
    .from('backups')
    .remove(oldFiles.map((file) => `${empresaId}/${file.name}`))
}
```

## Respuesta del endpoint

Devolver JSON con resumen:

```json
{
  "ok": true,
  "date": "2026-05-05",
  "companiesProcessed": 3,
  "filesCreated": 3,
  "errors": []
}
```

Si falla una empresa, conviene continuar con las demas y registrar el error en el resumen.

## Manejo de errores

Estrategia recomendada:

- Si falla la autenticacion: responder `401` y no ejecutar nada.
- Si falla consultar empresas: responder `500`.
- Si falla una empresa puntual: guardar el error en array y seguir con la siguiente.
- Si ninguna empresa pudo exportarse: responder `500`.
- Si al menos una empresa se exporto: responder `200` con errores parciales.

## Variables necesarias

En Vercel:

```txt
CRON_SECRET=valor-largo-random
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

`SUPABASE_SERVICE_ROLE_KEY` ya existe en el proyecto para otros endpoints server-side.

## Prueba manual local

Con servidor local corriendo:

```bash
npm run dev
```

Probar:

```bash
curl -H "Authorization: Bearer TU_CRON_SECRET" http://localhost:3000/api/backup/export
```

Verificar en Supabase Storage:

```txt
backups/{empresa_id}/viagrua-backup-YYYY-MM-DD.csv
```

## Prueba en produccion

Usar el dominio real:

```bash
curl -H "Authorization: Bearer TU_CRON_SECRET" https://tu-dominio.com/api/backup/export
```

Luego revisar:

- Logs de Vercel.
- Archivos en Supabase Storage.
- Que el CSV abra bien en Excel/Sheets.

## Checklist de implementacion

1. Crear bucket privado `backups` en Supabase Storage.
2. Agregar `CRON_SECRET` en Vercel.
3. Crear `app/api/backup/export/route.ts`.
4. Validar `Authorization: Bearer ${CRON_SECRET}`.
5. Consultar empresas con `supabaseAdmin`.
6. Reutilizar o duplicar minimamente la logica de CSV de `/api/export/empresa`.
7. Generar CSV por empresa.
8. Subir CSV al bucket `backups`.
9. Implementar retencion de ultimos 8 backups por empresa.
10. Crear o actualizar `vercel.json` con el cron semanal.
11. Probar endpoint manualmente en local.
12. Probar endpoint manualmente en produccion.
13. Verificar ejecucion automatica desde Vercel Cron.

## Criterio de listo

La automatizacion se considera lista cuando:

- El cron se ejecuta sin intervencion manual.
- Cada empresa genera su CSV semanal.
- Los archivos quedan guardados en bucket privado `backups`.
- Los backups viejos se limpian automaticamente.
- El endpoint rechaza llamadas sin `CRON_SECRET`.
- El CSV descargado desde Storage abre correctamente en Excel o Google Sheets.

## Mejoras futuras

- Agregar pantalla admin para listar y descargar backups guardados.
- Enviar notificacion por email cuando falla el backup.
- Generar ZIP con varios CSV por empresa.
- Agregar backup tecnico de PostgreSQL si el proyecto crece.
- Comprimir CSV con gzip si los archivos crecen mucho.
