# Manual de Usuario - ViaGrua

## Introduccion

ViaGrua es una plataforma web para gestionar los traslados de vehiculos de tu empresa de gruas. Desde aqui podras crear traslados, asignarlos a choferes, controlar gastos y llevar un registro completo de tu operacion.

---

## 1. Registro e Inicio de Sesion

### Registrar tu empresa

1. Ingresa a la pagina principal de ViaGrua.
2. Completa el formulario con:
   - **Nombre de la empresa**
   - **Tu nombre completo** (seras el administrador)
   - **Email**
   - **Contrasena** (minimo 6 caracteres)
3. Presiona **Registrar**. Se creara tu cuenta y tu empresa automaticamente.

### Iniciar sesion

1. Ve a la pagina de **Login**.
2. Ingresa tu email y contrasena.
3. Seras redirigido al panel correspondiente segun tu rol (admin o chofer).

---

## 2. Panel de Administrador

Al iniciar sesion como administrador, veras el **Dashboard** con tres secciones principales: **Inicio**, **Traslados** y **Choferes**.

### 2.1 Inicio

- Veras un saludo con tu nombre y el nombre de tu empresa.
- **Estadisticas en tiempo real:** total de traslados, pendientes, en curso y completados.
- **Boton "Nuevo Traslado":** para crear un traslado nuevo.
- **Boton "Invitar Chofer":** para generar un codigo de invitacion (disponible en plan Premium).
- Si estas en el **plan Free**, veras cuantos traslados te quedan este mes (limite: 30).

### 2.2 Traslados

Aqui veras la lista completa de traslados de tu empresa.

#### Crear un traslado

1. Presiona **Nuevo Traslado** (desde Inicio o la barra de navegacion).
2. Completa los datos:
   - **Marca/Modelo** del vehiculo
   - **Matricula** (o marca "Es 0km" si no tiene)
   - **Chofer asignado** (selecciona de la lista)
   - **Importe total** (opcional)
   - **Origen y destino**
   - **Observaciones** (opcional)
3. **Fotos:** podes agregar hasta 4 fotos (frontal, lateral, trasera, interior). Se comprimen automaticamente para no ocupar mucho espacio.
4. Presiona **Crear Traslado**.

#### Ver detalle de un traslado

- Toca cualquier traslado de la lista para ver su informacion completa.
- En el detalle podes ver las fotos (toca para ampliar), cambiar el estado y el estado de pago.

#### Cambiar estado de un traslado

Los traslados tienen 3 estados:
- **Pendiente** (amarillo): recien creado, esperando inicio.
- **En curso** (azul): el chofer esta realizando el traslado.
- **Completado** (verde): traslado finalizado. Una vez completado, no se puede cambiar.

Para cambiar el estado, usa los botones de estado en la card del traslado o en la vista de detalle.

#### Estado de pago

Cada traslado tiene un estado de pago:
- **Pendiente**: aun no se pago.
- **Pagado**: el pago fue realizado.

Podes cambiar el estado de pago desde la vista de detalle del traslado.

#### Filtros

En la pestana de traslados, tenes dos filtros independientes:
- **Traslados Pendientes** (boton amarillo): muestra solo traslados con estado pendiente.
- **Pagos Pendientes** (boton naranja): muestra solo traslados con pago pendiente.

Podes activar ambos filtros al mismo tiempo.

#### Eliminar un traslado

- En la lista de traslados, presiona el boton de eliminar (icono de papelera).
- Confirma la eliminacion. Esta accion no se puede deshacer.

### 2.3 Choferes

#### Invitar un chofer (Plan Premium)

1. Presiona **Invitar Chofer**.
2. Se genera un **codigo de invitacion** y un **link**.
3. Copia el link y compartilo con tu chofer por WhatsApp, email, etc.
4. El chofer debe registrarse y luego usar el codigo o link para unirse a tu empresa.

#### Ver choferes

- Veras la lista de todos los choferes asociados a tu empresa con su nombre y email.

#### Expulsar un chofer

- Presiona el boton de expulsar junto al chofer.
- Confirma la accion. El chofer sera desvinculado de tu empresa.

