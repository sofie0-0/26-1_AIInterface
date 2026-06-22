/**
 * StartButton.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * 실험 흐름 버튼 컴포넌트
 *
 * [idle]      노란색 "실험 시작" 버튼
 *   ↓ 클릭
 * [active]    빨간색 "탐색 종료" 버튼
 *   ↓ 클릭    → 탐색 로그 xlsx 즉시 다운로드
 *              → explorationDurationMs 저장
 *              → experimentPhase = 'writing' (결과 작성 오버레이 표시)
 * [writing]   버튼 없음 (ResultOverlay가 화면 제어)
 * [ready_next] 초록색 "다음 세션 시작" 버튼 → /experiment-select 이동
 *
 * 실험 종료 후 이 컴포넌트 호출부(한 줄)만 제거하면 완전히 삭제됩니다.
 * ExperimentProvider + ExperimentLogProvider 하위에서만 사용 가능합니다.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
function computeMetrics(logs, interfaceType) {
  const isProposed = interfaceType === 'proposed';

  let scrollDistPx = 0, scrollDurMs = 0;
  let mouseDistPx  = 0, mouseDurMs  = 0;
  let contextSwitches = 0;
  let m3Count = 0, m3DurMs = 0;
  let interactions = 0;
  let aiWaitMs = 0, typingDurMs = 0, dragDurMs = 0;

  let cntParallelWindowCreate     = 0;
  let cntMemoCreate               = 0;
  let cntMemoEdit                 = 0;
  let cntMemoDelete               = 0;
  let cntMapsToBody               = 0;
  let cntMemoDragDrop             = 0;
  let cntParallelWindowReactivate = 0;
  let totalPromptTokens = 0, totalOutputTokens = 0, totalTokens = 0;

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
        if (!isProposed) interactions += 1;
        break;
      case 'PROMPT_SUBMIT':
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
        if (isProposed) { interactions += 1; cntMapsToBody += 1; }
        break;
      case 'PARALLEL_WINDOW_CREATE':
        if (isProposed) { interactions += 1; cntParallelWindowCreate += 1; }
        break;
      case 'PARALLEL_WINDOW_DELETE':
        if (isProposed) interactions += 1;
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
    contextSwitches,
    m3Count, m3DurSec, m3Efficiency,
    interactions,
    idleSec: msToSec(idleMs),
    cntParallelWindowCreate,
    cntMemoCreate,
    cntMemoEdit,
    cntMemoDelete,
    cntMapsToBody,
    cntMemoDragDrop,
    cntParallelWindowReactivate,
    totalPromptTokens,
    totalOutputTokens,
    totalTokens,
  };
}

/* ═════════════════════════════════════════════════════════════════════════════
 * XLSX 빌더 — 인터페이스 타입별 단일 파일 (2개 시트)
 * ═════════════════════════════════════════════════════════════════════════════ */

const SUMMARY_HEADER = [
  'User ID', 'Interface',
  '지표1: 스크롤 거리(px)', '지표1: 스크롤 시간(초)',
  '지표1: 마우스 거리(px)', '지표1: 마우스 시간(초)',
  '지표2: 문맥 전환(회)',
  '지표3: 정보 접근(회)', '지표3: 탐색 시간(초)', '지표3: 재접근 효율성(횟수/시간)',
  '지표4: 상호작용(회)',
  'Proposed: 추가 질문 생성(회)',
  'Proposed: 메모 생성(회)',
  'Proposed: 메모 편집 세션(회)',
  'Proposed: 메모 삭제(회)',
  'Proposed: 본문으로 이동(회)',
  'Proposed: 메모 이동(회)',
  'Proposed: 병렬 창 재방문(회)',
  'Input 토큰(합계)',
  'Output 토큰(합계)',
  '총 토큰(합계)',
];

const RAW_HEADER = [
  'Timestamp', 'User ID', 'Interface Type',
  'Block Index', 'Event Type', 'Details',
];

