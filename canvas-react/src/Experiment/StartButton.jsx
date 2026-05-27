/**
 * StartButton.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * 실험 흐름 버튼 컴포넌트 (3단계 상태 머신)
 *
 * [idle]         노란색 "실험 시작" 버튼
 *   ↓ 클릭
 * [active]       빨간색 "이 블록 종료" 버튼
 *   ↓ 클릭       → archiveLogs() (현재 로그 보존, 활성 배열 초기화)
 *                → isExperimentActive = false
 * [ended]        두 가지 버튼 동시 표시
 *   ├ 초록색 "다음 블록 시작"  → isExperimentActive = true
 *   └ 파란색 "전체 종료 및 엑셀 다운로드" → XLSX 생성 후 모든 로그 초기화
 *
 * 실험 종료 후 이 컴포넌트 호출부(한 줄)만 제거하면 완전히 삭제됩니다.
 * ExperimentProvider + ExperimentLogProvider 하위에서만 사용 가능합니다.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React, { useCallback } from 'react';
import * as XLSX from 'xlsx';
import { useExperiment } from './ExperimentContext';
import { useExperimentLog } from './ExperimentLogContext';

/* ═════════════════════════════════════════════════════════════════════════════
 * 유틸
 * ═════════════════════════════════════════════════════════════════════════════ */

/** ms → 소수점 2자리 초 */
function msToSec(ms) {
  return ms > 0 ? Math.round(ms / 10) / 100 : 0;
}

