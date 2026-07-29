# Estrategia de producto — ViaGrúa

> Documento de planificación para la salida a producción.
> Mercado inicial: Uruguay. Expansión futura: Argentina y LATAM.

---

## 1. Visión del producto

Plataforma SaaS para la gestión de flotas de grúas y vehículos de auxilio.
Unifica en una sola app lo que hoy los dueños manejan por WhatsApp, Excel y libreta.

### Perfiles target

| Perfil | Descripción | Plan |
|---|---|---|
| **Operador individual** | Dueño que maneja su propia grúa. Necesita llevar la cuenta de sus traslados, gastos y cobros. | Free |
| **Flota chica (2-10 grúas)** | Dueño que no maneja, tiene choferes a cargo. Necesita controlar qué hace cada chofer y la rentabilidad del negocio. | Premium |
| **Flota mediana (10+ grúas)** | Dueño con despachador y taller. Necesita gestión de clientes, presupuestos y facturación. | Enterprise (futuro) |

### Diferenciador

- **Dos paneles en uno**: administrador y chofer en la misma app
- **Sin instalación**: PWA, funciona en el celular sin pasar por Play Store
- **Offline-first**: el chofer puede trabajar sin señal
- **Hecho para LATAM**: precios en USD, orientado al dueño de flota real

---

## 2. Identidad de marca

### Actual (se mantiene)

| Elemento | Valor |
|---|---|
| **Color primary** | `#FF7A00` (naranja) — transmite energía, alerta, acción |
| **Paleta** | Naranja + blanco/grises + negro/navy |
| **Estilo** | Profesional, moderno, limpio (shadcn/ui base) |
| **Sidebar** | Siempre oscura, con acento naranja |
| **Dark mode** | Soportado vía next-themes |

### Por definir

| Elemento | Acción |
|---|---|
| **Logo** | Isotipo simple (grúa estilizada o flecha + ruta) + logotipo "ViaGrúa" |
| **Tagline** | Pendiente de definir. Opciones: |
| | *"Gestioná tu flota desde el celular"* |
| | *"Traslados simples, control total"* |
| | *"La grúa en tu bolsillo"* |
| **Favicon** | Generar a partir del isotipo |
| **PWA icons** | Actualizar con el nuevo logo |
| **Tipografía** | Mantener la actual (sistema + variable para display) |

### Tono de voz

- Directo, sin vueltas (el dueño de grúa no tiene tiempo)
- Profesional pero no corporativo
- En español neutro, pensado para Uruguay primero

---

## 3. Pricing

| Plan | Precio | Admin | Choferes | Traslados | Export CSV | Analytics | Clientes |
|---|---|---|---|---|---|---|---|
| **Free** | $0 USD/mes | 1 | 1 | 15/mes | ❌ | Básico | ❌ |
| **Premium** | $15 USD/mes | 1 | Ilimitados | Ilimitados | ✅ | Completo | ❌ |
| **Enterprise** | $50 USD/mes | 1+ | Ilimitados | Ilimitados | ✅ | Completo | ✅ |

> Los precios en USD porque Uruguay es dolarizado de facto. $15 USD es un café para un negocio que factura $3000-5000 por grúa al mes.

### Criterios de upgrade

- Free → Premium: cuando el dueño agrega un segundo chofer o supera los 15 traslados mensuales
- Premium → Enterprise: cuando necesita gestionar clientes o facturación DGI

---

## 4. Roadmap

### Fase 1 — Branding (1-2 días)

- [ ] Diseñar isotipo + logotipo "ViaGrúa"
- [ ] Definir tagline definitivo
- [ ] Generar favicon y PWA icons
- [ ] Actualizar `app/manifest.ts` con los nuevos icons
- [ ] Actualizar `app/icon.tsx` y `app/apple-icon.tsx`

### Fase 2 — Landing page (3-5 días)

- [ ] Rediseñar `app/page.tsx` con:
  - Hero section con título + subtítulo + CTA "Comenzá gratis"
  - Features: 3-4 cards con lo que hace la app
  - "Cómo funciona": paso a paso simple
  - Pricing comparison (Free vs Premium)
  - Footer con contacto / redes
- [ ] Asegurar que la landing tenga buen SEO on-page

### Fase 3 — Pricing (2-3 días)

- [ ] Implementar lógica de límites según plan en el backend
  - Contar traslados del mes por empresa
  - Bloquear creación si excede el límite free
  - Bloquear invitación de más de 1 chofer en free
- [ ] Mostrar el plan actual en el dashboard
- [ ] Agregar pantalla de upgrade / selección de plan

### Fase 4 — Landing para el cliente final (posterior)

- [ ] Pagina pública de seguimiento de traslado (sin login)
  - El admin comparte un link al cliente
  - El cliente ve estado, fotos, ubicación del chofer

### Fase 5 — Legal (1 día)

- [ ] Términos de Servicio (`/terminos`)
- [ ] Política de Privacidad (`/privacidad`)
- [ ] Adecuación a normativa uruguaya (Ley de Protección de Datos Personales N° 18.331)

---

## 5. Marketing

### Canales para Uruguay

| Canal | Por qué |
|---|---|
| **Grupos de WhatsApp de transportistas** | El dueño de grúa vive en WhatsApp |
| **Facebook / Marketplace** | Muchos grupos de transporte y grúas en Uruguay |
| **Google Ads** | Keywords: "software para grúas", "app para gestión de flota", "programa para remolques" |
| **Venta directa** | Identificar grúas en Google Maps, contactar por WhatsApp |
| **Referidos** | Dar 1 mes gratis por cada empresa que refiera |

### Contenido

- Posts cortos que muestren el problema: "¿Tus choferes laburan o no? Sabé exactamente qué hace cada uno"
- Comparativas: "Lo que hacés hoy vs ViaGrúa"
- Testimonials futuros de los primeros usuarios

### Target geográfico inicial

- Montevideo + Canelones (60% de las grúas del país)
- Dueños de 2 a 5 grúas (el sweet spot)

---

## 6. KPIs para medir

| Métrica | Objetivo |
|---|---|
| Empresas registradas (free) | 50 en el primer mes |
| Conversión free → premium | 15-20% |
| Traslados creados/día | > 100/día |
| Choferes activos por empresa | > 2 en premium |
| Retention a 30 días | > 70% |
| CAC (costo de adquisición) | < $10 USD |
| LTV (life time value) | > $180 USD (1 año de premium) |

---

## 7. Preguntas abiertas

- [ ] Dominio: pendiente de definir (`viagrua.app`, `viagrua.com.uy`, etc.)
- [ ] Pasarela de pagos: MercadoPago Uruguay vs dLocal vs Stripe
- [ ] Facturación: integrar CFE (comprobante fiscal electrónico) de DGI a futuro
- [ ] App nativa o seguir como PWA por ahora
