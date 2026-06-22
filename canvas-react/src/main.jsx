import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import './index.css';
import { ExperimentProvider, useExperiment } from './Experiment/ExperimentContext.jsx';
import { ExperimentLogProvider } from './Experiment/ExperimentLogContext.jsx';

const ProposedChat    = lazy(() => import('./App.jsx'));
const LoginPage       = lazy(() => import('./Experiment/LoginPage.jsx'));
const SelectionPage   = lazy(() => import('./Experiment/SelectionPage.jsx'));
const TraditionalChat = lazy(() => import('./Experiment/TraditionalChat.jsx'));

/**
 * 로그인 상태를 검사하는 라우트 가드.
 * 미인증 시 /login 으로 리다이렉트합니다.
 */
function ProtectedRoute({ children }) {
  const { isLoggedIn } = useExperiment();
  const location = useLocation();
  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

function ExperimentOverlayManager({ children }) {
  return <>{children}</>;
}

const fallbackStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100vh',
  fontSize: 15,
  color: '#94a3b8',
  fontFamily: '"Pretendard","Inter",sans-serif',
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ExperimentProvider>
      <ExperimentLogProvider>
        <BrowserRouter>
          <Suspense fallback={<div style={fallbackStyle}>로딩 중...</div>}>
            <ExperimentOverlayManager>
            <Routes>
              {/* 루트 진입 → 로그인 화면으로 리다이렉트 */}
              <Route path="/" element={<Navigate to="/login" replace />} />

              {/* 공통 로그인 화면 */}
              <Route path="/login" element={<LoginPage />} />

              {/* ── 인증 필요 라우트 ── */}

              {/* 인터페이스 선택 화면 */}
              <Route
                path="/experiment-select"
                element={<ProtectedRoute><SelectionPage /></ProtectedRoute>}
              />

              {/* Traditional (선형) 인터페이스 — 대조군 */}
              <Route
                path="/chat-traditional"
                element={<ProtectedRoute><TraditionalChat /></ProtectedRoute>}
              />

              {/* Proposed (비선형) 인터페이스 — 실험군 */}
              <Route
                path="/chat-proposed"
                element={<ProtectedRoute><ProposedChat /></ProtectedRoute>}
              />

              {/* 그 외 경로 → 로그인 화면 */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
            </ExperimentOverlayManager>
          </Suspense>
        </BrowserRouter>
      </ExperimentLogProvider>
    </ExperimentProvider>
  </StrictMode>,
);