/** YYMMDD 형식 날짜 문자열 (예: 260523) */
function formatLogDate(date = new Date()) {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * computeMetrics(logs, interfaceType): 로그 배열 → 지표 1~5 요약 객체
 *
 * M1  스크롤·마우스 이동 거리/시간
 * M2  문맥 전환 횟수
 * M3  정보 재접근 효율성 (인터페이스별 분기)
 *   Traditional: 분자=SCROLL_PAUSE_UPWARD 횟수  /  분모=scrollUpStartToEnd1sMs 합산
 *   Proposed:    분자=위+MAPS_TO_ELEMENT+ELEMENT_INTERACTION+PARALLEL_WINDOW_REACTIVATE
 *                분모=위+ELEMENT_INTERACTION.durationMs 합산
 * M4  상호작용 횟수 (인터페이스별 집계 항목 다름)
 * M5  유휴 시간(s) = 전체시간 − (AI대기+마우스+스크롤+타자+드래그)
 * ─────────────────────────────────────────────────────────────────────────────*/
function computeMetrics(logs, interfaceType) {
  const isProposed = interfaceType === 'proposed';

  let scrollDistPx = 0, scrollDurMs = 0;
  let mouseDistPx  = 0, mouseDurMs  = 0;
  let contextSwitches = 0;
  let m3Count = 0, m3DurMs = 0;
  let interactions = 0;
  let aiWaitMs = 0, typingDurMs = 0, dragDurMs = 0;

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
        m3Count += 1;
        m3DurMs += d.scrollUpStartToEnd1sMs ?? 0;
        break;
      case 'MAPS_TO_ELEMENT':
        if (isProposed) { m3Count += 1; interactions += 1; }
        break;
      case 'PARALLEL_WINDOW_REACTIVATE':
        if (isProposed) { m3Count += 1; interactions += 1; }
        break;
      case 'ELEMENT_INTERACTION':
        if (isProposed) {
          m3Count += 1;
          m3DurMs += d.durationMs ?? 0;
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
      case 'MEMO_EDIT':
      case 'MEMO_DELETE':
      case 'MAPS_TO_BODY':
      case 'PARALLEL_WINDOW_CREATE':
      case 'PARALLEL_WINDOW_DELETE':
        if (isProposed) interactions += 1;
        break;
      case 'MEMO_DRAG_DROP':
        dragDurMs += d.durationMs ?? 0;
        if (isProposed) interactions += 1;
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

  /* ── AI 답변 총 높이 집계 ── */
  const sectionHeightMap = {};
  for (const entry of logs) {
    if (entry.eventType === 'AI_ANSWER_HEIGHT_SNAPSHOT') {
      const { section, answerHeightPx } = entry.details ?? {};
      if (section != null && answerHeightPx != null) {
        sectionHeightMap[section] = answerHeightPx; // 마지막 값으로 덮어쓰기
      }
    }
  }
  const aiAnswerTotalHeightPx = Object.values(sectionHeightMap).reduce((s, v) => s + v, 0);

  return {
    scrollDistPx, scrollDurSec: msToSec(scrollDurMs),
    mouseDistPx,  mouseDurSec:  msToSec(mouseDurMs),
    contextSwitches,
    m3Count, m3DurSec, m3Efficiency,
    interactions,
    idleSec: msToSec(idleMs),
    aiAnswerTotalHeightPx,
  };
}

/* ═════════════════════════════════════════════════════════════════════════════
 * XLSX 빌더
 * ═════════════════════════════════════════════════════════════════════════════ */

/** 공통 지표 요약 헤더 (논문 가독성 기준) */
const SUMMARY_HEADER = [
  'User ID', 'Interface',
  '지표1: 스크롤 거리(px)', '지표1: 스크롤 시간(초)',
  '지표1: 마우스 거리(px)', '지표1: 마우스 시간(초)',
  '지표1: AI 답변 총 높이(px)',
  '지표2: 문맥 전환(회)',
  '지표3: 정보 접근(회)', '지표3: 탐색 시간(초)', '지표3: 재접근 효율성(횟수/시간)',
  '지표4: 상호작용(회)',
];

const RAW_HEADER = [
  'Timestamp', 'User ID', 'Interface Type',
  'Block Index', 'Event Type', 'Details',
];

/** metrics 객체 → 요약 행 배열 */
function metricsToCells(userId, ifaceType, m) {
  return [
    userId, ifaceType,
    m.scrollDistPx, m.scrollDurSec,
    m.mouseDistPx,  m.mouseDurSec,
    m.aiAnswerTotalHeightPx,
    m.contextSwitches,
    m.m3Count, m.m3DurSec, m.m3Efficiency,
    m.interactions,
  ];
}

/** 원시 로그 배열 → 2D 배열 */
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

/**
 * buildWorkbook(userId, traditionalLogs, proposedLogs)
 *
 * 시트 1: Summary Dashboard  — Traditional / Proposed 지표를 나란히 비교
 * 시트 2: Traditional_Raw_Logs — 상단 요약 + 원시 로그
 * 시트 3: Proposed_Raw_Logs    — 상단 요약 + 원시 로그
 * (로그가 없는 시트도 빈 상태로 생성하여 구조 일관성 유지)
 */
function buildWorkbook(userId, traditionalLogs, proposedLogs) {
  const wb = XLSX.utils.book_new();

  const tradM = computeMetrics(traditionalLogs, 'traditional');
  const propM = computeMetrics(proposedLogs, 'proposed');

  /* ── 시트 1: Summary Dashboard ── */
  const dashData = [
    SUMMARY_HEADER,
    metricsToCells(userId, 'traditional', tradM),
    metricsToCells(userId, 'proposed',    propM),
  ];
  const dashWs = XLSX.utils.aoa_to_sheet(dashData);
  setColWidths(dashWs, SUMMARY_HEADER.length);
  XLSX.utils.book_append_sheet(wb, dashWs, 'Summary Dashboard');

  /* ── 시트 2: Traditional_Raw_Logs ── */
  const tradData = [
    SUMMARY_HEADER,
    metricsToCells(userId, 'traditional', tradM),
    [],                  /* 공백 행 */
    RAW_HEADER,
    ...logsToRows(traditionalLogs),
  ];
  const tradWs = XLSX.utils.aoa_to_sheet(tradData);
  setColWidths(tradWs, Math.max(SUMMARY_HEADER.length, RAW_HEADER.length));
  XLSX.utils.book_append_sheet(wb, tradWs, 'Traditional_Raw_Logs');

  /* ── 시트 3: Proposed_Raw_Logs ── */
  const propData = [
    SUMMARY_HEADER,
    metricsToCells(userId, 'proposed', propM),
    [],
    RAW_HEADER,
    ...logsToRows(proposedLogs),
  ];
  const propWs = XLSX.utils.aoa_to_sheet(propData);
  setColWidths(propWs, Math.max(SUMMARY_HEADER.length, RAW_HEADER.length));
  XLSX.utils.book_append_sheet(wb, propWs, 'Proposed_Raw_Logs');

  return wb;
}

/** 열 너비 자동 설정 (헤더 글자 수 기준) */
function setColWidths(ws, colCount) {
  ws['!cols'] = Array.from({ length: colCount }, (_, i) => ({ wch: 22 + i * 0 }));
}

/** Workbook → .xlsx Blob 다운로드 */
function downloadWorkbook(wb, fileName) {
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
  const {
    isExperimentActive, setIsExperimentActive,
    userId,
    experimentPhase, setExperimentPhase,
  } = useExperiment();
  const { logs, archivedLogs, archiveLogs, clearLogs } = useExperimentLog();

  /* 총 누적 로그 건수 (아카이브 + 현재) */
  const totalLogCount = archivedLogs.reduce((s, a) => s + a.logs.length, 0) + logs.length;

  /* ── 첫 번째(또는 중간) 블록 종료 → 로그 보존 후 대기 ── */
  const handleEndBlock = useCallback(() => {
    onBeforeEndBlock?.();       /* AI 답변 높이 스냅샷 등 블록 종료 전 처리 */
    archiveLogs();              /* logs → archivedLogs 스냅샷, logs 초기화 */
    setIsExperimentActive(false);
    setExperimentPhase('ended');
  }, [onBeforeEndBlock, archiveLogs, setIsExperimentActive, setExperimentPhase]);

  /* ── 다음 블록 시작 ── */
  const handleStartNext = useCallback(() => {
    setIsExperimentActive(true);
    setExperimentPhase('idle');
  }, [setIsExperimentActive, setExperimentPhase]);

  /* ── 전체 종료 및 엑셀 다운로드 ── */
  const handleFinalExport = useCallback(() => {
    /* archivedLogs + 현재 미아카이브 로그를 모두 합산 */
    const allArchived = logs.length > 0
      ? [...archivedLogs, { interfaceType: logs[0]?.interfaceType ?? 'unknown', logs }]
      : archivedLogs;

    const traditionalLogs = allArchived
      .filter((a) => a.interfaceType === 'traditional')
      .flatMap((a) => a.logs);

    const proposedLogs = allArchived
      .filter((a) => a.interfaceType === 'proposed')
      .flatMap((a) => a.logs);

    const exportUserId = userId || 'user';
    const wb = buildWorkbook(exportUserId, traditionalLogs, proposedLogs);
    downloadWorkbook(wb, `${formatLogDate()}_${exportUserId}_log.xlsx`);

    clearLogs();
    setIsExperimentActive(false);
    setExperimentPhase('idle');
  }, [archivedLogs, logs, userId, clearLogs, setIsExperimentActive, setExperimentPhase]);

  /* ─────────────────────────────────────────────────────────────────────────
   * 렌더
   * ───────────────────────────────────────────────────────────────────────── */

  /* ── ACTIVE: 실험 진행 중 → "이 블록 종료" ── */
  if (isExperimentActive) {
    return (
      <button
        onClick={handleEndBlock}
        style={btnStyle('#fee2e2', '#b91c1c')}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#fecaca'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '#fee2e2'; }}
      >
        이 블록 종료
      </button>
    );
  }

  /* ── ENDED: 1블록 완료, 다음 블록 대기 ── */
  if (experimentPhase === 'ended') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {/* 다음 블록 시작 */}
        <button
          onClick={handleStartNext}
          style={btnStyle('#dcfce7', '#15803d')}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#bbf7d0'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#dcfce7'; }}
        >
          다음 블록 시작
        </button>
        {/* 전체 종료 + 엑셀 다운로드 */}
        <button
          onClick={handleFinalExport}
          title={`누적 로그 ${totalLogCount}건 → xlsx`}
          style={btnStyle('#dbeafe', '#1d4ed8')}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#bfdbfe'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#dbeafe'; }}
        >
          전체 종료 및 엑셀 다운로드 ({totalLogCount})
        </button>
      </div>
    );
  }

  /* ── IDLE: 실험 시작 전 ── */
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
