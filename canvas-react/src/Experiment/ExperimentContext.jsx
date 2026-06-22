import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const ExperimentContext = createContext(null);

const SESSION_KEY    = 'exp-session';
const BLOCK_CNT_KEY  = 'exp-block-counts'; // localStorage: { [userId]: blockCount }

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/** localStorage에서 userId별 누적 블록 수 읽기 */
function loadBlockCount(userId) {
  try {
    const raw = localStorage.getItem(BLOCK_CNT_KEY);
    return (raw ? JSON.parse(raw) : {})[userId] ?? 0;
  } catch { return 0; }
}

/** localStorage에 userId별 누적 블록 수 저장 */
function saveBlockCount(userId, count) {
  try {
    const raw  = localStorage.getItem(BLOCK_CNT_KEY);
    const data = raw ? JSON.parse(raw) : {};
    data[userId] = count;
    localStorage.setItem(BLOCK_CNT_KEY, JSON.stringify(data));
  } catch {}
}

export function ExperimentProvider({ children }) {
  const [isLoggedIn,            setIsLoggedIn]            = useState(false);
  const [userId,                 setUserId]                 = useState('');
  const [interfaceType,          setInterfaceType]          = useState(null);
  const [blockIndex,             setBlockIndex]             = useState(0);
  const [isExperimentActive,     setIsExperimentActive]     = useState(false);
  const [selectedTopic,          setSelectedTopic]          = useState(null);
  const [explorationDurationMs,  setExplorationDurationMs]  = useState(0);
  /** Session 1 결과를 임시 보관. Session 2 제출 시 합쳐서 xlsx 1개로 다운로드. */
  const [pendingResult,          setPendingResult]          = useState(null);

  /**
   * experimentPhase: 실험 진행 단계 (페이지 이동 후에도 유지)
   *   'idle'       — 실험 시작 전 (또는 결과 제출 후 다음 세션 대기)
   *   'writing'    — 탐색 종료, 결과 작성 오버레이 표시 중 (로그 수집 OFF)
   *   'ready_next' — 탐색 종료 후, 다음 세션 시작 / 다운로드 버튼 대기
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
      setSelectedTopic(saved.selectedTopic ?? null);
      setExplorationDurationMs(saved.explorationDurationMs ?? 0);
      setPendingResult(saved.pendingResult ?? null);
    }
  }, []);

  /* ── 세션 저장 ── */
  useEffect(() => {
    if (!isLoggedIn) return;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      isLoggedIn, userId, interfaceType, blockIndex,
      isExperimentActive, experimentPhase,
      selectedTopic, explorationDurationMs, pendingResult,
    }));
  }, [
    isLoggedIn, userId, interfaceType, blockIndex,
    isExperimentActive, experimentPhase,
    selectedTopic, explorationDurationMs, pendingResult,
  ]);

  /**
   * 공통 로그인: User ID를 Context에 저장.
   * userId 별 누적 블록 수를 localStorage에서 복원하고
   * 이전 사용자의 세션 데이터를 초기화한다.
   */
  const login = useCallback((id) => {
    const savedCount = loadBlockCount(id);
    setUserId(id);
    setIsLoggedIn(true);
    setBlockIndex(savedCount);
    setExperimentPhase('idle');
    setSelectedTopic(null);
    setPendingResult(null);
    setExplorationDurationMs(0);
    setIsExperimentActive(false);
  }, []);

  /**
   * 인터페이스 진입: 선택 화면에서 버튼 클릭 시 호출
   * - interfaceType 갱신 ('traditional' | 'proposed')
   * - blockIndex += 1, localStorage에 userId별로 저장
   * - isExperimentActive 리셋 (새 블록마다 [실험 시작] 다시 눌러야 함)
   */
  const enterInterface = useCallback((type) => {
    setInterfaceType(type);
    setBlockIndex((prev) => {
      const next = prev + 1;
      saveBlockCount(userId, next);
      return next;
    });
    setIsExperimentActive(false);
  }, [userId]);

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
      selectedTopic,
      setSelectedTopic,
      explorationDurationMs,
      setExplorationDurationMs,
      pendingResult,
      setPendingResult,
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
