/**
 * ResultOverlay.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * 탐색 종료 후 표시되는 전체화면 결과 작성 오버레이.
 *
 * · experimentPhase === 'writing' 일 때 ExperimentOverlayManager가 렌더링.
 * · 이 화면 진입 후 모든 로그 수집은 이미 중단된 상태(isExperimentActive=false).
 *
 * ■ 두 세션 합산 저장 로직
 *   Session 1 (blockIndex=1): 답변을 pendingResult에 저장 → 파일 없음
 *   Session 2 (blockIndex=2): pendingResult + 현재 답변 합쳐 xlsx 1개 다운로드
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React, { useState } from 'react';
import { useExperiment } from './ExperimentContext.jsx';

const FONT_STACK_KO = '"Pretendard","Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans KR",sans-serif';

/* ── 날짜 포맷 ── */
function formatDate(date = new Date()) {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

const RESULT_HEADER = [
  'participant_id', 'session', 'interface_type', 'topic',
  'exploration_duration_sec',
  'q1_1', 'q1_2', 'q1_3',
  'q2', 'q3',
  'submitted_at',
];

function buildRow({ userId, blockIndex, interfaceType, selectedTopic, explorationDurationMs, q1, q2, q3 }) {
  return [
    userId,
    blockIndex,
    interfaceType ?? '',
    selectedTopic ?? '',
    explorationDurationMs > 0 ? Math.round(explorationDurationMs / 1000) : 0,
    q1[0], q1[1], q1[2],
    q2, q3,
    new Date().toISOString(),
  ];
}

async function downloadResultXlsx(userId, rows) {
  const XLSX = await import('xlsx');
  const ws   = XLSX.utils.aoa_to_sheet([RESULT_HEADER, ...rows]);
  ws['!cols'] = RESULT_HEADER.map(() => ({ wch: 24 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Result');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob  = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = `${formatDate()}_${userId || 'user'}_result.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ═════════════════════════════════════════════════════════════════════════════
 * 컴포넌트
 * ═════════════════════════════════════════════════════════════════════════════ */
export default function ResultOverlay() {
  const {
    userId, blockIndex, interfaceType,
    selectedTopic, explorationDurationMs,
    pendingResult, setPendingResult,
    setExperimentPhase,
  } = useExperiment();

  const [q1, setQ1]               = useState(['', '', '']);
  const [q2, setQ2]               = useState('');
  const [q3, setQ3]               = useState('');
  const [submitting, setSubmitting] = useState(false);

  /* blockIndex=1: 첫 번째 세션 / blockIndex=2: 두 번째(마지막) 세션 */
  const isLastSession = blockIndex >= 2;

  const durationSec = explorationDurationMs > 0
    ? Math.round(explorationDurationMs / 1000)
    : null;

  const isValid = q1.every((v) => v.trim() !== '') && q2.trim() !== '' && q3.trim() !== '';

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);

    const currentRow = buildRow({
      userId, blockIndex, interfaceType, selectedTopic,
      explorationDurationMs, q1, q2, q3,
    });

    if (isLastSession) {
      /* 두 번째 세션: pendingResult(Session 1) + 현재 → 파일 1개 */
      const rows = pendingResult ? [pendingResult, currentRow] : [currentRow];
      await downloadResultXlsx(userId, rows);
      setPendingResult(null);
    } else {
      /* 첫 번째 세션: 결과를 임시 보관만 (파일 없음) */
      setPendingResult(currentRow);
    }

    setExperimentPhase('ready_next');
  };

  const updateQ1 = (idx, val) =>
    setQ1((prev) => prev.map((v, i) => (i === idx ? val : v)));

  const btnLabel = submitting
    ? '저장 중...'
    : isLastSession
      ? '제출하기 (결과 파일 저장)'
      : '저장하고 다음 세션으로';

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(15, 23, 42, 0.55)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
      fontFamily: FONT_STACK_KO,
      padding: '24px',
      boxSizing: 'border-box',
      overflowY: 'auto',
    }}>
      <div style={{
        background: '#ffffff', borderRadius: 20,
        border: '1px solid #e2e8f0',
        boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
        width: '100%', maxWidth: 580,
        padding: '44px 48px',
        display: 'flex', flexDirection: 'column', gap: 0,
      }}>
        {/* 헤더 */}
        <p style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
          color: '#94a3b8', textTransform: 'uppercase', margin: '0 0 10px',
        }}>
          탐색 완료 — 결과 작성 ({blockIndex}차 세션)
        </p>
        <h2 style={{
          fontSize: 22, fontWeight: 700, color: '#1e293b',
          letterSpacing: '-0.03em', margin: '0 0 6px',
        }}>
          탐색 결과를 작성해 주세요
        </h2>

        {/* 세션 정보 배지 */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {selectedTopic && (
            <span style={badgeStyle('#fef9c3', '#92400e')}>
              주제: <strong style={{ color: '#78350f' }}>{selectedTopic}</strong>
            </span>
          )}
          {durationSec !== null && (
            <span style={badgeStyle('#f0fdf4', '#166534')}>
              탐색 시간: <strong style={{ color: '#14532d' }}>{formatDuration(durationSec)}</strong>
            </span>
          )}
        </div>

        {/* 첫 번째 세션 안내 문구 */}
        {!isLastSession && (
          <p style={{
            fontSize: 12.5, color: '#64748b', lineHeight: 1.6,
            background: '#f8fafc', borderRadius: 8, padding: '10px 14px',
            margin: '0 0 16px', border: '1px solid #e2e8f0',
          }}>
            이 세션의 결과는 임시 저장됩니다. 두 번째 세션 종료 후 두 세션의 결과가 하나의 파일로 저장됩니다.
          </p>
        )}

        <div style={{ height: 1, background: '#f1f5f9', marginBottom: 28 }} />

        {/* 문항 1 */}
        <section style={{ marginBottom: 24 }}>
          <QuestionLabel num={1}>
            탐색 과정에서 중요하다고 생각한 내용 3가지를 적으시오.
          </QuestionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {q1.map((val, idx) => (
              <input
                key={idx}
                type="text"
                value={val}
                onChange={(e) => updateQ1(idx, e.target.value)}
                placeholder={`내용 ${idx + 1}`}
                style={inputStyle}
                onFocus={(e) => applyFocus(e)}
                onBlur={(e) => removeFocus(e)}
              />
            ))}
          </div>
        </section>

        {/* 문항 2 */}
        <section style={{ marginBottom: 24 }}>
          <QuestionLabel num={2}>
            세 내용이 서로 어떻게 연결되는지 설명하시오.
          </QuestionLabel>
          <textarea
            value={q2}
            onChange={(e) => setQ2(e.target.value)}
            placeholder="자유롭게 서술하세요"
            rows={4}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.7 }}
            onFocus={(e) => applyFocus(e)}
            onBlur={(e) => removeFocus(e)}
          />
        </section>

        {/* 문항 3 */}
        <section style={{ marginBottom: 32 }}>
          <QuestionLabel num={3}>
            해당 분야가 실제 문제 해결에 어떻게 활용될 수 있는지 설명하시오.
          </QuestionLabel>
          <textarea
            value={q3}
            onChange={(e) => setQ3(e.target.value)}
            placeholder="자유롭게 서술하세요"
            rows={4}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.7 }}
            onFocus={(e) => applyFocus(e)}
            onBlur={(e) => removeFocus(e)}
          />
        </section>

        <button
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          style={{
            width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
            background: isValid && !submitting ? '#facc15' : '#f1f5f9',
            color: isValid && !submitting ? '#1e293b' : '#94a3b8',
            fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
            letterSpacing: '-0.01em',
            cursor: isValid && !submitting ? 'pointer' : 'not-allowed',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { if (isValid && !submitting) e.currentTarget.style.background = '#fbbf24'; }}
          onMouseLeave={(e) => { if (isValid && !submitting) e.currentTarget.style.background = '#facc15'; }}
        >
          {btnLabel}
        </button>
      </div>
    </div>
  );
}

