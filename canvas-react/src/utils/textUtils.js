/* ─────────────────── 순수 텍스트 유틸 ─────────────────── */

export function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

export function truncateTitle(text, maxLen = 18) {
  const first = String(text || '').split('\n')[0].trim();
  if (!first) return 'Untitled';
  return first.length > maxLen ? `${first.slice(0, maxLen)}…` : first;
}
