/* ─────────────────── Gemini API 상수 ─────────────────── */
export const GEMINI_API_VERSION = 'v1';
export const GEMINI_MODEL = 'gemini-2.5-flash';

/* ─────────────────── 레이아웃 너비 상수 ─────────────────────────────────────
 * 이 객체가 전체 패널 너비의 단일 진실 공급원(Single Source of Truth)이다.
 * 패널 너비를 변경할 때는 반드시 이 객체만 수정하고,
 * JSX 내 인라인 값(%, px)을 직접 바꾸지 않는다.
 * ─────────────────────────────────────────────────────────────────────────── */
export const LAYOUT = {
  /** 오버레이 채팅 목록 사이드바 (절대위치, flex flow 외부) */
  OVERLAY_SIDEBAR_W: 300,
  /** 좌측 포스트잇 노트 패널 */
  LEFT_NOTES_W:      250,
  /** 세로 목차 (Conversation Index) */
  TOC_W:             150,
  /** 우측 Deep Dive 패널 */
  RIGHT_PANEL_W:     400,
  /** 각 패널의 최소 축소 한계 (리사이즈 핸들 추가 시 사용) */
  LEFT_NOTES_MIN_W:  180,
  TOC_MIN_W:         120,
  RIGHT_PANEL_MIN_W: 280,
};

/* ── 메모 수납 구역 상수 ── */
export const NOTE_CARD_W         = 225;  // 메모 고정 너비 (floating/stored 공통)
export const NOTE_CARD_H         = 168;  // 메모 고정 높이 (펼친 상태, floating/stored 공통)
export const NOTE_STORED_W       = NOTE_CARD_W;
export const NOTE_STACK_PAD      = 10;   // 수납 구역 상단 여백
export const NOTE_STACK_GAP      = 8;    // 수납된 메모 간 간격
export const NOTE_SNAP_THRESHOLD = 0.6;  // 60% 이상 겹치면 자동 수납

export const FONT_STACK_KO = '"Pretendard","Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans KR",sans-serif';
export const FONT_STACK_EN = '"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';
export const STORAGE_KEY_HISTORY   = 'hci-proto-history';
export const STORAGE_KEY_ACTIVE_ID = 'hci-proto-active-id';
