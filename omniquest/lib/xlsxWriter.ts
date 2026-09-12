export type XlsxCellStyle = 'default' | 'title' | 'label' | 'header' | 'percent' | 'date' | 'datetime' | 'integer' | 'decimal' | 'warning' | 'wrap' | 'border'

export type XlsxCellValue = string | number | Date | null | undefined

export type XlsxCell = {
  value: XlsxCellValue
  style?: XlsxCellStyle
}

export type XlsxAutoFilter = {
  fromRow: number
  toRow: number
  fromColumn?: number
  toColumn: number
}

export type XlsxSheet = {
  name: string
  rows: XlsxCell[][]
  columnWidths?: number[]
  freezeRows?: number
  autoFilter?: XlsxAutoFilter
  merges?: string[]
}

const STYLE_INDEX: Record<XlsxCellStyle, number> = {
  default: 0,
  title: 1,
  label: 2,
  header: 3,
  percent: 4,
  date: 5,
  datetime: 6,
  integer: 7,
  decimal: 8,
  warning: 9,
  wrap: 10,
  border: 11,
}

export function buildXlsxWorkbook(sheets: XlsxSheet[]) {
  if (!sheets.length) throw new Error('El informe Excel necesita al menos una hoja.')

  const files: { name: string; data: Uint8Array }[] = []
  files.push({ name: '[Content_Types].xml', data: utf8Bytes(contentTypesXml(sheets.length)) })
  files.push({ name: '_rels/.rels', data: utf8Bytes(rootRelationshipsXml()) })
  files.push({ name: 'xl/workbook.xml', data: utf8Bytes(workbookXml(sheets)) })
  files.push({ name: 'xl/_rels/workbook.xml.rels', data: utf8Bytes(workbookRelationshipsXml(sheets.length)) })
  files.push({ name: 'xl/styles.xml', data: utf8Bytes(stylesXml()) })
  sheets.forEach((sheet, index) => files.push({ name: `xl/worksheets/sheet${index + 1}.xml`, data: utf8Bytes(worksheetXml(sheet)) }))
  return createStoredZip(files)
}

function worksheetXml(sheet: XlsxSheet) {
  const maxColumns = Math.max(1, ...sheet.rows.map((row) => row.length))
  const maxRows = Math.max(1, sheet.rows.length)
  const dimension = `A1:${columnName(maxColumns)}${maxRows}`
  const views = sheet.freezeRows && sheet.freezeRows > 0
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${sheet.freezeRows}" topLeftCell="A${sheet.freezeRows + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>'
  const columns = sheet.columnWidths?.length
    ? `<cols>${sheet.columnWidths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${clampWidth(width)}" customWidth="1"/>`).join('')}</cols>`
    : ''
  const rows = sheet.rows.map((row, rowIndex) => {
    const rowNumber = rowIndex + 1
    const cells = row.map((cell, columnIndex) => cellXml(cell, rowNumber, columnIndex + 1)).filter(Boolean).join('')
    return `<row r="${rowNumber}">${cells}</row>`
  }).join('')
  const autoFilter = sheet.autoFilter
    ? `<autoFilter ref="${columnName(sheet.autoFilter.fromColumn || 1)}${sheet.autoFilter.fromRow}:${columnName(sheet.autoFilter.toColumn)}${sheet.autoFilter.toRow}"/>`
    : ''
  const merges = sheet.merges?.length ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map((ref) => `<mergeCell ref="${escapeXmlAttribute(ref)}"/>`).join('')}</mergeCells>` : ''

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<dimension ref="${dimension}"/>${views}<sheetFormatPr defaultRowHeight="15"/>${columns}<sheetData>${rows}</sheetData>${autoFilter}${merges}` +
    `<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>` +
    `</worksheet>`
}

function cellXml(cell: XlsxCell, rowNumber: number, columnNumber: number) {
  if (cell.value === null || cell.value === undefined) return ''
  const reference = `${columnName(columnNumber)}${rowNumber}`
  const styleIndex = STYLE_INDEX[cell.style || 'default']
  const style = styleIndex ? ` s="${styleIndex}"` : ''

  if (cell.value instanceof Date) {
    if (Number.isNaN(cell.value.getTime())) return ''
    return `<c r="${reference}"${style}><v>${excelDateSerial(cell.value)}</v></c>`
  }
  if (typeof cell.value === 'number') {
    if (!Number.isFinite(cell.value)) return ''
    return `<c r="${reference}"${style}><v>${cell.value}</v></c>`
  }
  return `<c r="${reference}" t="inlineStr"${style}><is><t xml:space="preserve">${escapeXml(String(cell.value))}</t></is></c>`
}

function workbookXml(sheets: XlsxSheet[]) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="16000" windowHeight="9000"/></bookViews>` +
    `<sheets>${sheets.map((sheet, index) => `<sheet name="${escapeXmlAttribute(sheet.name.slice(0, 31) || `Hoja ${index + 1}`)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets>` +
    `</workbook>`
}

