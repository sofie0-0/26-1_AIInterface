/* ─────────────────── API 재시도 헬퍼 ───────────────────
 * Vercel Hobby 10초 제한 대비: 짧은 백오프 + 7초 총 예산 후 즉시 실패.
 * 503/500/429 → 0.3s → 0.6s → 1.2s 대기 후 재시도 (최대 4회 시도, 대기 합 ~2.1s)
 * ─────────────────────────────────────────────────────── */

export const API_OVERLOAD_USER_MESSAGE =
  'AI 서버가 혼잡합니다. 잠시 후 다시 시도해주세요.';

const RETRY_DELAYS_MS = [300, 600, 1200];
const MAX_RETRY_BUDGET_MS = 7000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** @google/genai · fetch 계열 오류에서 HTTP 상태 코드 추출 */
export function extractHttpStatus(err) {
  if (!err) return null;

  const candidates = [
    err.status,
    err.statusCode,
    err.httpError?.statusCode,
    err.response?.status,
    err.cause?.status,
    err.cause?.statusCode,
  ];
  for (const v of candidates) {
    const n = Number(v);
    if (!Number.isNaN(n) && n > 0) return n;
  }

  const msg = String(err.message ?? '');

  try {
    const parsed = JSON.parse(msg);
    const code = parsed?.error?.code;
    if (typeof code === 'number') return code;
  } catch {
    // message가 JSON이 아닌 경우 무시
  }

  const jsonCodeMatch = msg.match(/"code"\s*:\s*(503|500|429)/);
  if (jsonCodeMatch) return Number(jsonCodeMatch[1]);

  if (/\bUNAVAILABLE\b/i.test(msg) || /model is overloaded/i.test(msg)) return 503;

  const statusMatch = msg.match(/\b(503|500|429)\b/);
  if (statusMatch) return Number(statusMatch[1]);

  return null;
}

export function isRetryableError(err) {
  const status = extractHttpStatus(err);
  if (status === 503 || status === 500 || status === 429) return true;

  const msg  = String(err?.message ?? '').toLowerCase();
  const name = String(err?.name ?? '').toLowerCase();

  return (
    (name === 'apierror' && (msg.includes('unavailable') || msg.includes('overload'))) ||
    msg.includes('503') || msg.includes('500') || msg.includes('429') ||
    msg.includes('overload') || msg.includes('unavailable') ||
    msg.includes('resource_exhausted') ||
    msg.includes('service unavailable') ||
    msg.includes('failed to fetch') || msg.includes('network')
  );
}

export class ApiOverloadError extends Error {
  constructor(cause, userMessage = API_OVERLOAD_USER_MESSAGE) {
    super(userMessage);
    this.name = 'ApiOverloadError';
    this.userMessage = userMessage;
    this.cause = cause;
    this.status = extractHttpStatus(cause);
  }
}

export function getApiErrorMessage(err, fallback = API_OVERLOAD_USER_MESSAGE) {
  if (err?.userMessage) return err.userMessage;
  return fallback;
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

function decideAfterFailure(err, attempt, startedAt) {
  if (!isRetryableError(err)) {
    return { action: 'throw' };
  }

  const isLastAttempt = attempt >= RETRY_DELAYS_MS.length;
  const elapsed = Date.now() - startedAt;

  if (isLastAttempt || elapsed >= MAX_RETRY_BUDGET_MS) {
    return { action: 'overload' };
  }

  const delay = RETRY_DELAYS_MS[attempt];
  if (elapsed + delay > MAX_RETRY_BUDGET_MS) {
    return { action: 'overload' };
  }

  return { action: 'retry', delay };
}

export async function callStreamWithRetry(streamFn, onChunk) {
  const startedAt = Date.now();

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
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
      const status    = extractHttpStatus(err);
      const retryable = isRetryableError(err);
      const elapsed   = Date.now() - startedAt;

      console.error(
        `[Gemini API] 시도 ${attempt + 1}/${RETRY_DELAYS_MS.length + 1} 실패` +
        ` (${elapsed}ms 경과, status=${status ?? 'n/a'}, retryable=${retryable}):`,
        err,
      );

      const decision = decideAfterFailure(err, attempt, startedAt);

      if (decision.action === 'throw') throw err;
      if (decision.action === 'overload') throw new ApiOverloadError(err);

      console.info(`[Gemini API] ${decision.delay}ms 후 재시도...`);
      await sleep(decision.delay);
    }
  }

  throw new ApiOverloadError(new Error('Gemini API retry exhausted'));
}