function metricsToCells(userId, ifaceType, m) {
  const isProposed = ifaceType === 'proposed';
  return [
    userId, ifaceType,
    m.scrollDistPx, m.scrollDurSec,
    m.mouseDistPx,  m.mouseDurSec,
    m.contextSwitches,
    m.m3Count, m.m3DurSec, m.m3Efficiency,
    m.interactions,
    isProposed ? m.cntParallelWindowCreate     : '',
    isProposed ? m.cntMemoCreate               : '',
    isProposed ? m.cntMemoEdit                 : '',
    isProposed ? m.cntMemoDelete               : '',
    isProposed ? m.cntMapsToBody               : '',
    isProposed ? m.cntMemoDragDrop             : '',
    isProposed ? m.cntParallelWindowReactivate : '',
    m.totalPromptTokens,
    m.totalOutputTokens,
    m.totalTokens,
  ];
}

function logsToRows(logs) {
  return logs.map((e) => [
    e.timestamp,
    e.userId,
    e.interfaceType,
    e.blockIndex,
    e.eventType,
    JSON.stringify(e.details ?? {}),
  ]);
}

/** 열 너비 자동 설정 */
function setColWidths(ws, colCount) {
  ws['!cols'] = Array.from({ length: colCount }, () => ({ wch: 22 }));
}

/**
 * buildBlockWorkbook(XLSX, userId, interfaceType, logs)
 *
 * 시트 1: Summary              — 지표 요약 행 1줄
 * 시트 2: Raw log [타입]       — 원시 로그 전체
 */
function buildBlockWorkbook(XLSX, userId, interfaceType, logs) {
  const wb = XLSX.utils.book_new();
  const m  = computeMetrics(logs, interfaceType);

  /* 시트 1: Summary */
  const summaryWs = XLSX.utils.aoa_to_sheet([
    SUMMARY_HEADER,
    metricsToCells(userId, interfaceType, m),
  ]);
  setColWidths(summaryWs, SUMMARY_HEADER.length);
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

  /* 시트 2: Raw log [인터페이스 타입] */
  const rawSheetName = `Raw log ${interfaceType.charAt(0).toUpperCase() + interfaceType.slice(1)}`;
  const rawWs = XLSX.utils.aoa_to_sheet([
    RAW_HEADER,
    ...logsToRows(logs),
  ]);
  setColWidths(rawWs, RAW_HEADER.length);
  XLSX.utils.book_append_sheet(wb, rawWs, rawSheetName);

  return wb;
}

/** Workbook → .xlsx Blob 다운로드 */
function downloadWorkbook(XLSX, wb, fileName) {
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob  = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/* ═════════════════════════════════════════════════════════════════════════════
 * 컴포넌트
 * ═════════════════════════════════════════════════════════════════════════════ */
export default function StartButton({ onBeforeEndBlock }) {
  const navigate = useNavigate();
  const {
    isExperimentActive, setIsExperimentActive,
    userId, interfaceType,
    experimentPhase, setExperimentPhase,
    setExplorationDurationMs,
  } = useExperiment();
  const { logs, clearLogs, getTotalExperimentMs } = useExperimentLog();

  /* ── 탐색 종료 → ready_next 로 이동 (다운로드는 ready_next 화면에서) ── */
  const handleEndBlock = useCallback(async () => {
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
    const XLSX       = await import('xlsx');
    const exportType = interfaceType ?? 'unknown';
    const exportUser = userId || 'user';
    const wb         = buildBlockWorkbook(XLSX, exportUser, exportType, logs);
    const typeCode   = exportType === 'proposed' ? 'P' : exportType === 'traditional' ? 'T' : exportType;
    downloadWorkbook(XLSX, wb, `${formatLogDate()}_${exportUser}_${typeCode}.xlsx`);
    clearLogs();
  }, [logs, userId, interfaceType, clearLogs]);

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

  /* WRITING: 결과 작성 중 → 버튼 없음 (ResultOverlay가 화면 제어) */
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
