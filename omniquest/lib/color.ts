export function withAlpha(hexColor: string, alphaHex: string) {
  if (!/^#[0-9A-F]{6}$/i.test(hexColor)) return hexColor
  return `${hexColor}${alphaHex}`
}
