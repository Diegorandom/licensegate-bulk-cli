import { test } from 'node:test'
import assert from 'node:assert/strict'
import { csvRowsToObjects, parseCsv } from '../src/licensegate/key-files/csv'
import { extractScopes } from '../src/licensegate/key-files/scopes'

/**
 * Este parser escribe ficheros de clave en disco. Comillas dentro de un campo,
 * CRLF y BOM son los tres casos que un `split(',')` rompe en silencio: la clave
 * sale con una comilla pegada y el cliente no puede activar.
 */

test('CSV simple con cabecera', () => {
  assert.deepEqual(parseCsv('a,b\n1,2\n3,4'), [
    ['a', 'b'],
    ['1', '2'],
    ['3', '4'],
  ])
})

test('CRLF del Excel de Windows no deja \\r dentro de la celda', () => {
  assert.deepEqual(parseCsv('a,b\r\n1,2\r\n'), [
    ['a', 'b'],
    ['1', '2'],
  ])
})

test('comillas dobles escapan la coma y las comillas', () => {
  assert.deepEqual(parseCsv('scope,key\npro,"a,b"\npro,"di ""hola"""'), [
    ['scope', 'key'],
    ['pro', 'a,b'],
    ['pro', 'di "hola"'],
  ])
})

test('un salto de línea dentro de comillas no parte la fila', () => {
  assert.deepEqual(parseCsv('scope,notes\npro,"una\ndos"'), [
    ['scope', 'notes'],
    ['pro', 'una\ndos'],
  ])
})

test('separa por punto y coma cuando el fichero lo usa', () => {
  assert.deepEqual(parseCsv('scope;key\npro;ABC-123'), [
    ['scope', 'key'],
    ['pro', 'ABC-123'],
  ])
})

test('las líneas vacías no producen filas fantasma', () => {
  assert.deepEqual(parseCsv('a,b\n\n1,2\n\n'), [
    ['a', 'b'],
    ['1', '2'],
  ])
})

test('la última línea sin salto final no se pierde', () => {
  assert.deepEqual(parseCsv('a,b\n1,2'), [
    ['a', 'b'],
    ['1', '2'],
  ])
})

test('recorta espacios alrededor de las celdas', () => {
  assert.deepEqual(parseCsv('a , b\n 1 , 2 '), [
    ['a', 'b'],
    ['1', '2'],
  ])
})

test('csvRowsToObjects normaliza la cabecera (BOM, mayúsculas, espacios)', () => {
  const rows = parseCsv('\ufeffLicense Scope,License Key\npro,ABC\n')
  assert.deepEqual(csvRowsToObjects(rows), [{ license_scope: 'pro', license_key: 'ABC' }])
})

test('csvRowsToObjects rellena con cadena vacía la columna que falta', () => {
  const rows = parseCsv('scope,key,notes\npro,ABC')
  assert.deepEqual(csvRowsToObjects(rows), [{ scope: 'pro', key: 'ABC', notes: '' }])
})

test('csvRowsToObjects con sólo cabecera devuelve lista vacía', () => {
  assert.deepEqual(csvRowsToObjects([['scope', 'key']]), [])
  assert.deepEqual(csvRowsToObjects([]), [])
})

test('extractScopes recorta, deduplica y descarta los vacíos', () => {
  const scopes = extractScopes([
    { scope: ' pro ', data: {} },
    { scope: 'pro', data: {} },
    { scope: '', data: {} },
    { data: {} },
    { scope: 'basic', data: {} },
  ])
  assert.deepEqual(scopes, ['pro', 'basic'])
})
