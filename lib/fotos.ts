export const BUCKET_FOTOS = 'fotos-traslados'

/** Cuánto vive una URL firmada. Más largo = más tiempo sirve un link filtrado. */
export const VIGENCIA_URL_FIRMADA = 60 * 60 // 1 hora

/**
 * Una foto puede estar en dos lugares, por razones historicas:
 *
 * - 'storage': en nuestro bucket. Es privado, asi que hay que firmar la URL.
 * - 'externa': en Cloudinary, de una version anterior de la aplicacion. Son
 *   URLs publicas de un servicio que no controlamos: se muestran tal cual y no
 *   hay forma de protegerlas desde acá.
 */
export type FotoRef =
  | { tipo: 'storage'; ruta: string }
  | { tipo: 'externa'; url: string }

/**
 * Interpreta lo que haya guardado en una columna foto_*.
 *
 * Conviven cuatro formas en produccion, todas reales:
 *
 *   null                                        -> sin foto
 *   "[]"                                        -> sin foto (array vacio)
 *   "[\"https://res.cloudinary.com/...\", ...]" -> una o varias externas
 *   "https://x.supabase.co/.../fotos-traslados/abc/frontal.jpg" -> storage
 *   "abc/frontal.jpg"                           -> storage, ya normalizado
 *
 * Devuelve una lista porque el formato viejo guardaba varias URLs por columna.
 */
export function referenciasDeFoto(valor: string | null | undefined): FotoRef[] {
  if (!valor) return []
  const texto = valor.trim()
  if (texto === '' || texto === '[]') return []

  // Formato viejo: array JSON con una o mas URLs.
  if (texto.startsWith('[')) {
    try {
      const items = JSON.parse(texto)
      if (!Array.isArray(items)) return []
      return items
        .filter((x): x is string => typeof x === 'string' && x.trim() !== '')
        .map(interpretarUno)
        .filter((x): x is FotoRef => x !== null)
    } catch {
      // Un array mal formado no debe romper la pantalla entera.
      return []
    }
  }

  const uno = interpretarUno(texto)
  return uno ? [uno] : []
}

function interpretarUno(valor: string): FotoRef | null {
  const texto = valor.trim()
  if (!texto) return null

  const marca = `/${BUCKET_FOTOS}/`
  const i = texto.indexOf(marca)
  if (i !== -1) {
    // La parte util termina antes del token de una URL firmada.
    const ruta = texto.slice(i + marca.length).split('?')[0]
    return ruta ? { tipo: 'storage', ruta } : null
  }

  // Cualquier otra URL absoluta es de un servicio externo.
  if (/^https?:\/\//i.test(texto)) return { tipo: 'externa', url: texto }

  // Si no es URL, deberia ser una ruta ya normalizada. Se comprueba la forma
  // antes de darla por buena: sin esto, un JSON suelto o cualquier basura en la
  // columna terminaria pidiendole al storage un archivo con ese nombre.
  const ruta = texto.replace(/^\/+/, '')
  if (!ruta || !/^[\w.\-/]+$/.test(ruta)) return null
  return { tipo: 'storage', ruta }
}

/** Las cuatro columnas de foto de un traslado, en el orden en que se muestran. */
export const TIPOS_FOTO = [
  { columna: 'foto_frontal', etiqueta: 'Frontal' },
  { columna: 'foto_lateral', etiqueta: 'Lateral' },
  { columna: 'foto_trasera', etiqueta: 'Trasera' },
  { columna: 'foto_interior', etiqueta: 'Interior' },
] as const

export type ColumnaFoto = (typeof TIPOS_FOTO)[number]['columna']
