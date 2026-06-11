import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExperiment } from './ExperimentContext.jsx';

const FONT_STACK_KO = '"Pretendard","Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans KR",sans-serif';

const TOPICS = [
  '양자 컴퓨팅',
  '다다이즘',
  '합성생물학',
  '행동경제학 (Behavioral Economics)',
  '뇌-컴퓨터 인터페이스 (Brain-Computer Interface, BCI)',
];

const QUESTIONS = [
  '탐색 과정에서 중요하다고 생각한 내용 3가지를 적으시오.',
  '세 내용이 서로 어떻게 연결되는지 설명하시오.',
  '해당 분야가 실제 문제 해결에 어떻게 활용될 수 있는지 설명하시오.',
];

export default function SelectionPage() {
  const navigate = useNavigate();
  const { userId, blockIndex, enterInterface, setSelectedTopic } = useExperiment();

  const [step,  setStep]  = useState(1);
  const [topic, setTopic] = useState(null);

  const handleTopicConfirm = () => {
    if (!topic) return;
    setSelectedTopic(topic);
    setStep(2);
  };

  const handleSelect = (type, path) => {
    enterInterface(type);
    navigate(path);
  };

  /* ────────────────────────────────────────────
   * Step 1 — 과제 안내 + 주제 선택
   * ────────────────────────────────────────────*/
  if (step === 1) {
    return (
      <div style={{
        width: '100vw', minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f1f5f9', fontFamily: FONT_STACK_KO,
        padding: '40px 24px', boxSizing: 'border-box',
      }}>
        <div style={{
          background: '#ffffff', borderRadius: 20,
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
          width: '100%', maxWidth: 600,
          padding: '44px 48px',
          display: 'flex', flexDirection: 'column', gap: 0,
        }}>
          {/* 상단 레이블 */}
          <p style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
            color: '#94a3b8', textTransform: 'uppercase', margin: '0 0 14px',
          }}>
            HCI 실험 — 과제 안내
          </p>

          <h1 style={{
            fontSize: 22, fontWeight: 700, color: '#1e293b',
            letterSpacing: '-0.03em', margin: '0 0 28px',
          }}>
            탐색 과제 안내
          </h1>

          {/* 안내 문구 */}
          <div style={{
            background: '#f8fafc', borderRadius: 12,
            border: '1px solid #e2e8f0',
            padding: '20px 24px',
            display: 'flex', flexDirection: 'column', gap: 14,
            marginBottom: 28,
          }}>
            <p style={instructionStyle}>
              한 세션당 아래 제시된 주제 중 하나를 선택하여 자유롭게 탐색해 주십시오.
            </p>
            <p style={instructionStyle}>
              탐색의 목적은 선택한 주제에 대해 학습하고, 아래 세 문항에 답할 수 있을 정도로 이해하는 것입니다.
            </p>
            <p style={instructionStyle}>
              각 세션에서는 하나의 주제만 탐색합니다. 충분히 이해하여 세 문항에 모두 답할 수 있다고 판단되면 탐색을 종료해 주십시오.
            </p>
            <p style={{ ...instructionStyle, color: '#475569' }}>
              탐색은 <strong style={{ color: '#1e293b' }}>"(선택한 주제)가 뭐야?"</strong>와 같은 질문으로 시작해 보세요.
            </p>
            <p style={{
              ...instructionStyle,
              color: '#b91c1c', fontWeight: 700,
              borderTop: '1px solid #fecaca', paddingTop: 12, marginTop: 2,
            }}>
              반드시 채팅 화면 상단의 <strong style={{ color: '#991b1b' }}>[실험 시작]</strong> 버튼을 누른 후 대화를 시작해 주십시오.
            </p>
          </div>

          {/* 답변할 문항 */}
          <div style={{ marginBottom: 28 }}>
            <p style={{
              fontSize: 12, fontWeight: 700, color: '#64748b',
              letterSpacing: '0.06em', textTransform: 'uppercase',
              margin: '0 0 12px',
            }}>
              탐색 후 답변할 문항
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {QUESTIONS.map((q, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: '#ffffff', background: '#64748b',
                    borderRadius: '50%', width: 20, height: 20,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: 1,
                  }}>
                    {i + 1}
                  </span>
                  <span style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.6 }}>
                    {q}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ height: 1, background: '#f1f5f9', marginBottom: 24 }} />

          {/* 주제 선택 */}
          <div style={{ marginBottom: 24 }}>
            <p style={{
              fontSize: 12, fontWeight: 700, color: '#64748b',
              letterSpacing: '0.06em', textTransform: 'uppercase',
              margin: '0 0 12px',
            }}>
              탐색할 주제 선택
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {TOPICS.map((t) => {
                const selected = topic === t;
                return (
                  <button
                    key={t}
                    onClick={() => setTopic(t)}
                    style={{
                      textAlign: 'left',
                      padding: '11px 16px',
                      borderRadius: 10,
                      border: `1.5px solid ${selected ? '#3b82f6' : '#e2e8f0'}`,
                      background: selected ? '#eff6ff' : '#f8fafc',
                      color: selected ? '#1d4ed8' : '#475569',
                      fontSize: 13.5,
                      fontWeight: selected ? 600 : 400,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      transition: 'all 0.12s',
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}
                  >
                    <span style={{
                      width: 16, height: 16, borderRadius: '50%',
                      border: `2px solid ${selected ? '#3b82f6' : '#cbd5e1'}`,
                      background: selected ? '#3b82f6' : 'transparent',
                      flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {selected && (
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: '#ffffff',
                        }} />
                      )}
                    </span>
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleTopicConfirm}
            disabled={!topic}
            style={{
              width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
              background: topic ? '#facc15' : '#f1f5f9',
              color: topic ? '#1e293b' : '#94a3b8',
              fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
              letterSpacing: '-0.01em',
              cursor: topic ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { if (topic) e.currentTarget.style.background = '#fbbf24'; }}
            onMouseLeave={(e) => { if (topic) e.currentTarget.style.background = '#facc15'; }}
          >
            다음 — 인터페이스 선택
          </button>
        </div>
      </div>
    );
  }

  /* ────────────────────────────────────────────
   * Step 2 — 인터페이스 선택
   * ────────────────────────────────────────────*/
  return (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#f1f5f9', fontFamily: FONT_STACK_KO,
    }}>
      <p style={{
        fontSize: 12, fontWeight: 600, letterSpacing: '0.12em',
        color: '#94a3b8', textTransform: 'uppercase', marginBottom: 18,
      }}>
        HCI 실험 — 인터페이스 선택
      </p>

      <h1 style={{
        fontSize: 30, fontWeight: 700, color: '#1e293b',
        letterSpacing: '-0.04em', margin: '0 0 8px', textAlign: 'center',
      }}>
        비선형 AI 인터페이스 연구
      </h1>
      <p style={{
        fontSize: 15, color: '#64748b', letterSpacing: '-0.01em',
        margin: '0 0 8px', textAlign: 'center',
      }}>
        실험에 사용할 인터페이스를 선택하세요
      </p>

      {/* 참가자 + 주제 배지 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 44, flexWrap: 'wrap', justifyContent: 'center' }}>
        <span style={badgeStyle('#e2e8f0', '#475569')}>
          참가자: <strong style={{ color: '#1e293b' }}>{userId}</strong>
        </span>
        {topic && (
          <span style={badgeStyle('#fef9c3', '#92400e')}>
            주제: <strong style={{ color: '#78350f' }}>{topic}</strong>
          </span>
        )}
        {blockIndex > 0 && (
          <span style={badgeStyle('#64748b', '#ffffff')}>
            {blockIndex}차 블록 완료
          </span>
        )}
        <span style={badgeStyle('#e0f2fe', '#0369a1')}>
          {blockIndex + 1}차 블록 선택 중
        </span>
      </div>

      {/* 인터페이스 카드 */}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
        <InterfaceCard
          label="Traditional"
          description={<>단순 선형 채팅 구조<br />메모·병렬창 없음</>}
          badge="대조군"
          badgeColor="#64748b"
          onClick={() => handleSelect('traditional', '/chat-traditional')}
          icon="💬"
        />
        <InterfaceCard
          label="Proposed"
          description={<>비선형 계층적 구조<br />메모·추가질문 기능 포함</>}
          badge="실험군"
          badgeColor="#2563eb"
          onClick={() => handleSelect('proposed', '/chat-proposed')}
          icon="🧠"
          accent
        />
      </div>

      {/* 뒤로가기 */}
      <button
        onClick={() => setStep(1)}
        style={{
          marginTop: 32, fontSize: 13, color: '#94a3b8',
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        ← 주제 다시 선택
      </button>
    </div>
  );
}

/* ── 스타일 헬퍼 ── */
const instructionStyle = {
  fontSize: 13.5, color: '#64748b', lineHeight: 1.75,
  letterSpacing: '-0.01em', margin: 0, wordBreak: 'keep-all',
};

function badgeStyle(bg, color) {
  return {
    fontSize: 12, fontWeight: 600, color,
    background: bg, borderRadius: 20, padding: '4px 12px',
    letterSpacing: '-0.01em',
  };
}

function InterfaceCard({ label, description, badge, badgeColor, onClick, icon, accent }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 260, padding: '36px 32px 30px', borderRadius: 20,
        border: `2px solid ${hovered ? (accent ? '#3b82f6' : '#cbd5e1') : (accent ? '#bfdbfe' : '#e2e8f0')}`,
        background: hovered ? (accent ? '#eff6ff' : '#f8fafc') : '#ffffff',
        cursor: 'pointer', display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 14,
        boxShadow: hovered
          ? '0 12px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.05)'
          : '0 2px 8px rgba(0,0,0,0.05)',
        transition: 'all 0.18s ease',
        transform: hovered ? 'translateY(-3px)' : 'none',
        fontFamily: 'inherit',
      }}
    >
      <span style={{ fontSize: 36 }}>{icon}</span>
      <span style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
        color: '#ffffff', background: badgeColor,
        borderRadius: 6, padding: '3px 10px', textTransform: 'uppercase',
      }}>
        {badge}
      </span>
      <span style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', letterSpacing: '-0.03em' }}>
        {label}
      </span>
      <span style={{ fontSize: 13.5, color: '#64748b', lineHeight: 1.65, textAlign: 'center', letterSpacing: '-0.01em' }}>
        {description}
      </span>
      <span style={{
        marginTop: 4, fontSize: 13, fontWeight: 600,
        color: accent ? '#2563eb' : '#475569',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        진입하기 →
      </span>
    </button>
  );
}
