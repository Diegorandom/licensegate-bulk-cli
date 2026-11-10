import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveBulkTargets } from '../src/licensegate/bulk-targets'
import type { LicenseGateLicense } from '../src/licensegate/types'

/**
 * `resolveBulkTargets` es donde "una fila del plan" se convierte en "N
 * licencias que se van a modificar". Un error aquí no se nota hasta que la
 * cuenta ya cambió, así que lo que se prueba es el alcance: a quién incluye y,
 * sobre todo, a quién deja fuera.
 */

const DAY = 24 * 60 * 60 * 1000
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString()

function license(id: number, overrides: Partial<LicenseGateLicense> = {}): LicenseGateLicense {
  return {
    id,
    active: true,
    userId: 1,
    licenseKey: `K-${id}`,
    name: 'n',
    notes: '',
    ipLimit: null,
    licenseScope: 'pro',
    expirationDate: null,
    validationPoints: null,
    validationLimit: null,
    replenishAmount: null,
    replenishInterval: null,
    createdAt: iso(-1),
    ...overrides,
  }
}

test('con id explícito no consulta la lista: actualiza exactamente esa licencia', async () => {
  let listed = 0
  const targets = await resolveBulkTargets(
    [{ id: 7, data: { active: false } }],
    async () => {
      listed++
      return []
    }
  )
  assert.equal(listed, 0)
  assert.deepEqual(targets, [{ id: 7, scope: undefined, data: { active: false, expirationDate: undefined } }])
})

test('por scope expande a las licencias de ese scope y sólo de ese', async () => {
  const targets = await resolveBulkTargets(
    [{ scope: 'pro', data: { active: false } }],
    async () => [license(1, { licenseScope: 'pro' }), license(2, { licenseScope: 'basic' }), license(3, { licenseScope: 'pro' })]
  )
  assert.deepEqual(targets.map((t) => t.id), [1, 3])
  assert.ok(targets.every((t) => t.scope === 'pro'))
})

test('el filtro se aplica dentro del scope, no sobre el total', async () => {
  const targets = await resolveBulkTargets(
    [{ scope: 'pro', filter: { createdWithinDays: 7 }, data: { active: false } }],
    async () => [
      license(1, { licenseScope: 'pro', createdAt: iso(-1) }),
      license(2, { licenseScope: 'pro', createdAt: iso(-40) }),
    ]
  )
  assert.deepEqual(targets.map((t) => t.id), [1])
})

test('consulta la lista una sola vez aunque haya varios scopes', async () => {
  let calls = 0
  await resolveBulkTargets(
    [
      { scope: 'pro', data: { active: false } },
      { scope: 'basic', data: { active: false } },
      { scope: 'pro', data: { active: true } },
    ],
    async () => {
      calls++
      return [license(1, { licenseScope: 'pro' }), license(2, { licenseScope: 'basic' })]
    }
  )
  assert.equal(calls, 1)
})

test('un scope sin licencias produce cero objetivos, no un error', async () => {
  const targets = await resolveBulkTargets([{ scope: 'fantasma', data: { active: false } }], async () => [])
  assert.deepEqual(targets, [])
})

test('mezcla ids y scopes en el mismo plan, conservando el orden', async () => {
  const targets = await resolveBulkTargets(
    [
      { id: 99, data: { active: false } },
      { scope: 'pro', data: { notes: 'x' } },
    ],
    async () => [license(1, { licenseScope: 'pro' }), license(2, { licenseScope: 'pro' })]
  )
  assert.deepEqual(targets.map((t) => t.id), [99, 1, 2])
  assert.equal(targets[0].scope, undefined)
  assert.equal(targets[1].scope, 'pro')
})

test('cada objetivo recibe su propia copia del data (mutar uno no toca los demás)', async () => {
  const targets = await resolveBulkTargets(
    [{ scope: 'pro', data: { notes: 'original' } }],
    async () => [license(1, { licenseScope: 'pro' }), license(2, { licenseScope: 'pro' })]
  )
  targets[0].data.notes = 'cambiado'
  assert.equal(targets[1].data.notes, 'original')
})

test('los campos que la API de bulk no acepta no llegan al objetivo', async () => {
  const targets = await resolveBulkTargets(
    [{ id: 1, data: { active: false, ipLimit: 5, licenseScope: 'otro' } }],
    async () => []
  )
  assert.deepEqual(targets[0].data, { active: false, expirationDate: undefined })
})
