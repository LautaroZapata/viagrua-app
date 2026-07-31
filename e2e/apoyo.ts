import { expect, type Page } from '@playwright/test'

/**
 * Helpers compartidos por los E2E.
 *
 * Todo lo que sea "llegar hasta donde empieza lo que quiero probar" vive aca,
 * para que cada test se lea como el flujo que describe y no como una lista de
 * clicks.
 */

/**
 * Datos unicos por corrida.
 *
 * Los tests corren contra una base local que no se resetea entre corridas (el
 * reset cuesta ~30s), asi que dos corridas seguidas chocarian por el email. El
 * timestamp mas un sufijo al azar alcanza: no hay concurrencia, workers es 1.
 */
export function identidadUnica(prefijo: string) {
  const marca = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`
  return {
    email: `${prefijo}-${marca}@example.test`,
    password: 'ClaveDePrueba123',
    marca,
  }
}

/**
 * Da de alta una empresa desde la landing y deja la sesion abierta.
 *
 * Devuelve las credenciales para poder volver a entrar mas tarde en el flujo.
 */
export async function registrarEmpresa(page: Page, nombreEmpresa: string) {
  const admin = identidadUnica('admin')

  await page.goto('/#registro')
  await page.locator('#signup-empresa').fill(nombreEmpresa)
  await page.locator('#signup-nombre').fill('Admin de Prueba')
  await page.locator('#signup-email').fill(admin.email)
  await page.locator('#signup-password').fill(admin.password)
  await page.getByRole('button', { name: /crear cuenta|registrar|empezar/i }).click()

  // El alta crea empresa + perfil y despues redirige. Puede caer en onboarding
  // o directo al dashboard segun el estado del perfil.
  await page.waitForURL(/\/(onboarding|dashboard)/, { timeout: 30_000 })
  await saltearOnboarding(page)
  await expect(page).toHaveURL(/\/dashboard/)

  return admin
}

/**
 * El onboarding es un wizard de varios pasos con un "Omitir" en cada uno.
 *
 * No es lo que estos tests prueban, asi que se saltea. Si la pantalla no
 * aparece, no hace nada: el flujo puede entrar directo al dashboard.
 */
export async function saltearOnboarding(page: Page) {
  if (!/\/onboarding/.test(page.url())) return

  // "Omitir" completa el onboarding entero y redirige de una: no hay que
  // recorrer los pasos. Solo aparece si no estas en el ultimo, donde el boton
  // pasa a ser "Comenzar".
  //
  // Antes esto era un bucle que clickeaba hasta salir de /onboarding, y era una
  // carrera: el segundo click caia sobre un boton ya desmontado por la
  // navegacion del primero. Pasaba o no segun lo rapido que respondiera la
  // maquina.
  const omitir = page.getByRole('button', { name: /omitir/i })
  const comenzar = page.getByRole('button', { name: /comenzar/i })

  await ((await omitir.count()) ? omitir : comenzar).first().click()

  await page.waitForURL(/\/(dashboard|chofer)/, { timeout: 30_000 })
}

export async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: /ingresar|entrar|iniciar/i }).click()
  await page.waitForURL(/\/(dashboard|chofer|onboarding)/, { timeout: 30_000 })
  await saltearOnboarding(page)
}

/**
 * Cierra la sesion borrando el storage.
 *
 * Se hace asi y no por el menu de usuario a proposito: el boton de salir vive
 * en un dropdown que cambia de lugar entre el layout de admin y el de chofer, y
 * este helper se llama desde los dos.
 */
export async function cerrarSesion(page: Page) {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.goto('/login')
}

/** Genera una invitacion desde el dashboard y devuelve el codigo. */
export async function generarCodigoInvitacion(page: Page) {
  await page.goto('/dashboard/choferes')
  await page.getByRole('button', { name: /invitar/i }).first().click()

  const dialogo = page.getByRole('dialog')
  await expect(dialogo).toBeVisible()

  // El modal abre con un boton para generar; el codigo aparece despues.
  const generar = dialogo.getByRole('button', { name: /generar|crear/i })
  if (await generar.count()) await generar.first().click()

  const codigo = dialogo.getByTestId('codigo-invitacion')
  await expect(codigo).toBeVisible({ timeout: 20_000 })

  const texto = (await codigo.textContent())?.trim()
  expect(texto, 'el modal tiene que mostrar un codigo').toBeTruthy()

  return texto as string
}
