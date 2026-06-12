/* ─────────────────── API 재시도 헬퍼 ───────────────────
 * 503/500/429(과부하·일시오류)는 재시도로 해결되는 경우가 많다.
 * 1차 실패 → 1초 대기 후 재시도 → 2차 실패 → 2초 대기 후 재시도 → 포기
 * ─────────────────────────────────────────────────────── */
const RETRY_DELAYS = [1000, 2000, 5000];

export function isRetryableError(err) {
  const msg    = (err?.message ?? '').toLowerCase();
  const status = err?.status ?? err?.httpError?.statusCode;
  return (
    status === 503 || status === 500 || status === 429 ||
    msg.includes('503') || msg.includes('500') || msg.includes('429') ||
    msg.includes('overload') || msg.includes('unavailable') ||
    msg.includes('failed to fetch') || msg.includes('network')
  );
}

/** 스트림 마지막 청크의 usageMetadata → Summary 집계용 숫자 */
export function parseTokenUsage(usageMetadata) {
  if (!usageMetadata) return null;

  const promptTokens = usageMetadata.promptTokenCount ?? 0;
  const outputTokens = usageMetadata.candidatesTokenCount ?? 0;
  const totalTokens  = usageMetadata.totalTokenCount
    ?? (promptTokens + outputTokens);

  if (promptTokens === 0 && outputTokens === 0 && totalTokens === 0) return null;

  return { promptTokens, outputTokens, totalTokens };
}

export async function callStreamWithRetry(streamFn, onChunk) {
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const stream = await streamFn();
      let full = '';
      let usage = null;
      for await (const chunk of stream) {
        full += chunk.text ?? '';
        onChunk(full);
        if (chunk.usageMetadata) usage = chunk.usageMetadata;
      }
      return { text: full, usage };
    } catch (err) {
      const isLast     = attempt === RETRY_DELAYS.length;
      const retryable  = isRetryableError(err);
      console.error(`[Gemini API] 시도 ${attempt + 1} 실패 (retryable=${retryable}):`, err);
      if (isLast || !retryable) throw err;
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
    }
  }
}
