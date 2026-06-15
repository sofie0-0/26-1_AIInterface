/* ─────────────────── API 재시도 헬퍼 ───────────────────

 * 503/500/429(과부하·일시오류)는 재시도로 해결되는 경우가 많다.

 * 1차 실패 → 1초 대기 후 재시도 → 2차 실패 → 2초 대기 후 재시도 → 포기

 * ─────────────────────────────────────────────────────── */

const RETRY_DELAYS = [1000, 2000, 5000];



/** fetch / OpenAI SDK 오류에서 HTTP 상태 코드 추출 */

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



  // OpenAI SDK (OpenAI.APIError)

  if (err?.error?.type === 'insufficient_quota') return 429;

  if (err?.error?.type === 'rate_limit_exceeded') return 429;

  if (err?.error?.type === 'server_error') return 500;



  if (/\bUNAVAILABLE\b/i.test(msg) || /model is overloaded/i.test(msg)) return 503;

  if (/\bRESOURCE_EXHAUSTED\b/i.test(msg) || /quota exceeded/i.test(msg)) return 429;

  if (/rate_limit_exceeded/i.test(msg) || /insufficient_quota/i.test(msg)) return 429;



  const statusMatch = msg.match(/\b(503|500|429)\b/);

  if (statusMatch) return Number(statusMatch[1]);



  return null;

}



export function isRetryableError(err) {

  const status = extractHttpStatus(err);

  if (status === 503 || status === 500 || status === 429) return true;



  const msg    = (err?.message ?? '').toLowerCase();

  return (

    msg.includes('503') || msg.includes('500') || msg.includes('429') ||

    msg.includes('overload') || msg.includes('unavailable') ||

    msg.includes('failed to fetch') || msg.includes('network')

  );

}



/** OpenAI ChatCompletion usage → Summary 집계용 숫자 */

export function parseOpenAITokenUsage(usage) {

  if (!usage) return null;



  const promptTokens = usage.prompt_tokens ?? 0;

  const outputTokens = usage.completion_tokens ?? 0;

  const totalTokens  = usage.total_tokens ?? (promptTokens + outputTokens);



  if (promptTokens === 0 && outputTokens === 0 && totalTokens === 0) return null;



  return { promptTokens, outputTokens, totalTokens };

}



/** HTTP 상태(429/503 등)에 따라 사용자-facing 오류 문구 선택 */

export function getApiErrorMessage(err, { msg503, msg429, fallback }) {

  const status = extractHttpStatus(err);

  if (status === 429) return msg429 ?? fallback;

  if (status === 503 || status === 500) return msg503 ?? fallback;

  return fallback;

}



/** OpenAI chat.completions.create 스트림 (choices[].delta.content, usage) */

export async function callOpenAIStreamWithRetry(streamFn, onChunk) {

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {

    try {

      const stream = await streamFn();

      let full = '';

      let usage = null;

      for await (const chunk of stream) {

        const delta = chunk.choices?.[0]?.delta?.content ?? '';

        if (delta) {

          full += delta;

          onChunk(full);

        }

        if (chunk.usage) usage = chunk.usage;

      }

      return { text: full, usage };

    } catch (err) {

      const isLast    = attempt === RETRY_DELAYS.length;

      const retryable = isRetryableError(err);

      console.error(`[OpenAI API] 시도 ${attempt + 1} 실패 (retryable=${retryable}):`, err);

      if (isLast || !retryable) throw err;

      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));

    }

  }

}


