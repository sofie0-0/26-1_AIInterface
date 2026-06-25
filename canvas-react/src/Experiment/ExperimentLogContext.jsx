/**
 * ExperimentLogContext.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * HCI 사용자 실험 전용 로그 수집 컨텍스트.
 *
 * ● isExperimentActive === true 인 순간부터 이벤트를 기록한다.
 * ● ready_next 화면에서 다운로드 버튼 클릭 시 json/csv 저장 후 clearLogs() 호출.
 *
 * ■ 자동 수집 (글로벌 리스너)
 *   MOUSE_MOVE · SCROLL(+section) · SCROLL_PAUSE_UPWARD(+section) ·
 *   CONTEXT_SWITCH · KEYBOARD_TYPING
 *
 * ■ 컴포넌트에서 명시적으로 호출
 *   [공통]  AI_RESPONSE_WAIT · API_TOKEN_USAGE · API_ERROR
 *   [Traditional]  PROMPT_SUBMIT_TRADITIONAL
 *   [Proposed]  PROMPT_SUBMIT · MEMO_CREATE · MEMO_EDIT · MEMO_DELETE ·
 *               MAPS_TO_BODY · MAPS_TO_ELEMENT · MEMO_DRAG_DROP ·
 *               PARALLEL_WINDOW_CREATE · PARALLEL_WINDOW_REACTIVATE ·
 *               PARALLEL_WINDOW_DELETE
 *
 * ■ 스크롤 section 감지 규칙 (Proposed 전용, Traditional은 항상 "main_canvas")
 *   data-scroll-section="main_canvas"       — 메인 캔버스 배경
 *   data-scroll-section="toc"               — 세로 목차
 *   data-scroll-section="notes_panel"       — 좌측 메모 수납 구역
 *   data-scroll-section="parallel_window_[id]" — 병렬 대화창 내부
 *
 * 실험 종료 후 이 파일과 관련 import 한 줄씩만 제거하면 완전히 삭제된다.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useExperiment } from './ExperimentContext.jsx';

/* ─── 컨텍스트 ─── */
const ExperimentLogContext = createContext(null);

/* ─── 입력 요소 셀렉터 (KEYBOARD_TYPING 감지용) ─── */
const INPUT_SELECTOR =
  'input[type="text"], input:not([type]), textarea, [contenteditable="true"]';

