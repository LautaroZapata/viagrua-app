import { describe, it, expect } from 'vitest'
import { referenciasDeFoto } from '../fotos'

const RUTA = 'ce726162-c919-45f9-8b9b-7243ce3c32f2/frontal_1777326625760.jpg'
const URL_SUPABASE = `https://kqqaamnnmwyekvjzxuvy.supabase.co/storage/v1/object/public/fotos-traslados/${RUTA}`
const URL_CLOUDINARY = 'https://res.cloudinary.com/dam1rxm52/image/upload/v1758209105/qnx0ysufxgvgddg71nnm.jpg'

describe('referenciasDeFoto / sin foto', () => {
  it('trata null, vacio y array vacio como sin foto', () => {
    expect(referenciasDeFoto(null)).toEqual([])
    expect(referenciasDeFoto(undefined)).toEqual([])
    expect(referenciasDeFoto('')).toEqual([])
    expect(referenciasDeFoto('   ')).toEqual([])
    // 457 valores en produccion son exactamente este
    expect(referenciasDeFoto('[]')).toEqual([])
  })
})

describe('referenciasDeFoto / storage', () => {
  it('extrae la ruta de una URL publica', () => {
    expect(referenciasDeFoto(URL_SUPABASE)).toEqual([{ tipo: 'storage', ruta: RUTA }])
  })

  it('extrae la ruta de una URL firmada, descartando el token', () => {
    const firmada = `https://x.supabase.co/storage/v1/object/sign/fotos-traslados/${RUTA}?token=abc.def`
    expect(referenciasDeFoto(firmada)).toEqual([{ tipo: 'storage', ruta: RUTA }])
  })

  it('deja pasar una ruta ya normalizada', () => {
    expect(referenciasDeFoto(RUTA)).toEqual([{ tipo: 'storage', ruta: RUTA }])
  })

  it('normaliza una barra inicial de mas', () => {
    expect(referenciasDeFoto(`/${RUTA}`)).toEqual([{ tipo: 'storage', ruta: RUTA }])
  })
})

describe('referenciasDeFoto / externas (Cloudinary)', () => {
  it('reconoce una URL de otro servicio y la deja intacta', () => {
    expect(referenciasDeFoto(URL_CLOUDINARY)).toEqual([{ tipo: 'externa', url: URL_CLOUDINARY }])
  })

  it('lee el array JSON del formato viejo, que traia varias', () => {
    const otra = 'https://res.cloudinary.com/dam1rxm52/image/upload/v1/otra.jpg'
    expect(referenciasDeFoto(JSON.stringify([URL_CLOUDINARY, otra]))).toEqual([
      { tipo: 'externa', url: URL_CLOUDINARY },
      { tipo: 'externa', url: otra },
    ])
  })

  it('descarta entradas vacias dentro del array', () => {
    expect(referenciasDeFoto(JSON.stringify([URL_CLOUDINARY, '', '  ']))).toEqual([
      { tipo: 'externa', url: URL_CLOUDINARY },
    ])
  })

  it('mezcla externas y de storage en un mismo array', () => {
    expect(referenciasDeFoto(JSON.stringify([URL_CLOUDINARY, URL_SUPABASE]))).toEqual([
      { tipo: 'externa', url: URL_CLOUDINARY },
      { tipo: 'storage', ruta: RUTA },
    ])
  })
})

describe('referenciasDeFoto / datos rotos', () => {
  it('no explota con un array mal formado', () => {
    expect(referenciasDeFoto('["sin cerrar')).toEqual([])
  })

  it('ignora un JSON que no es array', () => {
    expect(referenciasDeFoto('{"a":1}')).toEqual([])
  })

  it('descarta entradas que no son strings', () => {
    expect(referenciasDeFoto(JSON.stringify([123, null, URL_CLOUDINARY]))).toEqual([
      { tipo: 'externa', url: URL_CLOUDINARY },
    ])
  })
})
