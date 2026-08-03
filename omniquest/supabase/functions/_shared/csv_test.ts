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