### 2.4 Gastos

Accede desde el boton **Gastos** en la barra de navegacion.

#### Registrar un gasto

1. Selecciona el **tipo de gasto**: combustible, seguro, mantenimiento, peaje, patente, multa u otro.
2. Ingresa el **importe**.
3. Agrega una **descripcion** (opcional).
4. Selecciona la **fecha**.
5. Presiona **Guardar**.

#### Ver gastos

- Como admin, ves todos los gastos de la empresa.
- Podes filtrar por tipo de gasto y ordenar por fecha o importe.
- Las cards de gastos son **expandibles**: toca una card para ver la descripcion completa.

#### Eliminar un gasto

- Presiona el icono de eliminar en la card del gasto.
- Confirma la eliminacion.

### 2.5 Modo Chofer

Como admin, podes cambiar a la **vista de chofer** para ver tus propios traslados asignados. Usa el boton "Modo Chofer" en la barra de navegacion.

---

## 3. Panel de Chofer

Al iniciar sesion como chofer, veras tus traslados asignados.

### 3.1 Unirse a una empresa

Si aun no perteneces a una empresa:
1. Presiona **Unirme a una empresa**.
2. Ingresa el **codigo de invitacion** que te dio tu administrador.
3. Veras el nombre de la empresa. Confirma para unirte.

### 3.2 Ver mis traslados

- Veras la lista de traslados que te fueron asignados.
- Cada card muestra: vehiculo, matricula, estado, estado de pago, importe y fecha.
- Podes filtrar por **Traslados Pendientes** y **Pagos Pendientes**.
- Toca un traslado para ver su detalle completo con fotos.

### 3.3 Cambiar estado de un traslado

- Usa los botones de estado para avanzar el traslado:
  - Pendiente -> En curso -> Completado.
- Una vez completado, el estado queda bloqueado.

### 3.4 Mis movimientos (Gastos)

Accede desde el boton **Gastos**:
- Veras tus **ingresos** (traslados completados) y **gastos** registrados.
- Podes registrar gastos propios.
- Las cards son expandibles para ver la descripcion completa.
- Filtros por tipo de movimiento y orden disponibles.

---

## 4. Navegacion

### En computadora
- La barra de navegacion superior tiene las pestanas: **Inicio**, **Traslados**, **Choferes**.
- Botones adicionales: **Gastos**, **Modo Chofer**, **Salir**.

### En celular
- Presiona el icono de **menu** (tres lineas) arriba a la izquierda.
- Se abre un menu lateral con todas las opciones de navegacion.
- Toca fuera del menu para cerrarlo.

---

## 5. Planes

| Caracteristica | Free | Premium |
|---|---|---|
| Traslados por mes | 30 | Ilimitados |
| Agregar choferes | No | Si |
| Gastos | Si | Si |
| Fotos en traslados | Si | Si |

---

## 6. Consejos utiles

- **Actualizaciones en tiempo real:** no necesitas recargar la pagina. Los cambios que hagan otros usuarios (choferes o admins) se reflejan automaticamente.
- **Fotos:** se comprimen automaticamente al subirlas para optimizar el rendimiento.
- **Filtros combinables:** podes activar "Traslados Pendientes" y "Pagos Pendientes" al mismo tiempo para encontrar exactamente lo que buscas.
- **Cards expandibles:** en la seccion de gastos, toca una card para ver la descripcion completa del gasto.
- **Cerrar sesion:** siempre usa el boton "Salir" para cerrar tu sesion de forma segura.

---

## 7. Preguntas frecuentes

**No puedo crear mas traslados**
Puede que hayas alcanzado el limite de 30 traslados mensuales del plan Free. Considera actualizar al plan Premium.

**Mi chofer no puede unirse**
Verifica que el codigo de invitacion sea correcto y que no haya expirado. Genera uno nuevo si es necesario.

**No veo los cambios de mi chofer**
Los cambios se reflejan en tiempo real. Si no aparecen, verifica tu conexion a internet o recarga la pagina.

**Como cambio el pago a "Pagado"?**
Ingresa al detalle del traslado y cambia el estado de pago desde ahi.
