import { csvCell } from './csv.ts'

function assertEquals(actual: unknown, expected: unknown) {
  if (actual !== expected) throw new Error(`Expected ${String(expected)}, received ${String(actual)}`)
}

Deno.test('csvCell escapes quotes and wraps values', () => {
  assertEquals(csvCell('Ada "Lovelace"'), '"Ada ""Lovelace"""')
})

Deno.test('csvCell neutralizes spreadsheet formulas after leading whitespace', () => {
  assertEquals(csvCell('  =HYPERLINK("https://example.test")'), '"\'  =HYPERLINK(""https://example.test"")"')
  assertEquals(csvCell('+SUM(1,2)'), '"\'+SUM(1,2)"')
  assertEquals(csvCell('@malicious'), '"\'@malicious"')
})

Deno.test('csvCell neutralizes control-character formula prefixes', () => {
  assertEquals(csvCell('\t=SUM(1,2)'), '"\'\t=SUM(1,2)"')
  assertEquals(csvCell('\r@malicious'), '"\'\r@malicious"')
  assertEquals(csvCell('=Demo CSV'), '"\'=Demo CSV"')
})
