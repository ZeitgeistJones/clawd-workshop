export const MAX_NAME = 20;
export const MAX_TEXT = 240;
export function cleanName(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  return name && name.length <= MAX_NAME && /^[\p{L}\p{N} _.'-]+$/u.test(name) ? name : null;
}
export function cleanText(raw) {
  if (typeof raw !== 'string') return null;
  const text = raw.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  return text && text.length <= MAX_TEXT ? text : null;
}
/** Case-insensitive key for client-side mute lists. */
export function muteKey(name) {
  const cleaned = cleanName(name);
  return cleaned ? cleaned.toLowerCase() : null;
}
