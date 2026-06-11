/**
 * TaskPanel.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * 헤더 우측에 삽입되는 접기/펼치기 가능한 과제 확인 패널.
 *
 * · 탐색 시작 전(isExperimentActive=false): 기본 열림 상태
 * · 탐색 중(isExperimentActive=true): 기본 닫힘 상태, 필요 시 열 수 있음
 * · 드롭다운은 position:fixed 이므로 LAYOUT 상수와 flex 레이아웃에 영향 없음
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React, { useEffect, useRef, useState } from 'react';
import { useExperiment } from './ExperimentContext.jsx';

const FONT_STACK_KO = '"Pretendard","Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans KR",sans-serif';

const QUESTIONS = [
  '탐색 과정에서 중요하다고 생각한 내용 3가지를 적으시오.',
  '세 내용이 서로 어떻게 연결되는지 설명하시오.',
  '해당 분야가 실제 문제 해결에 어떻게 활용될 수 있는지 설명하시오.',
];

export default function TaskPanel() {
  const { isExperimentActive, selectedTopic } = useExperiment();

  const [open, setOpen]     = useState(!isExperimentActive);
  const [pos, setPos]       = useState({ top: 0, left: 0 });
  const btnRef              = useRef(null);
  const panelRef            = useRef(null);

  /* isExperimentActive 변경 시 패널 상태 자동 전환 */
  useEffect(() => {
    setOpen(!isExperimentActive);
  }, [isExperimentActive]);

  /* 버튼 바로 아래, 버튼 왼쪽 끝 기준 정렬 */
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({
      top:  rect.bottom + 4,
      left: rect.left,
    });
  }, [open]);

  /* 외부 클릭 시 닫기 */
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        btnRef.current   && !btnRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  if (!selectedTopic) return null;

  return (
    <>
      {/* 헤더 내 토글 버튼 */}
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: '5px 12px',
          borderRadius: 8,
          border: `1px solid ${open ? '#facc15' : '#e2e8f0'}`,
          background: open ? '#fefce8' : '#f8fafc',
          color: open ? '#92400e' : '#64748b',
          fontSize: 12.5, fontWeight: 600,
          fontFamily: FONT_STACK_KO,
          letterSpacing: '-0.01em',
          cursor: 'pointer',
          transition: 'all 0.15s',
          whiteSpace: 'nowrap', flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 5,
        }}
        onMouseEnter={(e) => { if (!open) e.currentTarget.style.background = '#f1f5f9'; }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.background = '#f8fafc'; }}
      >
        <span style={{ fontSize: 13 }}>📋</span>
        과제 보기
        <span style={{
          fontSize: 10, marginLeft: 2,
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.15s', display: 'inline-block',
        }}>▾</span>
      </button>

      {/* 드롭다운 — 버튼 바로 아래, 3문항만 컴팩트하게 */}
      {open && (
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            top: pos.top, left: pos.left,
            width: 248,
            background: '#ffffff',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
            zIndex: 9000,
            fontFamily: FONT_STACK_KO,
            padding: '10px 12px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {QUESTIONS.map((q, i) => (
              <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, color: '#ffffff',
                  background: '#64748b', borderRadius: '50%',
                  width: 15, height: 15, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginTop: 2,
                }}>
                  {i + 1}
                </span>
                <span style={{
                  fontSize: 11.5, color: '#475569',
                  lineHeight: 1.55, letterSpacing: '-0.01em',
                }}>
                  {q}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