function workbookRelationshipsXml(sheetCount: number) {
  const worksheetRels = Array.from({ length: sheetCount }, (_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${worksheetRels}<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
}

function rootRelationshipsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
}

function contentTypesXml(sheetCount: number) {
  const worksheetOverrides = Array.from({ length: sheetCount }, (_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${worksheetOverrides}</Types>`
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<numFmts count="4"><numFmt numFmtId="164" formatCode="0.0%"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/><numFmt numFmtId="166" formatCode="dd/mm/yyyy hh:mm"/><numFmt numFmtId="167" formatCode="#,##0"/></numFmts>` +
    `<fonts count="3"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/><color rgb="FF0B172A"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/><color rgb="FFFFFFFF"/></font></fonts>` +
    `<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF09ACF4"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE6F7FE"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/><bgColor indexed="64"/></patternFill></fill></fills>` +
    `<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD7DEE8"/></left><right style="thin"><color rgb="FFD7DEE8"/></right><top style="thin"><color rgb="FFD7DEE8"/></top><bottom style="thin"><color rgb="FFD7DEE8"/></bottom><diagonal/></border></borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="12">` +
      `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
      `<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>` +
      `<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>` +
      `<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>` +
      `<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>` +
      `<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>` +
      `<xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>` +
      `<xf numFmtId="167" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>` +
      `<xf numFmtId="2" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>` +
      `<xf numFmtId="0" fontId="1" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>` +
      `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>` +
      `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>` +
    `</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
}

function excelDateSerial(date: Date) {
  const wallClockUtc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds())
  return wallClockUtc / 86400000 + 25569
}

function columnName(index: number) {
  let value = index
  let name = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    name = String.fromCharCode(65 + remainder) + name
    value = Math.floor((value - 1) / 26)
  }
  return name || 'A'
}

function clampWidth(value: number) {
  if (!Number.isFinite(value)) return 12
  return Math.max(4, Math.min(80, value))
}

function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeXmlAttribute(value: string) {
  return escapeXml(value).replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function utf8Bytes(value: string) {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value)
  const bytes: number[] = []
  for (const char of value) {
    const codePoint = char.codePointAt(0) || 0
    if (codePoint <= 0x7f) bytes.push(codePoint)
    else if (codePoint <= 0x7ff) bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f))
    else if (codePoint <= 0xffff) bytes.push(0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f))
    else bytes.push(0xf0 | (codePoint >> 18), 0x80 | ((codePoint >> 12) & 0x3f), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f))
  }
  return new Uint8Array(bytes)
}

function createStoredZip(files: { name: string; data: Uint8Array }[]) {
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0

  for (const file of files) {
    const name = utf8Bytes(file.name)
    const crc = crc32(file.data)
    const local = new Uint8Array(30 + name.length + file.data.length)
    const localView = new DataView(local.buffer)
    localView.setUint32(0, 0x04034b50, true)
    localView.setUint16(4, 20, true)
    localView.setUint16(6, 0x0800, true)
    localView.setUint16(8, 0, true)
    localView.setUint16(10, 0, true)
    localView.setUint16(12, 0, true)
    localView.setUint32(14, crc, true)
    localView.setUint32(18, file.data.length, true)
    localView.setUint32(22, file.data.length, true)
    localView.setUint16(26, name.length, true)
    localView.setUint16(28, 0, true)
    local.set(name, 30)
    local.set(file.data, 30 + name.length)
    localParts.push(local)

    const central = new Uint8Array(46 + name.length)
    const centralView = new DataView(central.buffer)
    centralView.setUint32(0, 0x02014b50, true)
    centralView.setUint16(4, 20, true)
    centralView.setUint16(6, 20, true)
    centralView.setUint16(8, 0x0800, true)
    centralView.setUint16(10, 0, true)
    centralView.setUint16(12, 0, true)
    centralView.setUint16(14, 0, true)
    centralView.setUint32(16, crc, true)
    centralView.setUint32(20, file.data.length, true)
    centralView.setUint32(24, file.data.length, true)
    centralView.setUint16(28, name.length, true)
    centralView.setUint16(30, 0, true)
    centralView.setUint16(32, 0, true)
    centralView.setUint16(34, 0, true)
    centralView.setUint16(36, 0, true)
    centralView.setUint32(38, 0, true)
    centralView.setUint32(42, offset, true)
    central.set(name, 46)
    centralParts.push(central)
    offset += local.length
  }

  const centralOffset = offset
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true)
  endView.setUint16(4, 0, true)
  endView.setUint16(6, 0, true)
  endView.setUint16(8, files.length, true)
  endView.setUint16(10, files.length, true)
  endView.setUint32(12, centralSize, true)
  endView.setUint32(16, centralOffset, true)
  endView.setUint16(20, 0, true)

  return concatBytes([...localParts, ...centralParts, end])
}

function concatBytes(parts: Uint8Array[]) {
  const size = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(size)
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

const CRC_TABLE = createCrcTable()
function createCrcTable() {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
