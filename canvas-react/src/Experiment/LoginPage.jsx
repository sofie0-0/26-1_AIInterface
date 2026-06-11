/**
 * 공통 로그인 페이지
 * 로그인 성공 시 ExperimentContext 에 userId/apiKey 저장 후
 * 인터페이스 선택 화면(/experiment-select)으로 이동합니다.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExperiment } from './ExperimentContext.jsx';

const FONT_STACK_KO = '"Pretendard","Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans KR",sans-serif';

function FormField({ label, type, value, onChange, placeholder }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', letterSpacing: '-0.01em' }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '10px 14px', borderRadius: 10,
          border: '1px solid #e2e8f0', background: '#f8fafc', color: '#1e293b',
          fontSize: 14, fontFamily: 'inherit', outline: 'none',
          boxSizing: 'border-box', transition: 'box-shadow 0.15s',
        }}
        onFocus={(e) => { e.target.style.boxShadow = '0 0 0 3px rgba(250,204,21,0.35)'; e.target.style.borderColor = 'transparent'; }}
        onBlur={(e)  => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = '#e2e8f0'; }}
      />
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useExperiment();

  const [inputUserId, setInputUserId] = useState('');
  const [error,       setError]       = useState('');

  const isValid = inputUserId.trim() !== '';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isValid) { setError('실험 ID를 입력해 주세요.'); return; }
    setError('');
    login(inputUserId.trim());
    navigate('/experiment-select', { replace: true });
  };

  return (
    <div style={{
      width: '100vw', height: '100vh', overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f1f5f9', fontFamily: FONT_STACK_KO,
    }}>
      <div style={{
        background: '#ffffff', borderRadius: 20,
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 24px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)',
        width: '100%', maxWidth: 380, margin: '0 24px',
        padding: '40px 36px', display: 'flex', flexDirection: 'column', gap: 0,
      }}>

        {/* 타이틀 */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{
            fontSize: 22, fontWeight: 700, color: '#1e293b',
            letterSpacing: '-0.03em', whiteSpace: 'nowrap', margin: 0,
          }}>
            비선형 AI 인터페이스
          </h1>
          <p style={{
            fontSize: 13, color: '#94a3b8', marginTop: 6,
            letterSpacing: '-0.01em', whiteSpace: 'nowrap',
          }}>
            실험 세션을 시작하려면 아래 정보를 입력하세요
          </p>
        </div>

        <div style={{ height: 1, background: '#f1f5f9', marginBottom: 24 }} />

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FormField
            label="User ID"
            type="text"
            value={inputUserId}
            onChange={(e) => setInputUserId(e.target.value)}
            placeholder="실험 ID를 입력하세요 (예: user01)"
          />
          <p style={{
            fontSize: 12.5, fontWeight: 500, color: '#ef4444',
            textAlign: 'center', lineHeight: 1.6, wordBreak: 'keep-all', margin: '2px 0 0',
          }}>
            실험 중에는 절대 새로고침을 하지 마세요.<br />
            새로고침 시 자동으로 로그아웃됩니다.
          </p>

          {error && (
            <p style={{
              fontSize: 13, color: '#ef4444', textAlign: 'center',
              fontWeight: 500, margin: '-4px 0 0', wordBreak: 'keep-all',
            }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!isValid}
            style={{
              width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
              background: isValid ? '#facc15' : '#f1f5f9',
              color: isValid ? '#1e293b' : '#94a3b8',
              fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
              letterSpacing: '-0.01em',
              cursor: isValid ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s, color 0.15s',
              marginTop: 4, whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => { if (isValid) e.currentTarget.style.background = '#fbbf24'; }}
            onMouseLeave={(e) => { if (isValid) e.currentTarget.style.background = '#facc15'; }}
          >
            시작하기 (Start Experiment)
          </button>
        </form>
      </div>
    </div>
  );
}
