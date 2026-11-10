import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseBulkCreateInputs } from '../src/cli/bulk-create-input'

/**
 * Aquí un error se paga en licencias reales: la plantilla multiplica. Lo que se
 * prueba con más cuidado es que multiplicar no comparta estado entre filas.
 */

const DAY = 24 * 60 * 60 * 1000

test('un array se usa tal cual', () => {
  const input = [{ name: 'a' }, { name: 'b' }]
  assert.deepEqual(parseBulkCreateInputs(input), input)
})

test('la plantilla { count, data } se expande a count filas idénticas', () => {
  const out = parseBulkCreateInputs({ count: 3, data: { name: 'lote', active: true } })
  assert.equal(out.length, 3)
  assert.deepEqual(out[0], { name: 'lote', active: true })
})

test('cada fila es un objeto distinto: mutar una no contamina las demás', () => {
  const out = parseBulkCreateInputs({ count: 3, data: { name: 'lote', notes: 'base' } })
  out[0].notes = 'tocada'
  assert.equal(out[1].notes, 'base')
  assert.equal(out[2].notes, 'base')
})

test('count inválido falla en vez de crear cero o mil licencias', () => {
  assert.throws(() => parseBulkCreateInputs({ count: 0, data: {} }), /positive integer/)
  assert.throws(() => parseBulkCreateInputs({ count: -5, data: {} }), /positive integer/)
  assert.throws(() => parseBulkCreateInputs({ count: 1.5, data: {} }), /positive integer/)
  assert.throws(() => parseBulkCreateInputs({ count: Number.NaN, data: {} }), /positive integer/)
})

// No es un defecto que se corrige hoy: el JSON a mano y las hojas exportadas
// llevan el número entre comillas, y `Number('3')` lo resuelve sin ambigüedad.
// Se deja escrito para que nadie lo lea como un descuido.
test('count como cadena numérica se coacciona (declarado, no accidental)', () => {
  assert.equal(parseBulkCreateInputs({ count: '3', data: { name: 'x' } }).length, 3)
})

test('la plantilla sin data falla', () => {
  assert.throws(() => parseBulkCreateInputs({ count: 2 }), /requires a data object/)
})

test('entradas que no son array ni objeto fallan', () => {
  assert.throws(() => parseBulkCreateInputs(null), /must be a JSON array/)
  assert.throws(() => parseBulkCreateInputs('x'), /must be a JSON array/)
})

test('extendByDays se resuelve a una fecha ISO en el momento de parsear', () => {
  const out = parseBulkCreateInputs({ count: 1, data: { name: 'x', expirationDate: { extendByDays: 14 } } })
  const expiration = out[0].expirationDate as string
  const drift = Math.abs(new Date(expiration).getTime() - (Date.now() + 14 * DAY))
  assert.ok(drift < 5000, `extendByDays se desvió ${drift} ms`)
})

test('un Date se normaliza a ISO y un string se deja pasar', () => {
  const when = new Date('2027-05-01T00:00:00.000Z')
  assert.equal(
    parseBulkCreateInputs({ count: 1, data: { name: 'x', expirationDate: when } })[0].expirationDate,
    '2027-05-01T00:00:00.000Z'
  )
  assert.equal(
    parseBulkCreateInputs({ count: 1, data: { name: 'x', expirationDate: '2027-05-01' } })[0].expirationDate,
    '2027-05-01'
  )
})

test('expirationDate null sigue significando "no caduca"', () => {
  const out = parseBulkCreateInputs({ count: 2, data: { name: 'x', expirationDate: null } })
  assert.equal(out[0].expirationDate, null)
  assert.equal(out[1].expirationDate, null)
})

test('una forma de expirationDate desconocida falla en vez de inventar una fecha', () => {
  assert.throws(
    () => parseBulkCreateInputs({ count: 1, data: { name: 'x', expirationDate: 42 } }),
    /Invalid expirationDate/
  )
  assert.throws(
    () => parseBulkCreateInputs({ count: 1, data: { name: 'x', expirationDate: { extendByDays: 'pronto' } } }),
    /extendByDays must be a number/
  )
})

test('no muta la plantilla que le pasaron', () => {
  const template = { count: 2, data: { name: 'x' } }
  parseBulkCreateInputs(template)
  assert.deepEqual(template, { count: 2, data: { name: 'x' } })
})
