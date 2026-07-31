import { test, expect } from '@playwright/test'
import {
  registrarEmpresa,
  login,
  cerrarSesion,
  generarCodigoInvitacion,
  identidadUnica,
  saltearOnboarding,
} from './apoyo'

/** El nombre con el que el chofer se da de alta y con el que aparece en el select. */
const NOMBRE_CHOFER = 'Chofer de Prueba'

/**
 * El camino que tiene que funcionar si o si: dar de alta una empresa, invitar a
 * un chofer, asignarle un traslado y que el chofer lo complete.
 *
 * Va todo en un solo test y no en varios encadenados a proposito: cada paso
 * necesita el estado del anterior (la empresa del admin, el codigo de la
 * invitacion, el id del traslado), y partirlo obligaria a sembrar esos datos a
 * mano en cada uno. Cuando falla, el reporte dice en que paso fue.
 */
test('flujo critico: alta de empresa, invitacion, traslado y cierre por el chofer', async ({ page }) => {
  const marca = Date.now().toString().slice(-6)
  const nombreEmpresa = `Gruas E2E ${marca}`
  const matricula = `E2E${marca.slice(-3)}`

  // 1. Alta de la empresa. Deja la sesion del admin abierta.
  const admin = await test.step('el admin da de alta la empresa', async () => {
    const credenciales = await registrarEmpresa(page, nombreEmpresa)
    await expect(page).toHaveURL(/\/dashboard/)
    return credenciales
  })

  // 2. Invitacion para el chofer.
  const codigo = await test.step('el admin genera un codigo de invitacion', async () => {
    return generarCodigoInvitacion(page)
  })

  // 3. El chofer se da de alta con ese codigo.
  const chofer = identidadUnica('chofer')
  await test.step('el chofer se registra con el codigo', async () => {
    await cerrarSesion(page)
    await page.goto(`/unirse/${codigo}`)

    await page.locator('#nombre, #signup-nombre').first().fill(NOMBRE_CHOFER)
    await page.locator('#email, #signup-email').first().fill(chofer.email)
    await page.locator('#password, #signup-password').first().fill(chofer.password)
    await page.getByRole('button', { name: /unirme|registrar|crear/i }).first().click()

    await page.waitForURL(/\/(chofer|onboarding)/, { timeout: 30_000 })
    await saltearOnboarding(page)
    await expect(page).toHaveURL(/\/chofer/)
  })

  // 4. El admin crea el traslado y se lo asigna.
  await test.step('el admin crea un traslado para ese chofer', async () => {
    await cerrarSesion(page)
    await login(page, admin.email, admin.password)

    await page.goto('/dashboard/nuevo-traslado')
    await page.locator('#marca').fill('Toyota Corolla')
    await page.locator('#matricula').fill(matricula)
    await page.locator('#importe').fill('15000')
    await page.locator('#desde').fill('Montevideo')
    await page.locator('#hasta').fill('Canelones')

    // El select se puebla con TODOS los perfiles de la empresa, incluido el
    // admin, que aparece con el sufijo " (Yo)". Elegir por indice agarraba al
    // admin y el traslado terminaba asignado a el: el flujo seguia sin fallar y
    // recien reventaba dos pasos despues, cuando el chofer no veia nada.
    // Se elige por nombre y se comprueba que quedo seleccionado el correcto.
    const selectChofer = page.locator('#chofer')
    await expect(selectChofer.locator('option')).not.toHaveCount(1)
    await selectChofer.selectOption({ label: NOMBRE_CHOFER })

    const elegido = await selectChofer.locator('option:checked').textContent()
    expect(elegido, 'el traslado tiene que quedar asignado al chofer').toContain(NOMBRE_CHOFER)
    expect(elegido, 'no puede quedar asignado al admin').not.toContain('(Yo)')

    await page.getByRole('button', { name: /crear traslado/i }).click()
    await page.waitForURL(/\/dashboard(\/traslados)?/, { timeout: 30_000 })
  })

  // 5. El traslado aparece en la lista del admin.
  await test.step('el traslado figura en la lista', async () => {
    await page.goto('/dashboard/traslados')
    await expect(page.getByText(matricula, { exact: false }).first()).toBeVisible({ timeout: 20_000 })
  })

  // 6. El chofer lo ve, lo pone en curso y lo completa.
  await test.step('el chofer completa el traslado', async () => {
    await cerrarSesion(page)
    await login(page, chofer.email, chofer.password)
    await expect(page).toHaveURL(/\/chofer/)

    await page.getByText(matricula, { exact: false }).first().click()
    await page.waitForURL(/\/chofer\/traslado\//, { timeout: 20_000 })

    // El estado se cambia desde un selector; el paso a completado pide
    // confirmacion porque despues queda bloqueado.
    await page.getByRole('button', { name: /en curso/i }).first().click()
    await expect(page.getByText(/en curso/i).first()).toBeVisible()

    await page.getByRole('button', { name: /completado/i }).first().click()
    const confirmar = page.getByRole('button', { name: /si, completar|confirmar/i })
    if (await confirmar.count()) await confirmar.first().click()

    await expect(page.getByText(/completado/i).first()).toBeVisible({ timeout: 20_000 })
  })
})
