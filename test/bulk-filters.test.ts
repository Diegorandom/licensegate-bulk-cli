import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  matchesBulkUpdateFilter,
  normalizeBulkUpdateInput,
  resolveExpirationDate,
} from '../src/licensegate/bulk-filters'
import type { LicenseGateLicense } from '../src/licensegate/types'

/**
 * Un filtro mal aplicado no falla: actualiza otra cosa. Por eso los bordes se
 * prueban con fechas construidas desde `Date.now()`, no con fechas fijas.
 */

const DAY = 24 * 60 * 60 * 1000
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString()

function license(overrides: Partial<LicenseGateLicense> = {}): LicenseGateLicense {
  return {
    id: 1,
    active: true,
    userId: 1,
    licenseKey: 'K-1',
    name: 'n',
    notes: '',
    ipLimit: null,
    licenseScope: 'pro',
    expirationDate: null,
    validationPoints: null,
    validationLimit: null,
    replenishAmount: null,
    replenishInterval: null,
    createdAt: iso(-10),
    ...overrides,
  }
}

test('sin filtro, toda licencia entra', () => {
  assert.equal(matchesBulkUpdateFilter(license()), true)
  assert.equal(matchesBulkUpdateFilter(license({ active: false }), {}), true)
})

test('createdWithinDays deja fuera lo más viejo que la ventana', () => {
  assert.equal(matchesBulkUpdateFilter(license({ createdAt: iso(-3) }), { createdWithinDays: 7 }), true)
  assert.equal(matchesBulkUpdateFilter(license({ createdAt: iso(-30) }), { createdWithinDays: 7 }), false)
})

test('createdWithinDays respeta el borde exacto sin rechazar por microsegundos', () => {
  const barely = new Date(Date.now() - 7 * DAY + 2000).toISOString()
  assert.equal(matchesBulkUpdateFilter(license({ createdAt: barely }), { createdWithinDays: 7 }), true)
})

test('expiringWithinDays ignora las que ya caducaron', () => {
  assert.equal(matchesBulkUpdateFilter(license({ expirationDate: iso(3) }), { expiringWithinDays: 7 }), true)
  assert.equal(matchesBulkUpdateFilter(license({ expirationDate: iso(-1) }), { expiringWithinDays: 7 }), false)
  assert.equal(matchesBulkUpdateFilter(license({ expirationDate: iso(30) }), { expiringWithinDays: 7 }), false)
})

test('expiringWithinDays no toca las licencias sin fecha de caducidad', () => {
  assert.equal(matchesBulkUpdateFilter(license({ expirationDate: null }), { expiringWithinDays: 7 }), false)
})

test('expiredWithinDays sólo ve las que ya vencieron, dentro de la ventana', () => {
  assert.equal(matchesBulkUpdateFilter(license({ expirationDate: iso(-2) }), { expiredWithinDays: 7 }), true)
  assert.equal(matchesBulkUpdateFilter(license({ expirationDate: iso(2) }), { expiredWithinDays: 7 }), false)
  assert.equal(matchesBulkUpdateFilter(license({ expirationDate: iso(-30) }), { expiredWithinDays: 7 }), false)
})

test('los dos filtros de caducidad se suman con OR, y el de creación sigue siendo AND', () => {
  const both = { expiringWithinDays: 7, expiredWithinDays: 7 } as const
  assert.equal(matchesBulkUpdateFilter(license({ expirationDate: iso(-2) }), both), true)
  assert.equal(matchesBulkUpdateFilter(license({ expirationDate: iso(2) }), both), true)

  const withCreated = { ...both, createdWithinDays: 3 }
  assert.equal(
    matchesBulkUpdateFilter(license({ expirationDate: iso(2), createdAt: iso(-1) }), withCreated),
    true
  )
  assert.equal(
    matchesBulkUpdateFilter(license({ expirationDate: iso(2), createdAt: iso(-20) }), withCreated),
    false
  )
})

test('normalizeBulkUpdateInput quita los campos que la API de bulk no acepta', () => {
  const out = normalizeBulkUpdateInput({
    active: false,
    ipLimit: 3,
    licenseScope: 'x',
    validationPoints: 1,
    validationLimit: 2,
    replenishAmount: 3,
    replenishInterval: 'DAY',
  })
  // `expirationDate` queda como clave con undefined: no viaja al JSON y no
  // significa lo mismo que null, que sí se envía.
  assert.deepEqual(out, { active: false, expirationDate: undefined })
})

test('normalizeBulkUpdateInput distingue null (quitar caducidad) de undefined (no tocar)', () => {
  assert.deepEqual(normalizeBulkUpdateInput({ active: true, expirationDate: null }), {
    active: true,
    expirationDate: null,
  })
  const untouched = normalizeBulkUpdateInput({ active: true })
  assert.equal('expirationDate' in untouched, true)
  assert.equal(untouched.expirationDate, undefined)
})

test('extendByDays calcula desde ahora, y una fecha pasada sigue siendo pasada', () => {
  const extended = resolveExpirationDate({ extendByDays: 7 }) as string
  const drift = Math.abs(new Date(extended).getTime() - (Date.now() + 7 * DAY))
  assert.ok(drift < 5000, `extendByDays se desvió ${drift} ms`)

  const past = resolveExpirationDate({ extendByDays: -1 }) as string
  assert.ok(new Date(past).getTime() < Date.now())
})

test('resolveExpirationDate respeta string y Date', () => {
  assert.equal(resolveExpirationDate('2027-03-01'), '2027-03-01')
  const when = new Date('2027-03-01T00:00:00.000Z')
  assert.equal(resolveExpirationDate(when), '2027-03-01T00:00:00.000Z')
  assert.equal(resolveExpirationDate(null), null)
  assert.equal(resolveExpirationDate(undefined), undefined)
})
