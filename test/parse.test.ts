import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { parseArgs } from '../src/cli/parse'

/**
 * `parseArgs` es la única puerta entre "el humano escribió algo" y "el programa
 * manda un PATCH contra la API real". Los tests de aquí abajo existen porque un
 * error en un default no se ve: se ejecuta.
 */

const SAVED = { ...process.env }

beforeEach(() => {
  process.env.LICENSEGATE_API_KEY = 'test-key'
  delete process.env.LICENSEGATE_BASE_URL
})

afterEach(() => {
  process.env = { ...SAVED }
})

test('reactivate: sin --yes es dry-run (el default seguro es no escribir)', () => {
  const opts = parseArgs(['reactivate', '--key', 'ABC-123'])
  assert.equal(opts.dryRun, true)
  assert.equal(opts.command, 'reactivate')
  assert.equal(opts.days, 30)
  assert.equal(opts.concurrency, 1)
})

test('reactivate: --yes es lo único que desarma el dry-run', () => {
  const opts = parseArgs(['reactivate', '--key', 'ABC-123', '--yes', '--days', '7'])
  assert.equal(opts.dryRun, false)
  assert.equal(opts.days, 7)
})

test('reactivate: --days no numérico o <= 0 se rechaza', () => {
  assert.throws(() => parseArgs(['reactivate', '--key', 'K', '--days', '0']), /positive/)
  assert.throws(() => parseArgs(['reactivate', '--key', 'K', '--days', 'treinta']), /positive/)
})

test('reactivate: sin --key falla en vez de adivinar', () => {
  assert.throws(() => parseArgs(['reactivate']), /requires --key/)
})

test('bulk-update: escribe por defecto; --dry-run es la única red', () => {
  const writes = parseArgs(['bulk-update', '--input', 'plan.json'])
  assert.equal(writes.dryRun, false)
  // `yes` es false, no undefined, en las ramas que no son reactivate.
  assert.equal(writes.yes, false)

  const rehearses = parseArgs(['bulk-update', '--input', 'plan.json', '--dry-run'])
  assert.equal(rehearses.dryRun, true)
})

test('bulk-update: --yes se registra aparte del dry-run', () => {
  const opts = parseArgs(['bulk-update', '--input', 'plan.json', '--yes'])
  assert.equal(opts.yes, true)
  assert.equal(opts.dryRun, false)
  assert.equal(opts.maxTargets, 50)
})

test('--max cae a 50 cuando el valor no sirve', () => {
  assert.equal(parseArgs(['bulk-update', '--input', 'p.json', '--max', '0']).maxTargets, 50)
  assert.equal(parseArgs(['bulk-update', '--input', 'p.json', '--max', '-3']).maxTargets, 50)
  assert.equal(parseArgs(['bulk-update', '--input', 'p.json', '--max', 'muchos']).maxTargets, 50)
  assert.equal(parseArgs(['bulk-update', '--input', 'p.json', '--max', '7']).maxTargets, 7)
})

test('--concurrency nunca baja de 1 y cae a 5 si no es número', () => {
  assert.equal(parseArgs(['bulk-create', '--input', 'p.json', '--concurrency', '0']).concurrency, 1)
  assert.equal(parseArgs(['bulk-create', '--input', 'p.json', '--concurrency', '-9']).concurrency, 1)
  assert.equal(parseArgs(['bulk-create', '--input', 'p.json', '--concurrency', 'x']).concurrency, 5)
  assert.equal(parseArgs(['bulk-create', '--input', 'p.json', '--concurrency', '3.7']).concurrency, 3)
})

test('sin api key no hay opciones: falla antes de tocar la red', () => {
  delete process.env.LICENSEGATE_API_KEY
  assert.throws(() => parseArgs(['bulk-create', '--input', 'p.json']), /Missing --api-key/)
})

test('la api key y la base url salen del entorno cuando no hay flag', () => {
  process.env.LICENSEGATE_BASE_URL = 'https://self.hosted.example'
  const opts = parseArgs(['bulk-create', '--input', 'p.json'])
  assert.equal(opts.apiKey, 'test-key')
  assert.equal(opts.baseUrl, 'https://self.hosted.example')

  const flagged = parseArgs(['bulk-create', '--input', 'p.json', '--base-url', 'https://other.example'])
  assert.equal(flagged.baseUrl, 'https://other.example')
})

test('un comando desconocido devuelve la ayuda, no un error opaco', () => {
  assert.throws(() => parseArgs(['borrar-todo']), /Usage:/)
})

test('un argumento suelto o un flag sin valor se rechazan', () => {
  assert.throws(() => parseArgs(['bulk-create', 'suelto']), /Unexpected argument/)
  assert.throws(() => parseArgs(['bulk-create', '--input']), /Missing value/)
  assert.throws(() => parseArgs(['bulk-create', '--input', '--dry-run']), /Missing value/)
})

test('bulk-create sin --input falla en vez de crear cero licencias en silencio', () => {
  assert.throws(() => parseArgs(['bulk-create']), /Missing --input/)
})

test('--report se propaga tal cual y no se interpreta', () => {
  const opts = parseArgs(['bulk-update', '--input', 'p.json', '--report', 'out/run.json'])
  assert.equal(opts.report, 'out/run.json')
})