/* ─────────────────────────────────────────────────────────────────────────── */
export function ExperimentLogProvider({ children }) {
  const { isExperimentActive, userId, interfaceType, blockIndex } =
    useExperiment();

  /* ── 로그 배열 ── */
  const [logs, setLogs] = useState([]);

  /* ── 실험 시작 시각 ── */
  const experimentStartTimeRef = useRef(null);

  useEffect(() => {
    if (isExperimentActive && experimentStartTimeRef.current === null) {
      experimentStartTimeRef.current = Date.now();
    }
    if (!isExperimentActive) {
      experimentStartTimeRef.current = null;
    }
  }, [isExperimentActive]);

  /* ── userId 변경 시 로그 전체 초기화 (다른 사용자 데이터 혼입 방지) ── */
  const prevUserIdRef = useRef(userId);
  useEffect(() => {
    if (prevUserIdRef.current !== userId) {
      setLogs([]);
      prevUserIdRef.current = userId;
    }
  }, [userId]);

  /* ─────────────────────────────────────────────────────────────────────────
   * 공통 로그 추가 — 모든 이벤트의 단일 진입점
   * ───────────────────────────────────────────────────────────────────────── */
  const logEvent = useCallback(
    (eventType, details = {}) => {
      if (!isExperimentActive) return;
      const entry = {
        userId,
        interfaceType,
        blockIndex,
        timestamp: new Date().toISOString(),
        eventType,
        details,
      };
      setLogs((prev) => [...prev, entry]);
    },
    [isExperimentActive, userId, interfaceType, blockIndex],
  );

  /* ── stale closure 방지용 최신 ref ── */
  const logEventRef      = useRef(logEvent);
  const isActiveRef      = useRef(isExperimentActive);
  const interfaceTypeRef = useRef(interfaceType);
  useEffect(() => { logEventRef.current      = logEvent; },      [logEvent]);
  useEffect(() => { isActiveRef.current      = isExperimentActive; }, [isExperimentActive]);
  useEffect(() => { interfaceTypeRef.current = interfaceType; },  [interfaceType]);

  /* ─────────────────────────────────────────────────────────────────────────
   * 내부 누적 refs
   * ───────────────────────────────────────────────────────────────────────── */
  const mouseMoveAcc     = useRef({ dist: 0, startTime: null, lastX: null, lastY: null });
  const mouseMoveTimer   = useRef(null);
  const scrollAcc        = useRef({
    dist: 0, startTime: null, section: null,
    backwardDist: 0,
    backwardCount: 0,
    backwardDurMs: 0,
    backwardActiveStart: null,
  });
  const scrollTimer      = useRef(null);
  const scrollUpAcc      = useRef({ startTime: null, section: null, pauseTimer: null });
  const lastScrollPosMap = useRef(new Map());
  const contextSwitch    = useRef({ departTime: null });
  const typingAcc        = useRef({ startTime: null, target: null });
  const typingIdleTimer  = useRef(null);
  const aiWait           = useRef({ startTime: null });
  const memoEdit         = useRef({ startTime: null, memoId: null });
  const dragDrop         = useRef({ startTime: null, memoId: null });

  /* ─────────────────────────────────────────────────────────────────────────
   * 스크롤 섹션 감지 헬퍼
   * data-scroll-section 속성을 가진 가장 가까운 조상을 찾아 반환.
   * Traditional은 항상 "main_canvas" 반환.
   * ───────────────────────────────────────────────────────────────────────── */
  function detectScrollSection(target) {
    if (interfaceTypeRef.current !== 'proposed') return 'main_canvas';
    let el = target instanceof Element ? target : null;
    while (el) {
      const sec = el.getAttribute?.('data-scroll-section');
      if (sec) return sec;
      el = el.parentElement;
    }
    return 'main_canvas';
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * [지표 1] MOUSE_MOVE
   * 50ms 스로틀 + 300ms 정지 후 배치 플러시
   * ═══════════════════════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!isExperimentActive) return;

    const THROTTLE_MS  = 50;
    const IDLE_TIMEOUT = 300;

    function flushMouseMove() {
      const acc = mouseMoveAcc.current;
      if (acc.dist > 0 && acc.startTime !== null) {
        logEventRef.current('MOUSE_MOVE', {
          distancePx: Math.round(acc.dist),
          durationMs: Date.now() - acc.startTime,
        });
        acc.dist = 0;
        acc.startTime = null;
      }
    }

    let lastCall = 0;
    function onMouseMove(e) {
      if (!isActiveRef.current) return;
      const now = Date.now();
      if (now - lastCall < THROTTLE_MS) return;
      lastCall = now;

      const acc = mouseMoveAcc.current;
      if (acc.lastX !== null && acc.lastY !== null) {
        const dx = e.clientX - acc.lastX;
        const dy = e.clientY - acc.lastY;
        acc.dist += Math.sqrt(dx * dx + dy * dy);
      }
      if (acc.startTime === null) acc.startTime = Date.now();
      acc.lastX = e.clientX;
      acc.lastY = e.clientY;

      clearTimeout(mouseMoveTimer.current);
      mouseMoveTimer.current = setTimeout(() => {
        flushMouseMove();
        acc.lastX = null;
        acc.lastY = null;
      }, IDLE_TIMEOUT);
    }

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      clearTimeout(mouseMoveTimer.current);
      flushMouseMove();
    };
  }, [isExperimentActive]);

  /* ═══════════════════════════════════════════════════════════════════════════
   * [지표 1 & 3] SCROLL + SCROLL_PAUSE_UPWARD (section 포함)
   *
   * · 300ms 정지 → SCROLL 플러시 (details.section + backward* 3필드 포함)
   * · 위방향 스크롤 후 300ms 정지 → 1000ms 대기 → SCROLL_PAUSE_UPWARD
   * ═══════════════════════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!isExperimentActive) return;

    const SCROLL_IDLE = 300;
    const PAUSE_WAIT  = 1000;

    function flushScroll() {
      const acc = scrollAcc.current;
      if (acc.backwardActiveStart !== null) {
        acc.backwardDurMs += Date.now() - acc.backwardActiveStart;
        acc.backwardActiveStart = null;
      }
      if (acc.dist > 0 && acc.startTime !== null) {
        logEventRef.current('SCROLL', {
          distancePx: Math.round(acc.dist),
          durationMs: Date.now() - acc.startTime,
          section:    acc.section ?? 'main_canvas',
          backwardDistancePx: Math.round(acc.backwardDist),
          backwardCount:      acc.backwardCount,
          backwardDurationMs: acc.backwardDurMs,
        });
        acc.dist    = 0;
        acc.startTime = null;
        acc.section = null;
        acc.backwardDist = 0;
        acc.backwardCount = 0;
        acc.backwardDurMs = 0;
        acc.backwardActiveStart = null;
      }
    }

    function onScroll(e) {
      if (!isActiveRef.current) return;

      const target  = (e.target === document || e.target === document.documentElement)
        ? document.documentElement
        : e.target;
      const section = detectScrollSection(target);

      const currentY = target.scrollTop ?? 0;
      const posMap   = lastScrollPosMap.current;
      const lastY    = posMap.has(target) ? posMap.get(target) : currentY;
      const delta    = currentY - lastY;
      posMap.set(target, currentY);

      /* SCROLL 누적 */
      const acc = scrollAcc.current;
      acc.dist += Math.abs(delta);
      if (acc.startTime === null) {
        acc.startTime = Date.now();
        acc.section   = section;
      }

      /* Backward Navigation 누적 (SCROLL details 확장) */
      const now = Date.now();
      if (delta < 0) {
        acc.backwardDist += -delta;
        if (acc.backwardActiveStart === null) {
          acc.backwardActiveStart = now;
          acc.backwardCount += 1;
        }
      } else if (delta > 0 && acc.backwardActiveStart !== null) {
        acc.backwardDurMs += now - acc.backwardActiveStart;
        acc.backwardActiveStart = null;
      }

      /* 위방향 스크롤 세션 시작 */
      const upAcc = scrollUpAcc.current;
      if (delta < 0 && upAcc.startTime === null) {
        upAcc.startTime = Date.now();
        upAcc.section   = section;
      }
      /* 아래방향 → 위방향 세션 취소 */
      if (delta > 0 && upAcc.startTime !== null) {
        clearTimeout(upAcc.pauseTimer);
        upAcc.startTime  = null;
        upAcc.section    = null;
        upAcc.pauseTimer = null;
      }

      clearTimeout(scrollTimer.current);
      scrollTimer.current = setTimeout(() => {
        flushScroll();
        posMap.clear();

        if (upAcc.startTime !== null) {
          clearTimeout(upAcc.pauseTimer);
          const upStart   = upAcc.startTime;
          const upSection = upAcc.section;
          upAcc.pauseTimer = setTimeout(() => {
            logEventRef.current('SCROLL_PAUSE_UPWARD', {
              action: 'scroll_up_end_1s',
              scrollUpStartToEnd1sMs: Date.now() - upStart,
              section: upSection ?? 'main_canvas',
            });
            upAcc.startTime  = null;
            upAcc.section    = null;
            upAcc.pauseTimer = null;
          }, PAUSE_WAIT);
        }
      }, SCROLL_IDLE);
    }

    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener('scroll', onScroll, { capture: true });
      clearTimeout(scrollTimer.current);
      clearTimeout(scrollUpAcc.current.pauseTimer);
      flushScroll();
      lastScrollPosMap.current.clear();
    };
  }, [isExperimentActive]);

  /* ═══════════════════════════════════════════════════════════════════════════
   * [지표 2 & 5] CONTEXT_SWITCH
   * ═══════════════════════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!isExperimentActive) return;

    function onVisibilityChange() {
      if (!isActiveRef.current) return;
      const sw = contextSwitch.current;
      if (document.hidden) {
        sw.departTime = Date.now();
        logEventRef.current('CONTEXT_SWITCH', { action: 'leave', trigger: 'visibilitychange' });
      } else {
        const absenceMs = sw.departTime ? Date.now() - sw.departTime : 0;
        sw.departTime   = null;
        logEventRef.current('CONTEXT_SWITCH', { action: 'return', trigger: 'visibilitychange', absenceMs });
      }
    }

    function onWindowBlur() {
      if (!isActiveRef.current) return;
      const sw = contextSwitch.current;
      if (!sw.departTime) {
        sw.departTime = Date.now();
        logEventRef.current('CONTEXT_SWITCH', { action: 'leave', trigger: 'blur' });
      }
    }

    function onWindowFocus() {
      if (!isActiveRef.current) return;
      const sw = contextSwitch.current;
      if (sw.departTime) {
        const absenceMs = Date.now() - sw.departTime;
        sw.departTime   = null;
        logEventRef.current('CONTEXT_SWITCH', { action: 'return', trigger: 'focus', absenceMs });
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur',  onWindowBlur);
    window.addEventListener('focus', onWindowFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur',  onWindowBlur);
      window.removeEventListener('focus', onWindowFocus);
    };
  }, [isExperimentActive]);

  /* ═══════════════════════════════════════════════════════════════════════════
   * [지표 5] KEYBOARD_TYPING — 연속 입력 간 2초 공백 시 세션 종료
   * ═══════════════════════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!isExperimentActive) return;

    const TYPING_IDLE = 2000;

    function flushTyping() {
      const t = typingAcc.current;
      if (t.startTime !== null) {
        const durationMs = Date.now() - t.startTime;
        const textLength = t.target
          ? (t.target.value ?? t.target.textContent ?? '').length
          : 0;
        logEventRef.current('KEYBOARD_TYPING', { durationMs, textLength });
        t.startTime = null;
        t.target    = null;
      }
    }

    function onKeydown(e) {
      if (!isActiveRef.current) return;
      const el = e.target;
      if (!el.matches?.(INPUT_SELECTOR)) return;
      const t = typingAcc.current;
      if (t.startTime === null) { t.startTime = Date.now(); t.target = el; }
      clearTimeout(typingIdleTimer.current);
      typingIdleTimer.current = setTimeout(flushTyping, TYPING_IDLE);
    }

    function onFocusout(e) {
      if (!isActiveRef.current) return;
      if (!e.target.matches?.(INPUT_SELECTOR)) return;
      clearTimeout(typingIdleTimer.current);
      flushTyping();
    }

    document.addEventListener('keydown',  onKeydown,  { passive: true });
    document.addEventListener('focusout', onFocusout);
    return () => {
      document.removeEventListener('keydown',  onKeydown);
      document.removeEventListener('focusout', onFocusout);
      clearTimeout(typingIdleTimer.current);
      flushTyping();
    };
  }, [isExperimentActive]);

  /* ═══════════════════════════════════════════════════════════════════════════
   * [공통 지표 5] AI_RESPONSE_WAIT
   * ═══════════════════════════════════════════════════════════════════════════ */
  const startAIWait = useCallback(() => {
    aiWait.current.startTime = Date.now();
  }, []);

  const stopAIWait = useCallback(() => {
    const st = aiWait.current.startTime;
    if (st === null) return;
    const durationMs = Date.now() - st;
    aiWait.current.startTime = null;
    logEvent('AI_RESPONSE_WAIT', { durationMs });
  }, [logEvent]);

  /* ═══════════════════════════════════════════════════════════════════════════
   * [Traditional 지표 4] PROMPT_SUBMIT_TRADITIONAL
   * ═══════════════════════════════════════════════════════════════════════════ */
  const logPromptSubmitTraditional = useCallback(
    (details = {}) => logEvent('PROMPT_SUBMIT_TRADITIONAL', details),
    [logEvent],
  );

  /* ═══════════════════════════════════════════════════════════════════════════
   * [Proposed 지표 4] PROMPT_SUBMIT
   * details: { location: 'main'|'parallel', targetWindowId: string }
   * ═══════════════════════════════════════════════════════════════════════════ */
  const logPromptSubmit = useCallback(
    (details = {}) => logEvent('PROMPT_SUBMIT', details),
    [logEvent],
  );

  /* ═══════════════════════════════════════════════════════════════════════════
   * [Proposed 지표 4] MEMO_CREATE / MEMO_DELETE
   * ═══════════════════════════════════════════════════════════════════════════ */
  const logMemoCreate = useCallback(
    (details = {}) => logEvent('MEMO_CREATE', details),
    [logEvent],
  );

  const logMemoDelete = useCallback(
    (details = {}) => logEvent('MEMO_DELETE', details),
    [logEvent],
  );

  /* ═══════════════════════════════════════════════════════════════════════════
   * [Proposed 지표 4] MEMO_EDIT — focus → blur 사이클
   * startMemoEdit(memoId)
   * stopMemoEdit(memoId, textLength)
   * ═══════════════════════════════════════════════════════════════════════════ */
  const startMemoEdit = useCallback((memoId) => {
    memoEdit.current = { startTime: Date.now(), memoId };
  }, []);

  const stopMemoEdit = useCallback(
    (memoId, textLength = 0) => {
      const me = memoEdit.current;
      if (me.startTime === null) return;
      const durationMs = Date.now() - me.startTime;
      memoEdit.current = { startTime: null, memoId: null };
      logEvent('MEMO_EDIT', { memoId: memoId ?? me.memoId, durationMs, textLength });
    },
    [logEvent],
  );

  /* ═══════════════════════════════════════════════════════════════════════════
   * [Proposed 지표 4] MAPS_TO_BODY — 요소 → 본문 이동 버튼
   * details: { sourceType: 'memo'|'parallel_window', sourceId }
   * ═══════════════════════════════════════════════════════════════════════════ */
  const logMapsToBody = useCallback(
    (details = {}) => logEvent('MAPS_TO_BODY', details),
    [logEvent],
  );

  /* ═══════════════════════════════════════════════════════════════════════════
   * [Proposed 지표 4] MAPS_TO_ELEMENT — 본문 하이라이트 클릭 → 캔버스 요소 이동
   * details: { targetType: 'memo'|'parallel_window', targetId }
   * ═══════════════════════════════════════════════════════════════════════════ */
  const logMapsToElement = useCallback(
    (details = {}) => logEvent('MAPS_TO_ELEMENT', details),
    [logEvent],
  );

  /* ═══════════════════════════════════════════════════════════════════════════
   * [Proposed 지표 4 & 5] MEMO_DRAG_DROP — 드래그 지속 시간
   * startMemoDragDrop(memoId)
   * stopMemoDragDrop(memoId)
   * ═══════════════════════════════════════════════════════════════════════════ */
  const startMemoDragDrop = useCallback((memoId) => {
    dragDrop.current = { startTime: Date.now(), memoId };
  }, []);

  const stopMemoDragDrop = useCallback(
    (memoId) => {
      const dd = dragDrop.current;
      if (dd.startTime === null) return;
      const durationMs = Date.now() - dd.startTime;
      dragDrop.current = { startTime: null, memoId: null };
      logEvent('MEMO_DRAG_DROP', { memoId: memoId ?? dd.memoId, durationMs });
    },
    [logEvent],
  );

  /* ═══════════════════════════════════════════════════════════════════════════
   * [Proposed 지표 4] PARALLEL_WINDOW_CREATE — 병렬 창 최초 생성
   * details: { windowId: string, depth: number }
   *   windowId 규칙: 루트 → "1", 파생 → "부모레이블-n" (예: "1-1", "1-1-1")
   *   depth: 0-based depth (0=루트, 1=1단계 꼬리, 2=2단계 꼬리)
   * ═══════════════════════════════════════════════════════════════════════════ */
  const logParallelWindowCreate = useCallback(
    (details = {}) => logEvent('PARALLEL_WINDOW_CREATE', details),
    [logEvent],
  );

  /* ═══════════════════════════════════════════════════════════════════════════
   * [Proposed 지표 4] PARALLEL_WINDOW_REACTIVATE — 기존 창 재활성화(클릭/포커스)
   * details: { windowId: string }
   * ═══════════════════════════════════════════════════════════════════════════ */
  const logParallelWindowReactivate = useCallback(
    (details = {}) => logEvent('PARALLEL_WINDOW_REACTIVATE', details),
    [logEvent],
  );

  /* ═══════════════════════════════════════════════════════════════════════════
   * [Proposed 지표 4] PARALLEL_WINDOW_DELETE
   * details: { windowId: string }
   * ═══════════════════════════════════════════════════════════════════════════ */
  const logParallelWindowDelete = useCallback(
    (details = {}) => logEvent('PARALLEL_WINDOW_DELETE', details),
    [logEvent],
  );

  /* ═══════════════════════════════════════════════════════════════════════════
   * [공통] API_ERROR — API 호출 실패 시 오류 정보 수집
   * details: {
   *   location: 'main' | 'side' | 'note' | 'traditional',
   *   errorMessage: string,
   *   errorStatus:  number | null,
   *   retryable:    boolean,
   * }
   * ═══════════════════════════════════════════════════════════════════════════ */
  const logApiError = useCallback(
    (details = {}) => logEvent('API_ERROR', details),
    [logEvent],
  );

  /* ═══════════════════════════════════════════════════════════════════════════
   * [공통] API_TOKEN_USAGE — 성공한 API 호출의 토큰 사용량
   * details: {
   *   location: 'main' | 'side' | 'note' | 'traditional',
   *   promptTokens: number,
   *   outputTokens: number,
   *   totalTokens:  number,
   * }
   * ═══════════════════════════════════════════════════════════════════════════ */
  const logApiTokenUsage = useCallback(
    (details = {}) => logEvent('API_TOKEN_USAGE', details),
    [logEvent],
  );

  /* ═══════════════════════════════════════════════════════════════════════════
   * 유틸리티
   * ═══════════════════════════════════════════════════════════════════════════ */

  /** 실험 시작 후 현재까지 경과 시간(ms) */
  const getTotalExperimentMs = useCallback(() => {
    if (experimentStartTimeRef.current === null) return 0;
    return Date.now() - experimentStartTimeRef.current;
  }, []);

  /** 현재 블록 로그 초기화 (블록 종료 후 다음 블록 준비) */
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  /* ─── 컨텍스트 값 ─── */
  const value = {
    logs,
    logEvent,

    /* [공통] AI 대기 */
    startAIWait,
    stopAIWait,

    /* [Traditional 지표 4] */
    logPromptSubmitTraditional,

    /* [Proposed 지표 4] */
    logPromptSubmit,
    logMemoCreate,
    startMemoEdit,
    stopMemoEdit,
    logMemoDelete,
    logMapsToBody,
    logMapsToElement,
    startMemoDragDrop,
    stopMemoDragDrop,
    logParallelWindowCreate,
    logParallelWindowReactivate,
    logParallelWindowDelete,
    logApiError,
    logApiTokenUsage,

    /* 유틸리티 */
    getTotalExperimentMs,
    clearLogs,
  };

  return (
    <ExperimentLogContext.Provider value={value}>
      {children}
    </ExperimentLogContext.Provider>
  );
}

export function useExperimentLog() {
  const ctx = useContext(ExperimentLogContext);
  if (!ctx) {
    throw new Error('useExperimentLog must be used inside ExperimentLogProvider');
  }
  return ctx;
}
