import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeWithCurrentLicense } from '../src/licensegate/client/merge-update'
import type { LicenseGateLicense } from '../src/licensegate/types'

/**
 * El caso que motivó estos tests está medido, no supuesto: el 2026-11-10, 214
 * actualizaciones que sólo cambiaban `notes` fallaron con 422 invalid-schema
 * («requestBody.expirationDate: value null»). La API no acepta un PATCH sin
 * fecha, así que el merge tiene que reenviar la que ya existe.
 */

function licencia(overrides: Partial<LicenseGateLicense> = {}): LicenseGateLicense {
  return {
    id: 1,
    active: true,
    userId: 1,
    licenseKey: 'K-1',
    name: 'n',
    notes: '',
    ipLimit: 1,
    licenseScope: 'DemoTrial',
    expirationDate: '2026-11-18T00:00:00.000Z',
    validationPoints: 3,
    validationLimit: 3,
    replenishAmount: 1,
    replenishInterval: 'TEN_SECONDS',
    createdAt: '2026-11-10T00:00:00.000Z',
    ...overrides,
  }
}

test('una actualización de sólo notes reenvía la fecha que la licencia ya tiene', () => {
  const out = mergeWithCurrentLicense({ notes: 'shopify:o123:DemoTrial' }, licencia())
  assert.equal(out.expirationDate, '2026-11-18T00:00:00.000Z')
  assert.equal(out.notes, 'shopify:o123:DemoTrial')
})

test('una fecha explícita manda sobre la actual', () => {
  const out = mergeWithCurrentLicense({ expirationDate: '2027-01-01T00:00:00.000Z' }, licencia())
  assert.equal(out.expirationDate, '2027-01-01T00:00:00.000Z')
})

test('null explícito sigue significando «quita la fecha» y no se rellena', () => {
  const out = mergeWithCurrentLicense({ expirationDate: null }, licencia())
  assert.equal(out.expirationDate, null)
})

test('si la licencia no tiene fecha, el merge no inventa una', () => {
  const out = mergeWithCurrentLicense({ notes: 'x' }, licencia({ expirationDate: null }))
  assert.equal(out.expirationDate, undefined)
})

test('los campos de configuración actuales se conservan cuando no se piden', () => {
  const out = mergeWithCurrentLicense({ notes: 'x' }, licencia())
  assert.equal(out.ipLimit, 1)
  assert.equal(out.licenseScope, 'DemoTrial')
  assert.equal(out.validationPoints, 3)
  assert.equal(out.validationLimit, 3)
  assert.equal(out.replenishAmount, 1)
  assert.equal(out.replenishInterval, 'TEN_SECONDS')
})

test('null en la licencia actual no se copia a los campos de configuración', () => {
  const out = mergeWithCurrentLicense({ notes: 'x' }, licencia({ ipLimit: null, licenseScope: null }))
  assert.equal(out.ipLimit, undefined)
  assert.equal(out.licenseScope, undefined)
})

test('el merge no muta la entrada ni la licencia actual', () => {
  const input = { notes: 'x' }
  const current = licencia()
  mergeWithCurrentLicense(input, current)
  assert.deepEqual(input, { notes: 'x' })
  assert.equal(current.expirationDate, '2026-11-18T00:00:00.000Z')
})
