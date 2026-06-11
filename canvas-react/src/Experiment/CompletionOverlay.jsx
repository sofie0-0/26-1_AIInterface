/**
 * CompletionOverlay.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * 두 세션 모두 완료 후 표시되는 전체화면 실험 완료 안내.
 * experimentPhase === 'completed' 일 때 ExperimentOverlayManager가 렌더링.
 * 우측 상단 X 버튼으로 닫을 수 있음 (재실험 대비).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React from 'react';
import { useExperiment } from './ExperimentContext.jsx';

const FONT_STACK_KO = '"Pretendard","Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans KR",sans-serif';

function formatDate(date = new Date()) {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

export default function CompletionOverlay() {
  const { userId, setExperimentPhase } = useExperiment();

  const exportUser = userId || 'user';
  const datePrefix = formatDate();
  const savedFiles = [
    `${datePrefix}_${exportUser}_T.xlsx`,
    `${datePrefix}_${exportUser}_P.xlsx`,
    `${datePrefix}_${exportUser}_result.xlsx`,
  ];

  const handleClose = () => {
    setExperimentPhase('idle');
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(15, 23, 42, 0.6)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
      fontFamily: FONT_STACK_KO,
      padding: '24px',
      boxSizing: 'border-box',
    }}>
      <div style={{
        position: 'relative',
        background: '#ffffff', borderRadius: 20,
        border: '1px solid #e2e8f0',
        boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
        width: '100%', maxWidth: 480,
        padding: '52px 48px 44px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center',
      }}>
        {/* X 버튼 */}
        <button
          onClick={handleClose}
          title="닫기"
          style={{
            position: 'absolute', top: 14, right: 14,
            width: 28, height: 28,
            borderRadius: '50%', border: 'none',
            background: '#f1f5f9', color: '#94a3b8',
            fontSize: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s, color 0.15s',
            fontFamily: 'inherit',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#e2e8f0';
            e.currentTarget.style.color = '#475569';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#f1f5f9';
            e.currentTarget.style.color = '#94a3b8';
          }}
        >
          ✕
        </button>

        <div style={{
          width: '100%', textAlign: 'left',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          <h2 style={{
            fontSize: 22, fontWeight: 700, color: '#1e293b',
            letterSpacing: '-0.03em', margin: 0, textAlign: 'center',
          }}>
            실험이 완료되었습니다.
          </h2>

          <p style={{
            fontSize: 14.5, color: '#64748b', lineHeight: 1.75,
            margin: 0, letterSpacing: '-0.01em', textAlign: 'center',
          }}>
            참여해 주셔서 감사합니다.
          </p>

          <p style={{
            fontSize: 14, fontWeight: 600, color: '#334155',
            lineHeight: 1.7, margin: '4px 0 0',
            letterSpacing: '-0.01em',
          }}>
            저장된 파일들을 메일로 보내주세요.
          </p>

          <div style={{
            display: 'flex', flexDirection: 'column', gap: 6,
            paddingLeft: 4,
          }}>
            {savedFiles.map((name) => (
              <p key={name} style={{
                fontSize: 13, color: '#475569', margin: 0,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                lineHeight: 1.6,
              }}>
                ✓ {name}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
