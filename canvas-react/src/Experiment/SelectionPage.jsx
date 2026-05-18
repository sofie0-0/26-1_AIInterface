import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useExperiment } from './ExperimentContext.jsx';

const FONT_STACK_KO = '"Pretendard","Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans KR",sans-serif';

export default function SelectionPage() {
  const navigate = useNavigate();
  const { userId, blockIndex, enterInterface } = useExperiment();

  const handleSelect = (type, path) => {
    enterInterface(type);
    navigate(path);
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f1f5f9',
        fontFamily: FONT_STACK_KO,
        gap: 0,
      }}
    >
      {/* 상단 레이블 */}
      <p style={{
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '0.12em',
        color: '#94a3b8',
        textTransform: 'uppercase',
        marginBottom: 18,
      }}>
        HCI 실험 — 인터페이스 선택
      </p>

      {/* 제목 */}
      <h1 style={{
        fontSize: 30,
        fontWeight: 700,
        color: '#1e293b',
        letterSpacing: '-0.04em',
        margin: '0 0 8px',
        textAlign: 'center',
      }}>
        비선형 AI 인터페이스 연구
      </h1>
      <p style={{
        fontSize: 15,
        color: '#64748b',
        letterSpacing: '-0.01em',
        margin: '0 0 8px',
        textAlign: 'center',
      }}>
        실험에 사용할 인터페이스를 선택하세요
      </p>

      {/* 참가자 정보 배지 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 44,
      }}>
        <span style={{
          fontSize: 12,
          fontWeight: 600,
          color: '#475569',
          background: '#e2e8f0',
          borderRadius: 20,
          padding: '4px 12px',
          letterSpacing: '-0.01em',
        }}>
          참가자: <strong style={{ color: '#1e293b' }}>{userId}</strong>
        </span>
        {blockIndex > 0 && (
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#ffffff',
            background: '#64748b',
            borderRadius: 20,
            padding: '4px 12px',
            letterSpacing: '-0.01em',
          }}>
            {blockIndex}차 블록 완료
          </span>
        )}
        <span style={{
          fontSize: 12,
          fontWeight: 600,
          color: '#0369a1',
          background: '#e0f2fe',
          borderRadius: 20,
          padding: '4px 12px',
          letterSpacing: '-0.01em',
        }}>
          {blockIndex + 1}차 블록 선택 중
        </span>
      </div>

      {/* 버튼 그룹 */}
      <div style={{
        display: 'flex',
        gap: 24,
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}>
        {/* Traditional 버튼 */}
        <InterfaceCard
          label="Traditional"
          description={
            <>
              단순 선형 채팅 구조<br />
              메모·병렬창 없음
            </>
          }
          badge="대조군"
          badgeColor="#64748b"
          onClick={() => handleSelect('traditional', '/chat-traditional')}
          icon="💬"
        />

        {/* Proposed 버튼 */}
        <InterfaceCard
          label="Proposed"
          description={
            <>
              비선형 계층적 구조<br />
              메모·추가질문 기능 포함
            </>
          }
          badge="실험군"
          badgeColor="#2563eb"
          onClick={() => handleSelect('proposed', '/chat-proposed')}
          icon="🧠"
          accent
        />
      </div>
    </div>
  );
}

function InterfaceCard({ label, description, badge, badgeColor, onClick, icon, accent }) {
  const [hovered, setHovered] = React.useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 260,
        padding: '36px 32px 30px',
        borderRadius: 20,
        border: `2px solid ${hovered ? (accent ? '#3b82f6' : '#cbd5e1') : (accent ? '#bfdbfe' : '#e2e8f0')}`,
        background: hovered ? (accent ? '#eff6ff' : '#f8fafc') : '#ffffff',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
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
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: '#ffffff',
        background: badgeColor,
        borderRadius: 6,
        padding: '3px 10px',
        textTransform: 'uppercase',
      }}>
        {badge}
      </span>

      <span style={{
        fontSize: 22,
        fontWeight: 700,
        color: '#1e293b',
        letterSpacing: '-0.03em',
      }}>
        {label}
      </span>

      <span style={{
        fontSize: 13.5,
        color: '#64748b',
        lineHeight: 1.65,
        textAlign: 'center',
        letterSpacing: '-0.01em',
      }}>
        {description}
      </span>

      <span style={{
        marginTop: 4,
        fontSize: 13,
        fontWeight: 600,
        color: accent ? '#2563eb' : '#475569',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}>
        진입하기 →
      </span>
    </button>
  );
}
