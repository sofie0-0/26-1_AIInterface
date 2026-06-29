/**
 * StartButton.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * 실험 흐름 버튼 컴포넌트
 *
 * [idle]      노란색 "실험 시작" 버튼
 *   ↓ 클릭
 * [active]    빨간색 "탐색 종료" 버튼
 *   ↓ 클릭    → explorationDurationMs 저장, experimentPhase = 'ready_next'
 * [ready_next] "다음 세션 시작" → /experiment-select 이동
 *              "다운로드" → zip(json + csv) 저장 후 clearLogs()
 *
 * 실험 종료 후 이 컴포넌트 호출부(한 줄)만 제거하면 완전히 삭제됩니다.
 * ExperimentProvider + ExperimentLogProvider 하위에서만 사용 가능합니다.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import { useExperiment } from './ExperimentContext';
import { useExperimentLog } from './ExperimentLogContext';

/* ═════════════════════════════════════════════════════════════════════════════
 * 유틸
 * ═════════════════════════════════════════════════════════════════════════════ */

/** ms → 소수점 2자리 초 */
function msToSec(ms) {
  return ms > 0 ? Math.round(ms / 10) / 100 : 0;
}

/** YYMMDD 형식 날짜 문자열 (예: 260611) */
function formatLogDate(date = new Date()) {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * computeMetrics(logs, interfaceType): 로그 배열 → 지표 1~5 요약 객체
 * ─────────────────────────────────────────────────────────────────────────────*/
export function computeMetrics(logs, interfaceType) {
  const isProposed = interfaceType === 'proposed';

  let scrollDistPx = 0, scrollDurMs = 0;
  let mouseDistPx  = 0, mouseDurMs  = 0;
  let backwardNavDistPx = 0;
  let backwardNavCount = 0;
  let backwardNavDurMs = 0;

  let contextSwitches = 0;
  let m3Count = 0, m3DurMs = 0;
  let interactions = 0;
  let aiWaitMs = 0, typingDurMs = 0, dragDurMs = 0;

  let cntParallelWindowCreate     = 0;
  let cntParallelWindowDelete     = 0;
  let cntMemoCreate               = 0;
  let cntMemoEdit                 = 0;
  let cntMemoDelete               = 0;
  let cntMemoMapsToBody           = 0;
  let cntBranchMapsToBody         = 0;
  let cntMemoDragDrop             = 0;
  let cntParallelWindowReactivate = 0;
  let totalPromptTokens = 0, totalOutputTokens = 0, totalTokens = 0;
  let cntUserPrompts = 0;

  const timestamps = logs
    .map((e) => new Date(e.timestamp).getTime())
    .filter((t) => !isNaN(t));
  const totalMs = timestamps.length >= 2
    ? Math.max(...timestamps) - Math.min(...timestamps)
    : 0;

  for (const entry of logs) {
    const d  = entry.details ?? {};
    const et = entry.eventType;
    switch (et) {
      case 'SCROLL':
        scrollDistPx += d.distancePx ?? 0;
        scrollDurMs  += d.durationMs ?? 0;

        backwardNavDistPx += d.backwardDistancePx ?? 0;
        backwardNavCount += d.backwardCount ?? 0;
        backwardNavDurMs += d.backwardDurationMs ?? 0;
        break;
      case 'MOUSE_MOVE':
        mouseDistPx += d.distancePx ?? 0;
        mouseDurMs  += d.durationMs ?? 0;
        break;
      case 'CONTEXT_SWITCH':
        if (d.action === 'leave') contextSwitches += 1;
        break;
      case 'SCROLL_PAUSE_UPWARD':
        if (!d.section?.startsWith('parallel_window')) {
          m3Count += 1;
          m3DurMs += d.scrollUpStartToEnd1sMs ?? 0;
        }
        break;
      case 'MAPS_TO_ELEMENT':
        if (isProposed) { interactions += 1; }
        break;
      case 'PARALLEL_WINDOW_REACTIVATE':
        if (isProposed) { m3Count += 1; interactions += 1; cntParallelWindowReactivate += 1; }
        break;
      case 'ELEMENT_INTERACTION':
        if (isProposed) {
          if (d.action === 'click') interactions += 1;
        }
        break;
      case 'AI_RESPONSE_WAIT':
        aiWaitMs += d.durationMs ?? 0;
        break;
      case 'KEYBOARD_TYPING':
        typingDurMs += d.durationMs ?? 0;
        break;
      case 'PROMPT_SUBMIT_TRADITIONAL':
        cntUserPrompts += 1;

        if (!isProposed) interactions += 1;
        break;
      case 'PROMPT_SUBMIT':
        cntUserPrompts += 1;

        if (isProposed) interactions += 1;
        break;
      case 'MEMO_CREATE':
        if (isProposed) { interactions += 1; cntMemoCreate += 1; }
        break;
      case 'MEMO_EDIT':
        if (isProposed) { interactions += 1; cntMemoEdit += 1; }
        break;
      case 'MEMO_DELETE':
        if (isProposed) { interactions += 1; cntMemoDelete += 1; }
        break;
        case 'MAPS_TO_BODY':
        if (isProposed) { interactions += 1;
          if (d?.sourceType === 'memo') { cntMemoMapsToBody += 1; }   
          if (d?.sourceType === 'parallel_window') { cntBranchMapsToBody += 1; } }
        break;
      case 'PARALLEL_WINDOW_CREATE':
        if (isProposed) { interactions += 1; cntParallelWindowCreate += 1; }
        break;
      case 'PARALLEL_WINDOW_DELETE':
        if (isProposed) { interactions += 1; cntParallelWindowDelete += 1; }
        break;
      case 'MEMO_DRAG_DROP':
        dragDurMs += d.durationMs ?? 0;
        if (isProposed) { interactions += 1; cntMemoDragDrop += 1; }
        break;
      case 'API_TOKEN_USAGE':
        totalPromptTokens += d.promptTokens ?? 0;
        totalOutputTokens += d.outputTokens ?? 0;
        totalTokens     += d.totalTokens ?? 0;
        break;
      default:
        break;
    }
  }

  const m3DurSec     = msToSec(m3DurMs);
  const m3Efficiency = m3DurSec > 0
    ? Math.round((m3Count / m3DurSec) * 100) / 100
    : 0;

  const activeDurMs = aiWaitMs + mouseDurMs + scrollDurMs + typingDurMs + dragDurMs;
  const idleMs      = Math.max(0, totalMs - activeDurMs);

  return {
    scrollDistPx, scrollDurSec: msToSec(scrollDurMs),
    mouseDistPx,  mouseDurSec:  msToSec(mouseDurMs),
    backwardNavDistPx,
    backwardNavCount,
    backwardNavDurSec: msToSec(backwardNavDurMs),
    contextSwitches,
    m3Count, m3DurSec, m3Efficiency,
    interactions,
    idleSec: msToSec(idleMs),
    cntParallelWindowCreate,
    cntParallelWindowDelete,
    cntMemoCreate,
    cntMemoEdit,
    cntMemoDelete,
    cntMemoMapsToBody,
    cntBranchMapsToBody,
    cntMemoDragDrop,
    cntUserPrompts,
    cntParallelWindowReactivate,
    totalPromptTokens,
    totalOutputTokens,
    totalTokens,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * groupLogsByBlockIndex(logs): 로그 배열 → 세션(blockIndex)별 그룹
 *   반환: [{ blockIndex, interfaceType, logs }, ...]  (blockIndex 오름차순)
 * ───────────────────────────────────────────────────────────────────────────── */
function groupLogsByBlockIndex(logs) {
  const map = new Map();
  for (const entry of logs) {
    const key = entry.blockIndex ?? 0;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(entry);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([blockIndex, sessionLogs]) => ({
      blockIndex,
      interfaceType: sessionLogs[0]?.interfaceType ?? 'unknown',
      logs: sessionLogs,
    }));
}

/* ─────────────────────────────────────────────────────────────────────────────
 * buildRawJsonPayload(userId, sessions): raw 로그만 담은 JSON 객체
 * ───────────────────────────────────────────────────────────────────────────── */
function buildRawJsonPayload(userId, sessions) {
  return {
    userId,
    exportedAt: new Date().toISOString(),
    sessions: sessions.map((s) => ({
      blockIndex:    s.blockIndex,
      interfaceType: s.interfaceType,
      logs:          s.logs,
    })),
  };
}

/** Blob → 파일 다운로드 (JSON·CSV 공통) */
function downloadBlobFile(fileName, blob) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/* ═════════════════════════════════════════════════════════════════════════════
 * CSV structured log — 세션별 지표 요약 (SUMMARY_HEADER 재사용)
 *   CSV만 EXPERIMENT_START 기준 10분 창 로그로 computeMetrics (JSON은 전체 유지)
 * ═════════════════════════════════════════════════════════════════════════════ */

/** CSV 지표 산출 시간 창 — [실험 시작] 클릭 후 10분 */
const METRICS_WINDOW_MS = 10 * 60 * 1000;

function parseLogTime(entry) {
  const t = new Date(entry.timestamp).getTime();
  return Number.isNaN(t) ? null : t;
}

/** 세션 시작 시각: EXPERIMENT_START 우선, 없으면 첫 로그(구버전 호환) */
function getSessionStartMs(logs) {
  const startEntry = logs.find((e) => e.eventType === 'EXPERIMENT_START');
  if (startEntry) {
    const t = parseLogTime(startEntry);
    if (t !== null) return t;
  }
  const times = logs.map(parseLogTime).filter((t) => t !== null);
  return times.length ? Math.min(...times) : null;
}

/** CSV용: EXPERIMENT_START + 10분 이내 로그만 반환 */
function filterLogsForMetricsWindow(logs, windowMs = METRICS_WINDOW_MS) {
  const sessionStart = getSessionStartMs(logs);
  if (sessionStart === null) return [];
  const cutoff = sessionStart + windowMs;
  return logs.filter((e) => {
    const t = parseLogTime(e);
    return t !== null && t <= cutoff;
  });
}

const SUMMARY_HEADER = [
  'User ID',
  'Interface',
  'Backward Navigation Distance',
  'Backward Navigation Count',
  'Backward Navigation Duration',
  'Branch Revisit Count',
  'Total scroll distance',
  'Total scroll duraition',
  'Total mouse move distance',
  'Total mouse move duration',
  'Total user prompts',
  'Branch Create Count',
  'Branch Delete Count',
  'Memo Create Count',
  'Memo Edit Count',
  'Memo Delete Count',
  'Memo DragDrop Count',
  'Memo Maps To Body Count',
  'Branch Maps To Body Count',
];

function metricsToCells(userId, ifaceType, m) {
  const isProposed = ifaceType === 'proposed';
  return [
    userId,
    ifaceType,
    m.backwardNavDistPx,   // TODO computeMetrics에 없음
    m.backwardNavCount,     // TODO computeMetrics에 없음
    m.backwardNavDurSec,    // TODO computeMetrics에 없음
    isProposed ? m.cntParallelWindowReactivate : '',
    m.scrollDistPx,
    m.scrollDurSec,
    m.mouseDistPx,
    m.mouseDurSec,
    m.cntUserPrompts,       // TODO computeMetrics에 없음
    isProposed ? m.cntParallelWindowCreate : '',
    m.cntParallelWindowDelete, // TODO computeMetrics에 없음
    isProposed ? m.cntMemoCreate : '',
    isProposed ? m.cntMemoEdit : '',
    isProposed ? m.cntMemoDelete : '',
    isProposed ? m.cntMemoDragDrop : '',
    m.cntMemoMapsToBody,    // TODO computeMetrics에 없음
    m.cntBranchMapsToBody,  // TODO computeMetrics에 없음
  ];
}

/** CSV 셀 이스케이프 */
function csvCell(value) {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const STRUCTURED_CSV_HEADER = ['Block Index', ...SUMMARY_HEADER];

/**
 * buildStructuredCsv(userId, sessions): 세션별 structured log → CSV 문자열
 *   세션 1개 = 행 1개, computeMetrics는 세션 interfaceType 기준
 */
function buildStructuredCsv(userId, sessions) {
  const rows = sessions.map((s) => {
    const windowedLogs = filterLogsForMetricsWindow(s.logs);
    const m = computeMetrics(windowedLogs, s.interfaceType);
    return [s.blockIndex, ...metricsToCells(userId, s.interfaceType, m)];
  });
  return [STRUCTURED_CSV_HEADER, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\n');
}

/**
 * exportExperimentLogs(userId, logs)
 *   세션별 분리 → zip(raw json + structured csv) 1개 저장
 *   파일명: YYMMDD_userId.zip
 */
async function exportExperimentLogs(userId, logs) {
  const sessions   = groupLogsByBlockIndex(logs);
  const exportUser = userId || 'user';
  const baseName   = `${formatLogDate()}_${exportUser}`;

  const jsonText = JSON.stringify(buildRawJsonPayload(exportUser, sessions), null, 2);
  const csvText  = '\uFEFF' + buildStructuredCsv(exportUser, sessions);

  const zip = new JSZip();
  zip.file(`${baseName}.json`, jsonText);
  zip.file(`${baseName}.csv`, csvText);

  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlobFile(`${baseName}.zip`, blob);
}

/* ═════════════════════════════════════════════════════════════════════════════
 * 컴포넌트
 * ═════════════════════════════════════════════════════════════════════════════ */
export default function StartButton({ onBeforeEndBlock }) {
  const navigate = useNavigate();
  const {
    isExperimentActive, setIsExperimentActive,
    userId,
    experimentPhase, setExperimentPhase,
    setExplorationDurationMs,
  } = useExperiment();
  const { logs, clearLogs, getTotalExperimentMs } = useExperimentLog();

  /* ── 탐색 종료 → ready_next 로 이동 (다운로드는 ready_next 화면에서) ── */
  const handleEndBlock = useCallback(() => {
    onBeforeEndBlock?.();

    const durationMs = getTotalExperimentMs();
    setExplorationDurationMs(durationMs);

    setIsExperimentActive(false);
    setExperimentPhase('ready_next');
  }, [
    onBeforeEndBlock,
    getTotalExperimentMs, setExplorationDurationMs,
    setIsExperimentActive, setExperimentPhase,
  ]);

  const handleFinishExperiment = useCallback(async () => {
    await exportExperimentLogs(userId, logs);
    clearLogs();
  }, [logs, userId, clearLogs]);

  /* ── 다음 세션 시작 → SelectionPage로 이동 ── */
  const handleStartNext = useCallback(() => {
    setExperimentPhase('idle');
    navigate('/experiment-select');
  }, [setExperimentPhase, navigate]);

  /* ─────────────────────────────────────────────────────────────────────────
   * 렌더
   * ───────────────────────────────────────────────────────────────────────── */

  /* ACTIVE: 탐색 진행 중 → "탐색 종료" */
  if (isExperimentActive) {
    return (
      <button
        onClick={handleEndBlock}
        style={btnStyle('#fee2e2', '#b91c1c')}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#fecaca'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '#fee2e2'; }}
      >
        탐색 종료
      </button>
    );
  }

  if (experimentPhase === 'writing') return null;

  /* READY_NEXT: 다음 세션 시작 + 다운로드 */
  if (experimentPhase === 'ready_next') {
    return (
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleStartNext}
          style={btnStyle('#dcfce7', '#15803d')}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#bbf7d0'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#dcfce7'; }}
        >
          다음 세션 시작
        </button>
        <button
          onClick={handleFinishExperiment}
          style={btnStyle('#fee2e2', '#b91c1c')}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#fecaca'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#fee2e2'; }}
        >
          다운로드
        </button>
      </div>
    );
  }

  /* IDLE: 실험 시작 전 */
  return (
    <button
      onClick={() => { setIsExperimentActive(true); setExperimentPhase('idle'); }}
      style={btnStyle('#facc15', '#1e293b')}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#fbbf24'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = '#facc15'; }}
    >
      실험 시작
    </button>
  );
}

/* 공통 버튼 스타일 헬퍼 */
function btnStyle(bg, color) {
  return {
    padding: '5px 14px',
    borderRadius: 8,
    border: 'none',
    background: bg,
    color,
    fontSize: 12.5,
    fontWeight: 700,
    letterSpacing: '-0.01em',
    cursor: 'pointer',
    transition: 'background 0.15s',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  };
}
