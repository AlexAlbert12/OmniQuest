import { buildXlsxWorkbook } from '../../../lib/xlsxWriter'

describe('xlsxWriter', () => {
  it('creates a real OOXML ZIP with styled numeric, percent and date cells', () => {
    const workbook = buildXlsxWorkbook([{
      name: 'Resumen',
      rows: [
        [{ value: 'OmniQuest', style: 'title' }],
        [{ value: 'Métrica', style: 'header' }, { value: 'Resultado', style: 'header' }],
        [{ value: 'Tasa', style: 'border' }, { value: 0.875, style: 'percent' }],
        [{ value: 'Fecha', style: 'border' }, { value: new Date('2026-09-12T00:00:00Z'), style: 'date' }],
      ],
      freezeRows: 2,
      autoFilter: { fromRow: 2, toRow: 4, toColumn: 2 },
    }])

    expect(Array.from(workbook.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04])
    const raw = new TextDecoder().decode(workbook)
    expect(raw).toContain('xl/workbook.xml')
    expect(raw).toContain('Resumen')
    expect(raw).toContain('0.875')
    expect(raw).toContain('formatCode="0.0%"')
    expect(raw).toContain('autoFilter ref="A2:B4"')
    expect(raw).toContain('state="frozen"')
  })
})
