export function csvCell(value: unknown) {
  const raw = String(value ?? '')
  const safe = /^(?:[=+@-]|\t|\r)/.test(raw.trimStart()) ? `'${raw}` : raw
  return `"${safe.replaceAll('"', '""')}"`
}
