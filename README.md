# ViaGrua

Sistema de gestión de traslados vehiculares para empresas de grúas. Permite administrar traslados, choferes y gastos desde una interfaz web moderna y responsive.

## Tecnologías

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript
- **Estilos:** Tailwind CSS 4
- **Backend:** Supabase (Auth, PostgreSQL, Storage, Realtime)
- **UI:** SweetAlert2 para confirmaciones, diseño mobile-first responsive
- **Seguridad:** Validación y sanitización de inputs, reCAPTCHA

## Características principales

### Panel de Administrador (`/dashboard`)
- **Dashboard** con estadísticas en tiempo real (traslados pendientes, en curso, completados)
- **Gestión de traslados:** crear, editar estado, eliminar, ver detalle con fotos
- **Gestión de choferes:** invitar por código/link, expulsar
- **Filtros:** traslados pendientes y pagos pendientes (independientes)
- **Paginación** server-side con Supabase `.range()`
- **Modo Chofer:** el admin puede alternar a vista de chofer

### Panel de Chofer (`/chofer`)
- Ver traslados asignados con filtros y paginación
- Actualizar estado de traslados (pendiente → en curso → completado)
- Unirse a empresa mediante código de invitación
- Actualizaciones en tiempo real vía Supabase Realtime

### Gastos (`/dashboard/gastos`)
- Registro de gastos por categoría (combustible, seguro, mantenimiento, peaje, patente, multa, otro)
- Vista admin: todos los gastos de la empresa con totales
- Vista chofer: movimientos propios (ingresos por traslados + gastos)
- Cards expandibles para ver descripción completa
- Filtros por tipo y orden, paginación

### Traslados
- Campos: marca/modelo, matrícula, 0km, chofer asignado, importe, origen/destino, observaciones
- Fotos: frontal, lateral, trasera, interior (con compresión automática)
- Estados: pendiente → en curso → completado (bloqueo al completar)
- Estado de pago: pendiente / pagado
- Detalle con galería de fotos ampliable

### Planes
- **Free:** hasta 30 traslados/mes, sin agregar choferes
- **Premium:** traslados ilimitados, gestión de choferes

### Otras características
- Autenticación con email/password vía Supabase Auth
- Registro de empresa con creación automática de perfil admin
- Suscripciones Realtime para actualizaciones instantáneas
- Actualizaciones optimistas en la UI
- Consultas paralelas con `Promise.all` para mejor rendimiento
- Diseño responsive (mobile-first con drawer navigation)
- Exportación de datos

## Estructura del proyecto

```
app/
├── page.tsx                    # Registro de empresa
├── login/page.tsx              # Inicio de sesión
├── dashboard/
│   ├── page.tsx                # Panel admin (inicio, traslados, choferes)
│   ├── nuevo-traslado/page.tsx # Formulario nuevo traslado
│   ├── traslado/[id]/page.tsx  # Detalle de traslado
│   └── gastos/page.tsx         # Gestión de gastos
├── chofer/page.tsx             # Panel de chofer
├── components/ClientOnly.tsx   # Wrapper client-side
└── api/create-traslado-safe/   # API routes
lib/
├── supabase.ts                 # Cliente Supabase
├── supabaseAdmin.ts            # Cliente admin
├── validation.ts               # Validación y sanitización
├── compressImage.ts            # Compresión de imágenes
└── swal.ts                     # Helpers SweetAlert2
```

## Instalación

```bash
# Clonar el repositorio
git clone <url-del-repo>
cd viagrua-app

# Instalar dependencias
npm install

# Configurar variables de entorno
# Crear .env.local con las credenciales de Supabase:
# NEXT_PUBLIC_SUPABASE_URL=tu-url
# NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
# SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key

# Iniciar servidor de desarrollo
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000) en el navegador.

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo (Turbopack) |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción |
