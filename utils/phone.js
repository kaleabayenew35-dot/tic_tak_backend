export function normalizePhone(phone) {
  if (!phone) return ''
  const clean = String(phone).replace(/\D/g, '')
  if (clean.length >= 9) {
    return '251' + clean.slice(-9)
  }
  return clean
}
