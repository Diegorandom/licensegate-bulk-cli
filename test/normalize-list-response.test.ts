import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeLicenseListResponse } from '../src/licensegate/client/normalize-list-response'
import { LicenseGateAdminClientError } from '../src/licensegate/errors'

/**
 * La API ha servido al menos cuatro formas distintas de la misma lista. Si una
 * no se reconoce, el cliente tiene que romper ruidosamente: tratar una lista
 * vacía como cero licencias hace que un bulk-update no toque nada y parezca
 * que funcionó.
 */

const row = { id: 1, licenseScope: 'pro' }

for (const field of ['licenses', 'items', 'data', 'result'] as const) {
  test(`reconoce la envoltura "${field}"`, () => {
    const out = normalizeLicenseListResponse({ [field]: [row] })
    assert.deepEqual(out.licenses, [row])
  })
}

test('una respuesta que ya es array se acepta tal cual', () => {
  const out = normalizeLicenseListResponse([row, row])
  assert.equal(out.licenses.length, 2)
  assert.equal(out.count, undefined)
})

test('count y total se leen como número; cualquier otra cosa es undefined', () => {
  assert.equal(normalizeLicenseListResponse({ data: [], count: 42 }).count, 42)
  assert.equal(normalizeLicenseListResponse({ data: [], total: 7 }).count, 7)
  assert.equal(normalizeLicenseListResponse({ data: [], count: '42' }).count, undefined)
  assert.equal(normalizeLicenseListResponse({ data: [] }).count, undefined)
})

test('count gana sobre total cuando están los dos', () => {
  assert.equal(normalizeLicenseListResponse({ data: [], count: 3, total: 99 }).count, 3)
})

test('una lista vacía es válida y no se confunde con una forma desconocida', () => {
  const out = normalizeLicenseListResponse({ licenses: [] })
  assert.deepEqual(out.licenses, [])
})

test('una forma desconocida lanza error en vez de devolver cero licencias', () => {
  assert.throws(() => normalizeLicenseListResponse({ rows: [row] }), LicenseGateAdminClientError)
  assert.throws(() => normalizeLicenseListResponse(null), LicenseGateAdminClientError)
  assert.throws(() => normalizeLicenseListResponse('boom'), LicenseGateAdminClientError)
})

test('el error lleva el payload para poder diagnosticarlo', () => {
  try {
    normalizeLicenseListResponse({ rows: [row] })
    assert.fail('debía lanzar')
  } catch (error) {
    assert.ok(error instanceof LicenseGateAdminClientError)
    assert.deepEqual((error as LicenseGateAdminClientError).details, { rows: [row] })
  }
})
