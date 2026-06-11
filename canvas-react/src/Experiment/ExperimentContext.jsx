import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const ExperimentContext = createContext(null);

const SESSION_KEY = 'exp-session';

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function ExperimentProvider({ children }) {
  const [isLoggedIn,          setIsLoggedIn]          = useState(false);
  const [userId,               setUserId]               = useState('');
  const [interfaceType,        setInterfaceType]        = useState(null);
  const [blockIndex,           setBlockIndex]           = useState(0);
  const [isExperimentActive,   setIsExperimentActive]   = useState(false);

  /**
   * experimentPhase: 실험 진행 단계 (페이지 이동 후에도 유지)
   *   'idle'  — 실험 시작 전 (또는 전체 종료 후)
   *   'ended' — 한 블록을 종료하고 다음 블록을 대기 중
   */
  const [experimentPhase, setExperimentPhase] = useState('idle');

  /* ── 세션 복원 (새로고침 대비) ── */
  useEffect(() => {
    const saved = loadSession();
    if (saved?.isLoggedIn) {
      setIsLoggedIn(true);
      setUserId(saved.userId ?? '');
      setInterfaceType(saved.interfaceType ?? null);
      setBlockIndex(saved.blockIndex ?? 0);
      setIsExperimentActive(saved.isExperimentActive ?? false);
      setExperimentPhase(saved.experimentPhase ?? 'idle');
    }
  }, []);

  /* ── 세션 저장 ── */
  useEffect(() => {
    if (!isLoggedIn) return;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      isLoggedIn, userId, interfaceType, blockIndex,
      isExperimentActive, experimentPhase,
    }));
  }, [isLoggedIn, userId, interfaceType, blockIndex, isExperimentActive, experimentPhase]);

  /**
   * 공통 로그인: User ID를 Context에 저장
   */
  const login = useCallback((id) => {
    setUserId(id);
    setIsLoggedIn(true);
    setExperimentPhase('idle');   /* 새 사용자 로그인 시 단계 리셋 */
  }, []);

  /**
   * 인터페이스 진입: 선택 화면에서 버튼 클릭 시 호출
   * - interfaceType 갱신 ('traditional' | 'proposed')
   * - blockIndex += 1  (1차 → 1, 2차 → 2)
   * - isExperimentActive 리셋 (새 블록마다 [실험 시작] 다시 눌러야 함)
   */
  const enterInterface = useCallback((type) => {
    setInterfaceType(type);
    setBlockIndex((prev) => prev + 1);
    setIsExperimentActive(false);
  }, []);

  return (
    <ExperimentContext.Provider value={{
      isLoggedIn,
      userId,
      interfaceType,
      blockIndex,
      isExperimentActive,
      setIsExperimentActive,
      experimentPhase,
      setExperimentPhase,
      login,
      enterInterface,
    }}>
      {children}
    </ExperimentContext.Provider>
  );
}

export function useExperiment() {
  const ctx = useContext(ExperimentContext);
  if (!ctx) throw new Error('useExperiment must be used inside ExperimentProvider');
  return ctx;
}