/* ── 헬퍼 컴포넌트/함수 ── */

function QuestionLabel({ num, children }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <span style={{
        fontSize: 11, fontWeight: 700, color: '#ffffff',
        background: '#334155', borderRadius: '50%',
        width: 20, height: 20, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginTop: 1,
      }}>
        {num}
      </span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: '#1e293b', lineHeight: 1.6 }}>
        {children}
      </span>
    </label>
  );
}

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: 10,
  border: '1px solid #e2e8f0', background: '#f8fafc',
  color: '#1e293b', fontSize: 13.5,
  fontFamily: '"Pretendard","Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans KR",sans-serif',
  outline: 'none', boxSizing: 'border-box',
  transition: 'box-shadow 0.15s',
};

function applyFocus(e) {
  e.target.style.boxShadow  = '0 0 0 3px rgba(250,204,21,0.35)';
  e.target.style.borderColor = 'transparent';
}
function removeFocus(e) {
  e.target.style.boxShadow  = 'none';
  e.target.style.borderColor = '#e2e8f0';
}

function badgeStyle(bg, color) {
  return {
    fontSize: 12, fontWeight: 600, color,
    background: bg, borderRadius: 20, padding: '4px 12px',
    letterSpacing: '-0.01em', display: 'inline-block',
  };
}

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}초`;
  return `${m}분 ${s}초`;
}
