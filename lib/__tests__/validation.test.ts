import { describe, it, expect } from 'vitest'
import {
  sanitizeString,
  sanitizeAndLimit,
  isValidUUID,
  isValidEmail,
  isValidPassword,
  isValidName,
  isValidImporte,
  isValidMatricula,
  isValidCodigoInvitacion,
  isValidFecha,
  isValidTipoGasto,
  LIMITS,
} from '../validation'

describe('sanitizeString', () => {
  it('trims whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello')
  })
  it('removes control characters', () => {
    expect(sanitizeString('hello\x00world')).toBe('helloworld')
  })
  it('returns empty string for non-string input', () => {
    expect(sanitizeString(123)).toBe('')
    expect(sanitizeString(null)).toBe('')
    expect(sanitizeString(undefined)).toBe('')
  })
})

describe('sanitizeAndLimit', () => {
  it('sanitizes and truncates', () => {
    expect(sanitizeAndLimit('  long text here  ', 5)).toBe('long ')
  })
})

describe('isValidUUID', () => {
  it('accepts valid UUIDs', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
  })
  it('rejects invalid UUIDs', () => {
    expect(isValidUUID('not-a-uuid')).toBe(false)
    expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false)
    expect(isValidUUID('')).toBe(false)
  })
})

describe('isValidEmail', () => {
  it('accepts valid emails', () => {
    expect(isValidEmail('user@example.com')).toBe(true)
    expect(isValidEmail('test.co@domain.org')).toBe(true)
  })
  it('rejects invalid emails', () => {
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('noat.com')).toBe(false)
    expect(isValidEmail('@domain.com')).toBe(false)
  })
  it('rejects emails over 254 chars', () => {
    expect(isValidEmail('a'.repeat(250) + '@test.com')).toBe(false)
  })
})

describe('isValidPassword', () => {
  it('accepts valid passwords', () => {
    expect(isValidPassword('123456')).toBe(true)
    expect(isValidPassword('a'.repeat(128))).toBe(true)
  })
  it('rejects short passwords', () => {
    expect(isValidPassword('12345')).toBe(false)
  })
  it('rejects too long passwords', () => {
    expect(isValidPassword('a'.repeat(129))).toBe(false)
  })
})

describe('isValidName', () => {
  it('accepts valid names', () => {
    expect(isValidName('Juan')).toBe(true)
  })
  it('rejects empty names', () => {
    expect(isValidName('')).toBe(false)
  })
})

describe('isValidImporte', () => {
  it('accepts valid importes', () => {
    expect(isValidImporte(100)).toBe(true)
    expect(isValidImporte('50.5')).toBe(true)
    expect(isValidImporte(0)).toBe(true)
  })
  it('rejects negative importes', () => {
    expect(isValidImporte(-1)).toBe(false)
  })
  it('rejects huge importes', () => {
    expect(isValidImporte(100_000_000)).toBe(false)
  })
})

describe('isValidMatricula', () => {
  it('accepts valid matriculas', () => {
    expect(isValidMatricula('ABC123')).toBe(true)
    expect(isValidMatricula('AB-123')).toBe(true)
  })
  it('rejects invalid matriculas', () => {
    expect(isValidMatricula('')).toBe(false)
    expect(isValidMatricula('ABC@123')).toBe(false)
  })
})

describe('isValidCodigoInvitacion', () => {
  it('accepts valid codes', () => {
    expect(isValidCodigoInvitacion('abc-123')).toBe(true)
    expect(isValidCodigoInvitacion('test_code')).toBe(true)
  })
  it('rejects short codes', () => {
    expect(isValidCodigoInvitacion('ab')).toBe(false)
  })
})

describe('isValidFecha', () => {
  it('accepts valid dates', () => {
    expect(isValidFecha('2024-01-15')).toBe(true)
    expect(isValidFecha('2024-12-31')).toBe(true)
  })
  it('rejects invalid dates', () => {
    expect(isValidFecha('2024-13-01')).toBe(false)
    expect(isValidFecha('2024-02-30')).toBe(false)
    expect(isValidFecha('not-a-date')).toBe(false)
  })
})

describe('isValidTipoGasto', () => {
  it('accepts valid types', () => {
    expect(isValidTipoGasto('combustible')).toBe(true)
    expect(isValidTipoGasto('seguro')).toBe(true)
    expect(isValidTipoGasto('otro')).toBe(true)
  })
  it('rejects invalid types', () => {
    expect(isValidTipoGasto('')).toBe(false)
    expect(isValidTipoGasto('invalido')).toBe(false)
  })
})

describe('LIMITS', () => {
  it('has expected limits', () => {
    expect(LIMITS.nombre).toBe(100)
    expect(LIMITS.empresa).toBe(150)
    expect(LIMITS.observaciones).toBe(1000)
  })
})
