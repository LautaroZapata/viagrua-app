# ViaGrua

Sistema de gestion de traslados vehiculares para empresas de gruas. Permite administrar traslados, choferes y gastos desde una interfaz web moderna y responsive.

## Tecnologias

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript
- **Estilos:** Tailwind CSS 4, shadcn/ui (New York style)
- **Charts:** Tremor
- **Backend:** Supabase (Auth, PostgreSQL, Storage, Realtime)
- **UI:** Sonner toasts, Lucide icons, next-themes dark mode
- **Seguridad:** Validacion y sanitizacion de inputs, rate limiting, audit logging
- **Package Manager:** pnpm

## Caracteristicas principales

### Panel de Administrador (`/dashboard`)
- **Dashboard** con estadisticas en tiempo real (traslados pendientes, en curso, completados)
- **Charts** de ingresos vs gastos con Tremor
- **Gestion de traslados:** crear, editar estado, eliminar, ver detalle con fotos
- **Gestion de choferes:** invitar por codigo/link, expulsar
- **Filtros:** traslados pendientes y pagos pendientes (independientes)
- **Paginacion** server-side con Supabase `.range()`
- **Modo Chofer:** el admin puede alternar a vista de chofer

### Panel de Chofer (`/chofer`)
- Ver traslados asignados con filtros y paginacion
- Actualizar estado de traslados (pendiente -> en curso -> completado)
- Unirse a empresa mediante codigo de invitacion
- Actualizaciones en tiempo real via Supabase Realtime

### Gastos (`/dashboard/gastos`)
- Registro de gastos por categoria (combustible, seguro, mantenimiento, peaje, patente, multa, otro)
- Vista admin: todos los gastos de la empresa con totales
- Vista chofer: movimientos propios (ingresos por traslados + gastos)
- Cards expandibles para ver descripcion completa
- Filtros por tipo y orden, paginacion

### Traslados
- Campos: marca/modelo, matricula, 0km, chofer asignado, importe, origen/destino, observaciones
- Fotos: frontal, lateral, trasera, interior (con compresion automatica)
- Estados: pendiente -> en curso -> completado (bloqueo al completar)
- Estado de pago: pendiente / pagado
- Detalle con galeria de fotos ampliable

### Otras caracteristicas
- Autenticacion con email/password via Supabase Auth
- Registro de empresa con creacion automatica de perfil admin
- Suscripciones Realtime para actualizaciones instantaneas
- Dark mode con next-themes (system/light/dark)
- Actualizaciones optimistas en la UI
- Consultas paralelas con `Promise.all` para mejor rendimiento
- Diseno responsive (mobile-first con Sheet/drawer navigation)
- Exportacion de datos a CSV

## Estructura del proyecto

```
app/
├── page.tsx                    # Registro de empresa
├── login/page.tsx              # Inicio de sesion
├── layout.tsx                  # Root layout con Providers
├── providers.tsx               # ThemeProvider + TooltipProvider
├── dashboard/
│   ├── page.tsx                # Panel admin (inicio, traslados, choferes)
│   ├── nuevo-traslado/page.tsx # Formulario nuevo traslado
│   ├── traslado/[id]/page.tsx  # Detalle de traslado
│   └── gastos/page.tsx         # Gestion de gastos
├── chofer/page.tsx             # Panel de chofer
├── components/                 # App-level components
│   ├── AppNavbar.tsx
│   ├── DashboardCharts.tsx     # Tremor charts
│   ├── MobileDrawer.tsx        # shadcn Sheet
│   ├── ThemeToggle.tsx         # next-themes toggle
│   ├── Pagination.tsx          # shadcn Button pagination
│   └── skeletons.tsx           # shadcn Skeleton loaders
└── api/                        # API routes
    ├── create-traslado-safe/
    ├── auth/login/
    ├── gastos/
    └── export/empresa/
components/
├── ui/                         # shadcn/ui components
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   ├── sheet.tsx
│   ├── skeleton.tsx
│   └── ...
└── PwaRegister.tsx
lib/
├── utils.ts                    # cn() utility for tailwind-merge
├── supabase.ts                 # Cliente Supabase
├── supabaseAdmin.ts            # Cliente admin
├── validation.ts               # Validacion y sanitizacion
├── audit.ts                    # Audit logging
├── rateLimit.ts                # Rate limiting
├── compressImage.ts            # Compresion de imagenes
├── swal.ts                     # Toast helpers (Sonner)
└── useSupabaseQuery.ts         # SWR hooks
```

## Instalacion

```bash
# Clonar el repositorio
git clone <url-del-repo>
cd viagrua-app

# Instalar dependencias
pnpm install

# Configurar variables de entorno
# Crear .env.local con las credenciales de Supabase:
# NEXT_PUBLIC_SUPABASE_URL=tu-url
# NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
# SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
# NEXT_PUBLIC_APP_URL=http://localhost:3000

# Iniciar servidor de desarrollo
pnpm dev
```

Abrir [http://localhost:3000](http://localhost:3000) en el navegador.

## Scripts

| Comando | Descripcion |
|---------|-------------|
| `pnpm dev` | Servidor de desarrollo (Turbopack) |
| `pnpm build` | Build de produccion |
| `pnpm start` | Servidor de produccion |
| `pnpm test` | Ejecutar tests (Vitest) |
| `pnpm lint` | Linter (ESLint) |
