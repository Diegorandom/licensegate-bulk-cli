import { test } from 'node:test'
import assert from 'node:assert/strict'
import { serializeLicenseUpdateInput, serializeLicenseInput } from '../src/licensegate/client/serialize-input'

/**
 * El caso que motivó estos tests está escrito en el propio módulo:
 * `expirationDate: null` significa «no caduca» y no es lo mismo que omitir el
 * campo. Si el limpiador se lo come, el PATCH deja la fecha como estaba y el
 * usuario cree que la quitó.
 */

test('expirationDate null sobrevive al limpiado: es un valor, no un hueco', () => {
  const out = serializeLicenseUpdateInput({ licenseScope: 'pro', expirationDate: null })
  assert.deepEqual(out, { licenseScope: 'pro', expirationDate: null })
  assert.ok('expirationDate' in out)
})

test('un undefined sí es un hueco y no viaja en la petición', () => {
  const out = serializeLicenseUpdateInput({ licenseScope: 'pro', expirationDate: undefined, notes: undefined })
  assert.deepEqual(out, { licenseScope: 'pro' })
})

test('un Date se serializa a ISO en el campo de caducidad', () => {
  const when = new Date('2027-01-31T12:00:00.000Z')
  const out = serializeLicenseUpdateInput({ expirationDate: when })
  assert.equal(out.expirationDate, '2027-01-31T12:00:00.000Z')
})

test('serializeLicenseInput respeta null y undefined tal cual', () => {
  const out = serializeLicenseInput({ licenseScope: 'a', expirationDate: null })
  assert.deepEqual(out, { licenseScope: 'a', expirationDate: null })

  const undefinedOut = serializeLicenseInput({ licenseScope: 'a', expirationDate: undefined })
  assert.deepEqual(undefinedOut, { licenseScope: 'a', expirationDate: undefined })
})

// `removeNullishDeep` recorre objetos y arrays, pero con el tipo público de hoy
// el único anidamiento posible es la fecha. Estos dos tests fijan el contrato
// del limpiador para cuando el update crezca (una metadata, una lista de tags);
// el cast es deliberado, y está aquí para que se borre el día que el tipo lo
// admita.
test('el limpiado es profundo: no deja nulls dentro de objetos anidados', () => {
  const input = { licenseScope: 'a', metadata: { keep: 'yes', drop: null, alsoDrop: undefined } } as unknown as Record<
    string,
    unknown
  >
  const out = serializeLicenseUpdateInput(input)
  assert.deepEqual(out, { licenseScope: 'a', metadata: { keep: 'yes' } })
})

test('el limpiado es profundo también dentro de arrays', () => {
  const input = { licenseScope: 'a', tags: ['uno', null, undefined, 'dos'] } as unknown as Record<string, unknown>
  const out = serializeLicenseUpdateInput(input)
  assert.deepEqual(out, { licenseScope: 'a', tags: ['uno', 'dos'] })
})

test('no muta la entrada (el que llamó puede reusarla)', () => {
  const input = { licenseScope: 'a', notes: 'base' }
  serializeLicenseUpdateInput(input)
  assert.deepEqual(input, { licenseScope: 'a', notes: 'base' })
})

test('false y 0 no son nullish: sobreviven', () => {
  const out = serializeLicenseUpdateInput({ licenseScope: 'a', active: false, validationLimit: 0 })
  assert.deepEqual(out, { licenseScope: 'a', active: false, validationLimit: 0 })
})
