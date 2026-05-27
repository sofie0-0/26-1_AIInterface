import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import StartButton from './Experiment/StartButton.jsx';
import { useExperiment } from './Experiment/ExperimentContext.jsx';
import { useExperimentLog } from './Experiment/ExperimentLogContext.jsx';
import {
  Bot,
  ChevronDown,
  ChevronRight,
  MoveUpRight,
  GripHorizontal,
  GripVertical,
  Menu,
  MessageSquare,
  MessageSquarePlus,
  Pencil,
  Trash2,
  Plus,
  Send,
  StickyNote,
  X,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { motion } from 'framer-motion';

/* ─────────────────── 상수 ─────────────────── */
const GEMINI_API_VERSION = 'v1';
const GEMINI_MODEL = 'gemini-2.5-flash';

/* ─────────────────── 레이아웃 너비 상수 ─────────────────────────────────────
 * 이 객체가 전체 패널 너비의 단일 진실 공급원(Single Source of Truth)이다.
 * 패널 너비를 변경할 때는 반드시 이 객체만 수정하고,
 * JSX 내 인라인 값(%, px)을 직접 바꾸지 않는다.
 * ─────────────────────────────────────────────────────────────────────────── */
const LAYOUT = {
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
const NOTE_CARD_W         = 225;  // 메모 고정 너비 (floating/stored 공통)
const NOTE_CARD_H         = 168;  // 메모 고정 높이 (펼친 상태, floating/stored 공통)
const NOTE_STORED_W       = NOTE_CARD_W;
const NOTE_STACK_PAD      = 10;   // 수납 구역 상단 여백
const NOTE_STACK_GAP      = 8;    // 수납된 메모 간 간격
const NOTE_SNAP_THRESHOLD = 0.6;  // 60% 이상 겹치면 자동 수납

const FONT_STACK_KO = '"Pretendard","Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans KR",sans-serif';
const FONT_STACK_EN = '"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';
const STORAGE_KEY_HISTORY   = 'hci-proto-history';
const STORAGE_KEY_ACTIVE_ID = 'hci-proto-active-id';

/* ─────────────────── 다국어 번역 ─────────────────── */
const translations = {
  ko: {
    newChat: '새 채팅',
    newChatTitle: '새로운 채팅',
    newChatInitMsg: '새 채팅을 시작합니다. 무엇을 도와드릴까요?',
    deleteConfirm: '이 채팅을 삭제하시겠습니까?',
    renamePrompt: '새로운 채팅 이름을 입력하세요.',
    chatFallbackTitle: '채팅',
    centerSubtitle: 'Smart, clean, paper-like interaction prototype',
    inputPlaceholder: '메시지 입력…',
    memoButton: '메모',
    deepDiveButton: '추가질문',
    deepDivePanelHeader: '추가 질문',
    sideChatInputPlaceholder: '추가 질문 입력…',
    sourceText: '참조 텍스트',
    sideChatInitMsg: (text) => `"${text}" 부분에 대해 더 궁금한 점이 있으신가요?`,
    notePlaceholder: '메모를 입력하세요…',
    renameTitle: '이름 변경',
    deleteTitle: '삭제',
    moveToText: '본문으로 이동',
    cancelLabel: '취소',
    confirmNoteDeleteTitle: '메모 삭제',
    confirmNoteDeleteMsg: '메모와 연결된 하이라이트가 함께 삭제됩니다.',
    confirmChatDeleteTitle: '추가질문 삭제',
    confirmChatDeleteMsg: '이 추가질문 스레드 전체가 삭제됩니다.',
    generatingAnswer: '답변 생성 중',
    errorMsg: '죄송합니다. 오류가 발생했습니다.',
    sideChatErrorMsg: '오류가 발생했습니다.',
    selectThreadHint: '좌측 목차에서 질문을 선택하세요',
    sourceRefShort: '참조',
    tocGuide: '생성된 여러 대화들을\n한눈에 파악하고 계층적으로\n관리하세요.',
    memoStorageEmptyGuide:
      '%%MEMO%%를 생성하고 이곳에서 정리하세요.',
    memoStorageHighlightWord: '메모',
    ghostTitles: ['질문 1', '질문 2', '질문 3'],
    aiUser: '사용자',
    aiAI: 'AI',
    systemInstruction: '반드시 한국어로 답변하세요. 계층적인 대화 구조를 유지하세요.',
    sideChatAck: '네, 위 지침에 따라 답변하겠습니다.',
    sideChatSystemBase:
`너는 학습 보조원이다. 추가 질문 답변은 반드시 아래 구조·형식을 따른다.

[필수 구조 — 메인 창과 같은 계층 가독성]
1. 인사말·도입 문장 없이 바로 본론으로 시작한다.
2. 긴 줄글(연속 문단)로 답하지 않는다. 핵심은 반드시 번호 목록(1. 2. 3.)으로 나눈다. 번호 항목은 보통 2~4개, 최대 5개.
3. 각 번호 항목의 첫 줄은 **'1. 핵심 주제'** 형태처럼 번호 뒤에 한 줄로 요지를 쓴다(필요 시 제목 일부만 **강조**).
4. 각 번호 항목 아래에는 반드시 하이픈(-) 또는 불릿(•)으로 시작하는 하위 목록을 둔다. 하위 항목은 들여쓰기(줄 시작에 공백 3칸 후 - 또는 * 사용)하여 번호 항목에 종속되게 마크다운 중첩 리스트로 작성한다.
5. 각 하위 불렛은 1~2문장만 허용한다. 불렛 개수는 번호당 1~3개.
6. 마크다운 굵게 표기는 한 문장에 핵심 단어 하나 정도만 적용한다. 번호 줄·불렛 줄 전체를 굵게 하지 않는다.
7. 말투는 사실 중심으로 건조하게 유지한다.`,
    sideChatContextPrefix: (mainCtx) =>
`메인 대화 맥락을 반드시 참고하여, 이 포스트잇에서 이어지는 추가 질문에만 답하라.

[메인 대화 내용]
${mainCtx}`,
    noteSystemInstruction: (mainCtx) =>
`당신은 사용자의 비선형적 사고를 돕는 연구 보조원입니다. 메인 대화의 흐름을 바탕으로 이 포스트잇의 질문에 구체적으로 답해주세요.\n\n[메인 대화 내용]\n${mainCtx}`,
  },
  en: {
    newChat: 'New Chat',
    newChatTitle: 'New Chat',
    newChatInitMsg: 'Starting a new chat. How can I help you?',
    deleteConfirm: 'Delete this chat?',
    renamePrompt: 'Enter a new name for this chat.',
    chatFallbackTitle: 'Chat',
    centerSubtitle: 'Smart, clean, paper-like interaction prototype',
    inputPlaceholder: 'Enter a message…',
    memoButton: 'Note',
    deepDiveButton: 'Deep Dive',
    deepDivePanelHeader: 'Deep Dive',
    sideChatInputPlaceholder: 'Ask a follow-up…',
    sourceText: 'Source Text',
    sideChatInitMsg: (text) => `Do you have more questions about "${text}"?`,
    notePlaceholder: 'Write a note…',
    renameTitle: 'Rename',
    deleteTitle: 'Delete',
    moveToText: 'Go to source',
    cancelLabel: 'Cancel',
    confirmNoteDeleteTitle: 'Delete Note',
    confirmNoteDeleteMsg: 'The note and its linked highlight will be removed.',
    confirmChatDeleteTitle: 'Delete Thread',
    confirmChatDeleteMsg: 'This entire thread will be permanently deleted.',
    generatingAnswer: 'Generating response',
    errorMsg: 'Sorry, an error occurred.',
    sideChatErrorMsg: 'An error occurred.',
    selectThreadHint: 'Select a conversation from the index',
    sourceRefShort: 'Ref',
    tocGuide: 'Track all threads\nat a glance and manage\nthem hierarchically.',
    memoStorageEmptyGuide:
      'Create and drag %%MEMO%% here to organize.',
    memoStorageHighlightWord: 'memos',
    ghostTitles: ['Thread 1', 'Thread 2', 'Thread 3'],
    aiUser: 'User',
    aiAI: 'AI',
    systemInstruction: 'IMPORTANT: You must respond in English ONLY. Maintain the hierarchical thread structure.',
    sideChatAck: 'Understood. I will follow the instructions above.',
    sideChatSystemBase:
`You are a learning assistant. Follow the structure and format below for all responses.

[Required Structure — Same hierarchical readability as the main window]
1. Begin directly with content — no greeting or introductory sentence.
2. Do not respond in long prose paragraphs. Key points must be organized in numbered lists (1. 2. 3.). Typically 2–4 numbered items, maximum 5.
3. The first line of each numbered item should state the core topic in one line after the number (bold key terms only when needed).
4. Each numbered item must include sub-bullets starting with a hyphen (-) or bullet (•), indented to show subordination using nested markdown lists.
5. Each sub-bullet is limited to 1–2 sentences. Use 1–3 sub-bullets per numbered item.
6. Apply bold markdown sparingly — at most one key term per sentence. Do not bold entire lines.
7. Keep the tone factual and concise.`,
    sideChatContextPrefix: (mainCtx) =>
`Refer to the main conversation context and answer only the follow-up question in this thread.

[Main Conversation]
${mainCtx}`,
    noteSystemInstruction: (mainCtx) =>
`You are a research assistant supporting non-linear thinking. Based on the main conversation, answer the question in this note specifically.\n\n[Main Conversation]\n${mainCtx}`,
  },
};

const initialData = {
  messages: [
    {
      id: 1,
      sender: 'ai',
      text:
        '비선형적 상호작용 캔버스입니다.\n\n중앙 대화의 텍스트 일부를 드래그(하이라이트)하면,\n좌측에는 메모 포스트잇이, 우측에는 추가질문 포스트잇이 생성됩니다.',
    },
  ],
  notes: [],
  sideChats: [],
  highlights: [],
};

/* ─────────────────── 순수 유틸 ─────────────────── */
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function truncateTitle(text, maxLen = 18) {
  const first = String(text || '').split('\n')[0].trim();
  if (!first) return 'Untitled';
  return first.length > maxLen ? `${first.slice(0, maxLen)}…` : first;
}




/** 오버레이(data-highlight-overlay-root) 내부를 제외한 가시 텍스트 노드 목록 */
function walkTextNodes(root) {
  const nodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.parentElement?.closest('[data-highlight-overlay-root]'))
        return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  return nodes;
}

/**
 * textRoot 내 가시 텍스트 노드들을 walkTextNodes로 순회하며
 * (targetNode, targetOffset) 이전의 글자 수를 반환.
 *
 * ★ range.toString() 대신 이 함수를 사용해야 하는 이유:
 *   range.toString()은 <p>·<li>·<h4> 등 블록 요소 경계마다
 *   실제 DOM에 없는 "\n"을 자동 삽입한다.
 *   반면 findRangeFromOffsets(walkTextNodes 기반)는 이를 포함하지 않아
 *   두 값이 어긋나 하이라이트 위치가 밀린다.
 */
function countVisibleCharsUpTo(textRoot, targetNode, targetOffset) {
  // 선택 포인트가 요소 노드를 가리킬 경우 → 가장 가까운 텍스트 노드로 해석
  let tNode = targetNode;
  let tOff  = targetOffset;
  if (tNode.nodeType === Node.ELEMENT_NODE) {
    const child = tNode.childNodes[tOff];
    if (child) {
      const tw = document.createTreeWalker(child, NodeFilter.SHOW_TEXT);
      const first = tw.nextNode();
      if (first) { tNode = first; tOff = 0; }
    }
  }

  const nodes = walkTextNodes(textRoot);
  let count = 0;
  for (const node of nodes) {
    if (node === tNode) {
      return count + Math.min(tOff, node.textContent.length);
    }
    // tNode가 현재 node보다 앞에 있으면 → 이미 target을 지남
    if (tNode && (node.compareDocumentPosition(tNode) & Node.DOCUMENT_POSITION_PRECEDING)) {
      return count;
    }
    count += node.textContent.length;
  }
  return count;
}

/** Range의 DOMRect 목록을 textRoot 기준 상대 좌표로 변환 */
function rectsRelativeToTextRoot(textRoot, range) {
  const br = textRoot.getBoundingClientRect();
  return Array.from(range.getClientRects())
    .filter((r) => r.width > 0 && r.height > 0)
    .map((r) => ({
      left:   r.left   - br.left + textRoot.scrollLeft,
      top:    r.top    - br.top  + textRoot.scrollTop,
      width:  r.width,
      height: r.height,
    }));
}

/** 문자 오프셋 범위로 DOM Range 생성 */
function findRangeFromOffsets(textRoot, startOffset, endOffset) {
  const nodes = walkTextNodes(textRoot);
  let cumulative = 0;
  let startNode = null, startOff = 0;
  let endNode   = null, endOff   = 0;

  for (const node of nodes) {
    const len = node.textContent.length;
    if (!startNode && cumulative + len > startOffset) {
      startNode = node;
      startOff  = Math.min(startOffset - cumulative, len);
    }
    if (!endNode && cumulative + len >= endOffset) {
      endNode = node;
      endOff  = Math.min(endOffset - cumulative, len);
      break;
    }
    cumulative += len;
  }

  if (!startNode || !endNode) return null;
  const range = document.createRange();
  range.setStart(startNode, startOff);
  range.setEnd(endNode, endOff);
  return range;
}

/** 구 형식(type:'note'|'chat') → 신 형식(links:[{id,type}]) 마이그레이션 */
function migrateHighlights(hs) {
  if (!Array.isArray(hs)) return [];
  return hs.map((h) => {
    if (Array.isArray(h.links)) return h;
    const type = h.type || 'note';
    return { ...h, links: [{ id: h.id, type }] };
  });
}

/* ─────────────────── MessageTextWithHighlightOverlays ─────────────────── */
function MessageTextWithHighlightOverlays({
  messageId,
  isUser,
  msgText,
  isStreamingSkeleton,
  highlights,
  highlightIndexMap,
  scrollToPostIt,
  onHighlightHover,
  onHighlightLeave,
  flashingHighlightId,
  hoveredPostItId,
  markdownRehypePlugins,
  markdownComponents,
  scrollContainerRef,
  markdownClassName = 'ai-markdown',
}) {
  const msgHighlights = useMemo(
    () =>
      (highlights || [])
        .filter((h) => h.messageId === messageId && h.startOffset !== undefined)
        .sort((a, b) => a.startOffset - b.startOffset),
    [highlights, messageId]
  );

  const [boxes,             setBoxes]             = useState([]);
  const [localHoveredHlId,  setLocalHoveredHlId]  = useState(null);
  const [promptingChipsHlId,setPromptingChipsHlId] = useState(null);

  const textRootRef         = useRef(null);
  const localHoveredHlIdRef = useRef(null);
  const scaleSpanRef        = useRef(null);

  // onHighlightLeave의 최신 버전을 ref로 유지 (useCallback 의존성 최소화)
  const onHighlightLeaveRef = useRef(onHighlightLeave);
  useEffect(() => { onHighlightLeaveRef.current = onHighlightLeave; }, [onHighlightLeave]);

  /* ── 하이라이트 rect 측정 ── */
  const measure = useCallback(() => {
    const textRoot = textRootRef.current;
    if (!textRoot) return;
    const newBoxes = msgHighlights.map((hl) => {
      try {
        const range = findRangeFromOffsets(textRoot, hl.startOffset, hl.endOffset);
        if (!range) return { hl, rects: [] };
        return { hl, rects: rectsRelativeToTextRoot(textRoot, range) };
      } catch {
        return { hl, rects: [] };
      }
    });
    setBoxes(newBoxes);
  }, [msgHighlights]);

  useLayoutEffect(() => { measure(); }, [measure]);

  useEffect(() => {
    const textRoot = textRootRef.current;
    if (!textRoot) return;

    const ro = new ResizeObserver(measure);
    ro.observe(textRoot);

    const mo = new MutationObserver(measure);
    mo.observe(textRoot, { childList: true, subtree: true, characterData: true });

    const scrollEl = scrollContainerRef?.current;
    if (scrollEl) scrollEl.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure, { passive: true });

    return () => {
      ro.disconnect();
      mo.disconnect();
      if (scrollEl) scrollEl.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [measure, scrollContainerRef]);

  /* ── 활성 하이라이트 텍스트 scale 효과 ── */
  useLayoutEffect(() => {
    const textRoot = textRootRef.current;
    if (!textRoot) return;

    // 이전 span 해제
    const prev = scaleSpanRef.current;
    if (prev && prev.parentNode) {
      const parent = prev.parentNode;
      while (prev.firstChild) parent.insertBefore(prev.firstChild, prev);
      parent.removeChild(prev);
      scaleSpanRef.current = null;
    }

    const activeHlId = flashingHighlightId ?? hoveredPostItId;
    if (!activeHlId) return;
    const activeHl = msgHighlights.find((h) => h.id === activeHlId);
    if (!activeHl) return;

    try {
      const range = findRangeFromOffsets(textRoot, activeHl.startOffset, activeHl.endOffset);
      if (!range) return;

      const span = document.createElement('span');
      span.className = 'hl-text-scale-active';
      try {
        range.surroundContents(span);
      } catch {
        const frag = range.extractContents();
        span.appendChild(frag);
        range.insertNode(span);
      }
      scaleSpanRef.current = span;
    } catch {
      /* 복잡한 range는 무시 */
    }
  }, [flashingHighlightId, hoveredPostItId, msgHighlights]);

  /* ── 마우스 이벤트 (hit-testing) ── */
  const handleBodyMouseMove = useCallback(
    (e) => {
      const textRoot = textRootRef.current;
      if (!textRoot) return;
      const br = textRoot.getBoundingClientRect();
      const mx = e.clientX - br.left;
      const my = e.clientY - br.top;

      let foundId = null;
      outer: for (const { hl, rects } of boxes) {
        for (let ri = 0; ri < rects.length; ri++) {
          const r = rects[ri];
          // 첫 번째 rect는 위로 32px 확장 → 플로팅 칩까지 호버 영역에 포함 (타이머 불필요)
          const topPad = ri === 0 ? 32 : 2;
          if (
            mx >= r.left - 4 &&
            mx <= r.left + r.width + 4 &&
            my >= r.top - topPad &&
            my <= r.top + r.height + 2
          ) {
            foundId = hl.id;
            break outer;
          }
        }
      }

      if (foundId !== localHoveredHlIdRef.current) {
        localHoveredHlIdRef.current = foundId;
        setLocalHoveredHlId(foundId);
        if (foundId) {
          onHighlightHover(foundId);
        } else {
          onHighlightLeaveRef.current();
        }
      }
    },
    [boxes, onHighlightHover]
  );

  // 메시지 body를 벗어나면 즉시 칩 상태 초기화
  const handleBodyMouseLeave = useCallback(() => {
    if (localHoveredHlIdRef.current !== null) {
      localHoveredHlIdRef.current = null;
      setLocalHoveredHlId(null);
      onHighlightLeaveRef.current();
    }
  }, []);

  const handleBodyClick = useCallback(
    (e) => {
      const sel = window.getSelection();
      if (sel && sel.toString().length > 0) return;

      const textRoot = textRootRef.current;
      if (!textRoot) return;
      const br = textRoot.getBoundingClientRect();
      const mx = e.clientX - br.left;
      const my = e.clientY - br.top;

      for (const { hl, rects } of boxes) {
        for (const r of rects) {
          if (mx >= r.left && mx <= r.left + r.width && my >= r.top && my <= r.top + r.height) {
            const links = hl.links || [];
            if (links.length === 1) {
              scrollToPostIt(links[0].id);
            } else if (links.length > 1) {
              setPromptingChipsHlId(hl.id);
              setTimeout(
                () => setPromptingChipsHlId((prev) => (prev === hl.id ? null : prev)),
                900
              );
            }
            return;
          }
        }
      }
    },
    [boxes, scrollToPostIt]
  );

  /* ── 렌더 ── */
  return (
    <div
      data-message-body
      className="relative"
      style={{ overflow: 'visible' }}
      onMouseMove={handleBodyMouseMove}
      onMouseLeave={handleBodyMouseLeave}
      onClick={handleBodyClick}
    >
      {/* Layer 0: 배경 하이라이트 박스 */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        data-highlight-overlay-root
      >
        {boxes.flatMap(({ hl, rects }) => {
          const links   = hl.links || [];
          const hasNote = links.some((l) => l.type === 'note');
          const hasChat = links.some((l) => l.type === 'chat');
          const isMixed = hasNote && hasChat;

          const isFlashing    = flashingHighlightId === hl.id;
          const isPostItHover = hoveredPostItId     === hl.id;
          const isLocalHover  = localHoveredHlId    === hl.id;
          const isActive      = isFlashing || isPostItHover || isLocalHover;

          const bgColor = isMixed
            ? 'rgba(34,197,94,0.55)'
            : isActive
              ? hasNote ? 'rgba(250,204,21,0.75)' : 'rgba(34,211,238,0.75)'
              : hasNote ? 'rgba(250,204,21,0.45)' : 'rgba(34,211,238,0.45)';

          return rects.map((r, ri) => (
            <div
              key={`${hl.id}-${ri}`}
              id={ri === 0 ? `highlight-${hl.id}` : undefined}
              className={`pointer-events-none hl-chip${
                isActive && !isMixed
                  ? isFlashing
                    ? ' hl-flash-scale'
                    : ' hl-hover-active'
                  : ''
              }`}
              style={{
                position:   'absolute',
                left:       r.left   - 4,
                top:        r.top    - 2,
                width:      r.width  + 8,
                height:     r.height + 4,
                background: bgColor,
                borderRadius: 4,
                transition: isMixed ? 'none' : 'background-color 0.22s ease, transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.22s ease',
              }}
            />
          ));
        })}
      </div>

      {/* Layer 1: 텍스트 */}
      <div ref={textRootRef} data-message-text-root className="relative z-[1] select-text">
        {isStreamingSkeleton ? (
          <div className="inline-flex items-center gap-1.5">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="sr-only">답변 생성 중</span>
          </div>
        ) : isUser ? (
          <span className="whitespace-pre-wrap block">{msgText}</span>
        ) : (
          <div className={markdownClassName}>
            <ReactMarkdown
              rehypePlugins={markdownRehypePlugins}
              components={markdownComponents}
            >
              {msgText || ''}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* Layer 2: 플로팅 ID 칩 (data-message-body 직접 자식) */}
      {boxes.map(({ hl, rects }) => {
        if (!rects.length) return null;
        const links = hl.links || [];
        if (!links.length) return null;

        const r0 = rects[0];
        const PX = 4, PY = 2;

        const isChipVisible =
          flashingHighlightId === hl.id ||
          hoveredPostItId     === hl.id ||
          localHoveredHlId    === hl.id ||
          promptingChipsHlId  === hl.id;
        const isPulsing = promptingChipsHlId === hl.id;

        const sortedLinks = [...links].sort((a, b) => a.id - b.id);

        return (
          <div
            key={`chips-${hl.id}`}
            style={{
              position:     'absolute',
              left:         r0.left - PX,
              top:          r0.top  - PY - 26,
              display:      'flex',
              flexDirection:'row',
              flexWrap:     'nowrap',
              gap:          '8px',
              alignItems:   'center',
              zIndex:       4,
              opacity:      isChipVisible ? 1 : 0,
              pointerEvents:isChipVisible ? 'auto' : 'none',
              transition:   'opacity 0.15s ease',
            }}
          >
            {sortedLinks.map((link) => {
              const isNote     = link.type === 'note';
              const chipBg     = isNote ? '#facc15' : '#22d3ee';
              const chipText   = isNote ? '#713f12' : '#164e63';
              const chipBorder = isNote ? 'rgba(234,179,8,0.55)' : 'rgba(8,145,178,0.55)';
              return (
                <button
                  key={link.id}
                  style={{
                    flexShrink:     0,
                    display:        'inline-flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    minWidth:       '22px',
                    height:         '22px',
                    padding:        '0 7px',
                    fontSize:       '11px',
                    fontWeight:     700,
                    lineHeight:     1,
                    borderRadius:   '9999px',
                    border:         `1px solid ${chipBorder}`,
                    boxShadow:      '0 1px 4px rgba(0,0,0,0.18)',
                    background:     chipBg,
                    color:          chipText,
                    cursor:         'pointer',
                    whiteSpace:     'nowrap',
                    transition:     'transform 0.15s ease, box-shadow 0.15s ease',
                  }}
                  className={isPulsing ? 'chip-prompt-pulse' : ''}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.2)';
                    e.currentTarget.style.boxShadow = '0 3px 8px rgba(0,0,0,0.25)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.18)';
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); scrollToPostIt(link.id); }}
                >
                  {highlightIndexMap[link.id] ?? '?'}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────── Auth Gate 컴포넌트 ─────────────────── */
function AuthGate({ onLogin }) {
  const [inputUserId, setInputUserId] = useState('');
  const [inputApiKey, setInputApiKey] = useState('');
  const [error,       setError]       = useState('');

  const isValid = inputUserId.trim() !== '' && inputApiKey.trim() !== '';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputUserId.trim() || !inputApiKey.trim()) {
      setError('유효한 API Key를 입력해 주세요.');
      return;
    }
    setError('');
    onLogin(inputUserId.trim(), inputApiKey.trim());
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f1f5f9',
        fontFamily: FONT_STACK_KO,
      }}
    >
      <div style={{
        background: '#ffffff',
        borderRadius: 20,
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 24px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)',
        width: '100%',
        maxWidth: 380,
        margin: '0 24px',
        padding: '40px 36px',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}>

        {/* 타이틀 */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{
            fontSize: 22,
            fontWeight: 700,
            color: '#1e293b',
            letterSpacing: '-0.03em',
            whiteSpace: 'nowrap',
            margin: 0,
          }}>
            비선형 AI 인터페이스
          </h1>
          <p style={{
            fontSize: 13,
            color: '#94a3b8',
            marginTop: 6,
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
          }}>
            실험 세션을 시작하려면 아래 정보를 입력하세요
          </p>
        </div>

        {/* 구분선 */}
        <div style={{ height: 1, background: '#f1f5f9', marginBottom: 24 }} />

        {/* 폼 */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', letterSpacing: '-0.01em' }}>
              User ID
            </label>
            <input
              type="text"
              value={inputUserId}
              onChange={(e) => setInputUserId(e.target.value)}
              placeholder="실험 ID를 입력하세요 (예: user01)"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                color: '#1e293b',
                fontSize: 14,
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'box-shadow 0.15s',
              }}
              onFocus={(e) => { e.target.style.boxShadow = '0 0 0 3px rgba(250,204,21,0.35)'; e.target.style.borderColor = 'transparent'; }}
              onBlur={(e)  => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = '#e2e8f0'; }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#475569', letterSpacing: '-0.01em' }}>
              Gemini API Key
            </label>
            <input
              type="password"
              value={inputApiKey}
              onChange={(e) => setInputApiKey(e.target.value)}
              placeholder="AI API Key를 입력하세요"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                color: '#1e293b',
                fontSize: 14,
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'box-shadow 0.15s',
              }}
              onFocus={(e) => { e.target.style.boxShadow = '0 0 0 3px rgba(250,204,21,0.35)'; e.target.style.borderColor = 'transparent'; }}
              onBlur={(e)  => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = '#e2e8f0'; }}
            />
          </div>

          {/* 유의 문구 */}
          <p style={{
            fontSize: 12.5,
            fontWeight: 500,
            color: '#ef4444',
            textAlign: 'center',
            lineHeight: 1.6,
            wordBreak: 'keep-all',
            margin: '2px 0 0',
          }}>
            실험 중에는 절대 새로고침을 하지 마세요.
            <br />새로고침 시 자동으로 로그아웃됩니다.
          </p>

          {/* 보안 안내 */}
          <p style={{
            fontSize: 11.5,
            color: '#94a3b8',
            textAlign: 'center',
            lineHeight: 1.65,
            wordBreak: 'keep-all',
            margin: '-4px 0 0',
          }}>
            입력하신 API Key는 외부 서버로 전송되지 않으며,
            <br />브라우저 메모리에만 유지되다가 창을 닫으면 파기됩니다.
          </p>

          {/* 에러 */}
          {error && (
            <p style={{
              fontSize: 13,
              color: '#ef4444',
              textAlign: 'center',
              fontWeight: 500,
              margin: '-4px 0 0',
              wordBreak: 'keep-all',
            }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!isValid}
            style={{
              width: '100%',
              padding: '12px 0',
              borderRadius: 12,
              border: 'none',
              background: isValid ? '#facc15' : '#f1f5f9',
              color: isValid ? '#1e293b' : '#94a3b8',
              fontSize: 15,
              fontWeight: 700,
              fontFamily: 'inherit',
              letterSpacing: '-0.01em',
              cursor: isValid ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s, color 0.15s',
              marginTop: 4,
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => { if (isValid) e.target.style.background = '#fbbf24'; }}
            onMouseLeave={(e) => { if (isValid) e.target.style.background = '#facc15'; }}
          >
            시작하기 (Start Experiment)
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─────────────────── 메인 컴포넌트 ─────────────────── */
export default function NonLinearChatInterface() {
  const navigate = useNavigate();

  /* ── 공통 실험 Context (로그인·블록 메타데이터) ── */
  const {
    userId:    ctxUserId,
    apiKey:    ctxApiKey,
    blockIndex: ctxBlockIndex,
    isLoggedIn: ctxIsLoggedIn,
  } = useExperiment();

  /* ── 실험 로그 API (Proposed 전용 이벤트 수집) ── */
  const {
    startAIWait,
    stopAIWait,
    logPromptSubmit,
    logMemoCreate,
    startMemoEdit,
    stopMemoEdit,
    logMemoDelete,
    logMapsToBody,
    logMapsToElement,
    startMemoDragDrop,
    stopMemoDragDrop,
    logParallelWindowCreate,
    logParallelWindowReactivate,
    logParallelWindowDelete,
    logAiAnswerHeightSnapshot,
  } = useExperimentLog();

  /* ── Auth 상태 (내부) ── */
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId,     setUserId]     = useState('');
  const [userApiKey, setUserApiKey] = useState('');

  const handleLogin = useCallback((id, key) => {
    /* userId별 키로 저장된 데이터 로드 */
    const histKey = `${STORAGE_KEY_HISTORY}-${id}`;
    const actKey  = `${STORAGE_KEY_ACTIVE_ID}-${id}`;

    let history;
    const savedHist = localStorage.getItem(histKey);
    if (savedHist) {
      try {
        history = JSON.parse(savedHist).map((c) => ({
          ...c,
          data: { ...c.data, highlights: migrateHighlights(c.data?.highlights) },
        }));
      } catch { /* ignore */ }
    }
    if (!history || history.length === 0) {
      history = [{
        id: 1,
        title: '비선형 상호작용 캔버스',
        data: { messages: initialData.messages, notes: [], sideChats: [], highlights: [] },
      }];
    }

    const savedActiveId = localStorage.getItem(actKey);
    const activeId = savedActiveId ? JSON.parse(savedActiveId) : history[0].id;
    const active   = history.find((c) => c.id === activeId) || history[0];

    /* 모든 상태를 한 번에 설정 (React 18 배치 업데이트) */
    setChatHistory(history);
    setActiveChatId(activeId);
    setMainMessages(active?.data?.messages ?? initialData.messages);
    setNotes((active?.data?.notes ?? []).map((n) => ({
      stored: true, snapping: false, floatX: 0, floatY: 0, ...n,
    })));
    setSideChats(active?.data?.sideChats ?? []);
    setHighlights(migrateHighlights(active?.data?.highlights ?? []));
    setActiveSideChatId(null);

    setUserId(id);
    setUserApiKey(key);
    setIsLoggedIn(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Context 로그인 연동: 공통 로그인 화면을 거쳐 온 경우 자동 초기화 ── */
  useEffect(() => {
    if (ctxIsLoggedIn && ctxUserId && ctxApiKey && !isLoggedIn) {
      handleLogin(ctxUserId, ctxApiKey);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Gemini AI ── */
  const ai = useMemo(() => {
    if (!userApiKey) return null;
    return new GoogleGenAI({ apiKey: userApiKey, httpOptions: { apiVersion: GEMINI_API_VERSION } });
  }, [userApiKey]);

  /* ── 언어 감지: URL 파라미터 → 브라우저 설정 순서 ── */
  const [currentLang] = useState(() => {
    const urlLang = new URLSearchParams(window.location.search).get('lang');
    if (urlLang === 'en' || urlLang === 'ko') return urlLang;
    return navigator.language?.toLowerCase().startsWith('ko') ? 'ko' : 'en';
  });

  /** 현재 언어의 번역 텍스트를 가져오는 헬퍼 */
  const t = useCallback(
    (key) => translations[currentLang]?.[key] ?? translations.ko[key],
    [currentLang]
  );

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('사용 모델:', GEMINI_MODEL);
      console.log('현재 언어:', currentLang);
    }
  }, [currentLang]);

  /* ── 채팅 히스토리 (로그인 시 handleLogin에서 userId별로 로드됨) ── */
  const [chatHistory, setChatHistory] = useState([
    {
      id: 1,
      title: '비선형 상호작용 캔버스',
      data: { messages: initialData.messages, notes: [], sideChats: [], highlights: [] },
    },
  ]);

  const handleDeleteChat = (id, e) => {
    if (e) e.stopPropagation();
    if (window.confirm(t('deleteConfirm'))) {
      setChatHistory((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const handleRenameChat = (id, e) => {
    if (e) e.stopPropagation();
    const current = chatHistory.find((c) => c.id === id);
    const newTitle = window.prompt(t('renamePrompt'), current?.title);
    if (newTitle?.trim()) {
      setChatHistory((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: newTitle.trim() } : c))
      );
    }
  };

  const [activeChatId, setActiveChatId] = useState(1);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const activeChat = chatHistory.find((c) => c.id === activeChatId) || chatHistory[0];

  /* ── 핵심 상태 ── */
  const [mainMessages, setMainMessages] = useState(() => activeChat?.data?.messages ?? initialData.messages);
  const [notes,        setNotes]        = useState(() =>
    (activeChat?.data?.notes ?? []).map((n) => ({
      stored: true, snapping: false, floatX: 0, floatY: 0, ...n,
    }))
  );
  const [sideChats,    setSideChats]    = useState(() => activeChat?.data?.sideChats ?? []);
  const [highlights,   setHighlights]   = useState(() =>
    migrateHighlights(activeChat?.data?.highlights ?? [])
  );

  /* ── UI 상태 ── */
  const [mainInput,          setMainInput]          = useState('');
  const [isMainLoading,      setIsMainLoading]      = useState(false);
  const [streamingAiMsgId,   setStreamingAiMsgId]   = useState(null);
  const [loadingSideChatIds, setLoadingSideChatIds] = useState(new Set());
  const [loadingNoteIds,     setLoadingNoteIds]     = useState(new Set());

  /* 하이라이트 강조 상태 */
  const [flashingId,        setFlashingId]        = useState(null); // 포스트잇 강조
  const [flashingHighlightId, setFlashingHighlightId] = useState(null); // 하이라이트 강조
  const [hoveredHighlightId,  setHoveredHighlightId]  = useState(null); // 텍스트 hover → 포스트잇 강조
  const [hoveredPostItId,     setHoveredPostItId]     = useState(null); // 포스트잇 hover → 하이라이트 강조 (= highlight.id)

  /* 포스트잇 / 탭 로컬 hover (팝업 효과용) */
  const [hoveredNoteId, setHoveredNoteId] = useState(null);
  const [hoveredTabId,  setHoveredTabId]  = useState(null);

  /* 선택 메뉴 */
  const [selectionMenu, setSelectionMenu] = useState({
    visible: false, text: '', x: 0, y: 0, originY: 0,
    messageId: null, startOffset: 0, endOffset: 0,
    parentChatId: null, sideMessageId: null,
  });

  /* 삭제 확인 다이얼로그 */
  const [confirmDialog, setConfirmDialog] = useState({ visible: false, type: null, id: null });

  /* 드래그 (메모는 고정 크기 유지로 리사이즈 없음) */
  const [dragInfo,   setDragInfo]   = useState(null);
  /* 수납 구역 자석 Highlight */
  const [isSnapZoneHighlighted, setIsSnapZoneHighlighted] = useState(false);

  /* 우측 패널: 활성 스레드 ID (null = 첫 번째 자동 선택) */
  const [activeSideChatId, setActiveSideChatId] = useState(null);

  /* ── 패널 리사이즈 state ── */
  const [rightPanelW, setRightPanelW] = useState(LAYOUT.RIGHT_PANEL_W);

  /* ── 목차 헤더 드래그 → 우측 패널 너비 조정 ──
   * TOC 헤더를 왼쪽으로 드래그 → 우측 패널 넓어짐 / 중앙 채팅창 좁아짐
   * TOC 헤더를 오른쪽으로 드래그 → 우측 패널 좁아짐 / 중앙 채팅창 넓어짐
   * min: LAYOUT.RIGHT_PANEL_MIN_W(280px) ─────────────────────────────────── */
  const tocDragRef = useRef({ dragging: false, startX: 0, startW: 0 });
  const [isTocDragging, setIsTocDragging] = useState(false);

  const handleTocHeaderMouseDown = useCallback((e) => {
    e.preventDefault();
    tocDragRef.current = { dragging: true, startX: e.clientX, startW: rightPanelW };
    setIsTocDragging(true);

    const onMouseMove = (e) => {
      if (!tocDragRef.current.dragging) return;
      const dx = e.clientX - tocDragRef.current.startX;
      // 왼쪽으로 드래그(dx < 0) → 우측 패널 넓어짐
      const nextW = Math.max(LAYOUT.RIGHT_PANEL_MIN_W, tocDragRef.current.startW - dx);
      requestAnimationFrame(() => setRightPanelW(nextW));
    };

    const onMouseUp = () => {
      tocDragRef.current.dragging = false;
      setIsTocDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
  }, []); // startW는 마우스다운 시 ref에 복사하므로 rightPanelW 클로저 불필요

  /* ── Refs ── */
  const postItRefs      = useRef({});
  const dragMoved       = useRef(false);
  const leftPanelRef    = useRef(null); // 수납 구역(좌측 패널) 외곽 래퍼
  const leftRef         = useRef(null);
  const centerRef          = useRef(null);
  const centerScrollRef    = useRef(null);
  const sideChatBottomRef  = useRef(null);
  const sideScrollRef      = useRef(null);
  const mainBottomRef      = useRef(null);
  const streamingAiMsgRef  = useRef(null);
  const sidebarRef      = useRef(null);

  /* 세로 목차 활성 탭 돌출 바 위치 */
  const [protrBarInfo, setProtrBarInfo] = useState(null);

  /* ── Markdown 플러그인 (메모화) ── */
  const markdownRehypePlugins = useMemo(() => [rehypeRaw], []);
  const markdownComponents    = useMemo(() => ({}), []);

  /* ── 계층 트리: sideChats → depth 부여 DFS 정렬 ── */
  const orderedTree = useMemo(() => {
    const childrenMap = {};
    sideChats.forEach((c) => { childrenMap[c.id] = []; });
    const roots = [];
    sideChats.forEach((c) => {
      if (c.parentId && childrenMap[c.parentId]) {
        childrenMap[c.parentId].push(c);
      } else {
        roots.push(c);
      }
    });
    const result = [];
    const visit = (chat, depth) => {
      result.push({ ...chat, depth });
      (childrenMap[chat.id] || []).forEach((child) => visit(child, depth + 1));
    };
    roots.forEach((c) => visit(c, 0));
    return result;
  }, [sideChats]);

  /* ── 트리 레이블: chat.id → "1" | "1-1" | "1-1-2" … ── */
  const treeLabelMap = useMemo(() => {
    const map = {};
    const counters = {};
    orderedTree.forEach((node) => {
      const key = node.parentId ?? '__root__';
      counters[key] = (counters[key] ?? 0) + 1;
      const parentLabel = node.parentId ? (map[node.parentId] ?? '') : '';
      map[node.id] = parentLabel ? `${parentLabel}-${counters[key]}` : String(counters[key]);
    });
    return map;
  }, [orderedTree]);

  /* ── highlightIndexMap: link.id → 배지 레이블
       메모: 생성 순 번호 "1","2"…  추가질문: treeLabelMap 계층 레이블 "1","1-1","1-2"… ── */
  const highlightIndexMap = useMemo(() => {
    const map = {};
    let noteIdx = 1;
    highlights.forEach((h) => {
      (h.links || []).forEach((link) => {
        if (link.id in map) return;
        if (link.type === 'note') {
          map[link.id] = String(noteIdx++);
        } else {
          map[link.id] = treeLabelMap[link.id] ?? '?';
        }
      });
    });
    return map;
  }, [highlights, treeLabelMap]);

  const centerTitle      = activeChat?.title?.trim() ? activeChat.title : t('chatFallbackTitle');

  /* 우측 패널: 활성 스레드 (null이면 첫 번째) */
  const activeThreadId = activeSideChatId ?? sideChats[0]?.id ?? null;
  const activeThread   = sideChats.find((c) => c.id === activeThreadId) ?? null;

  /* ── AI 답변 높이 측정 헬퍼 ── */
  const measureAiAnswerHeight = useCallback((containerEl) => {
    if (!containerEl) return { answerHeightPx: 0, answerCount: 0 };
    const aiRows = containerEl.querySelectorAll('[data-msg-role="ai"]');
    return {
      answerHeightPx: Array.from(aiRows).reduce((sum, el) => sum + el.offsetHeight, 0),
      answerCount:    aiRows.length,
    };
  }, []);

  /* ── 병렬창 전환 시 이전 창 AI 답변 높이 스냅샷 ── */
  const prevActiveThreadIdRef = useRef(null);
  useEffect(() => {
    const prevId = prevActiveThreadIdRef.current;
    if (prevId !== null && prevId !== activeThreadId && sideScrollRef.current) {
      const { answerHeightPx, answerCount } = measureAiAnswerHeight(sideScrollRef.current);
      logAiAnswerHeightSnapshot({
        trigger:        'parallel_window_switch',
        section:        `parallel_window_${prevId}`,
        answerHeightPx,
        answerCount,
      });
    }
    prevActiveThreadIdRef.current = activeThreadId;
  }, [activeThreadId, measureAiAnswerHeight, logAiAnswerHeightSnapshot]);

  /* ── 블록 종료 직전 메인 + 현재 활성 병렬창 AI 답변 높이 스냅샷 ── */
  const saveAiAnswerHeights = useCallback(() => {
    /* 메인 대화창 */
    if (centerScrollRef.current) {
      const { answerHeightPx, answerCount } = measureAiAnswerHeight(centerScrollRef.current);
      logAiAnswerHeightSnapshot({
        trigger:        'block_end',
        section:        'main_canvas',
        answerHeightPx,
        answerCount,
      });
    }
    /* 현재 활성 병렬창 */
    if (activeThreadId && sideScrollRef.current) {
      const { answerHeightPx, answerCount } = measureAiAnswerHeight(sideScrollRef.current);
      logAiAnswerHeightSnapshot({
        trigger:        'block_end',
        section:        `parallel_window_${activeThreadId}`,
        answerHeightPx,
        answerCount,
      });
    }
  }, [activeThreadId, measureAiAnswerHeight, logAiAnswerHeightSnapshot]);

  /* ── 세로 목차 돌출 바 위치 동기화 ── */
  useEffect(() => {
    if (!activeThreadId || !sidebarRef.current) { setProtrBarInfo(null); return; }
    const tabEl = sidebarRef.current.querySelector(`[data-tab-id="${activeThreadId}"]`);
    if (!tabEl) { setProtrBarInfo(null); return; }
    const tr = tabEl.getBoundingClientRect();
    const sr = sidebarRef.current.getBoundingClientRect();
    setProtrBarInfo({ sidebarLeft: sr.left, top: tr.top, height: tr.height });
  }, [activeThreadId, orderedTree, rightPanelW]);

  /* ── 채팅 히스토리 동기화 ── */
  useEffect(() => {
    setChatHistory((prev) =>
      prev.map((chat) =>
        chat.id === activeChatId
          ? { ...chat, data: { messages: mainMessages, notes, sideChats, highlights } }
          : chat
      )
    );
  }, [activeChatId, mainMessages, notes, sideChats, highlights]);

  useEffect(() => {
    if (!userId) return;
    localStorage.setItem(`${STORAGE_KEY_HISTORY}-${userId}`,   JSON.stringify(chatHistory));
    localStorage.setItem(`${STORAGE_KEY_ACTIVE_ID}-${userId}`, JSON.stringify(activeChatId));
  }, [userId, activeChatId, chatHistory]);

  /* ── 새 채팅 / 채팅 불러오기 ── */
  const handleNewChat = () => {
    const newId = Date.now();
    const chat = {
      id: newId,
      title: t('newChatTitle'),
      data: {
        messages: [{ id: 1, sender: 'ai', text: t('newChatInitMsg') }],
        notes: [], sideChats: [], highlights: [],
      },
    };
    setChatHistory((prev) => [chat, ...prev]);
    setActiveChatId(newId);
    setMainMessages(chat.data.messages);
    setNotes([]);
    setSideChats([]);
    setHighlights([]);
    setActiveSideChatId(null);
  };

  const loadChat = (id) => {
    if (id === activeChatId) return;
    const c = chatHistory.find((c) => c.id === id);
    if (!c) return;
    setActiveChatId(id);
    setMainMessages(c.data.messages);
    setNotes(c.data.notes);
    setSideChats(c.data.sideChats);
    setHighlights(migrateHighlights(c.data.highlights));
    setActiveSideChatId(null);
  };

  /* ── 스크롤: 최초 마운트만 기존 메시지 맨 아래로 ── */
  useEffect(() => {
    if (mainMessages.length === 0) return;
    mainBottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── 스크롤: AI 응답 시작 시 해당 메시지 상단으로 이동 ── */
  useEffect(() => {
    if (!streamingAiMsgId) return;
    requestAnimationFrame(() => {
      streamingAiMsgRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [streamingAiMsgId]);

  /* 우측 패널 스크롤 자동 (활성 스레드 변경 or 메시지 추가) */
  useEffect(() => {
    requestAnimationFrame(() => {
      sideChatBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  }, [activeThreadId, activeThread?.messages?.length]);

  /* ── 포스트잇(노트) / 사이드챗 스레드 포커스 ── */
  const scrollToPostIt = useCallback((id) => {
    // 사이드챗이면 우측 패널에서 해당 스레드 활성화
    if (sideChats.some((c) => c.id === id)) {
      const windowLabel = treeLabelMap[id] ?? String(id);
      /* 이미 활성화된 창이면 재활성화, 처음이면 최초 이동(MAPS_TO_ELEMENT) */
      if (id === activeSideChatId) {
        logParallelWindowReactivate({ windowId: `parallel_window_${windowLabel}` });
      } else {
        logMapsToElement({ targetType: 'parallel_window', targetId: `parallel_window_${windowLabel}` });
      }
      setActiveSideChatId(id);
      setFlashingId(id);
      setTimeout(() => setFlashingId(null), 1500);
      return;
    }
    // 노트는 기존 방식대로 스크롤
    logMapsToElement({ targetType: 'memo', targetId: String(id) });
    const el = postItRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setFlashingId(id);
      setTimeout(() => setFlashingId(null), 1500);
    }
  }, [sideChats, activeSideChatId, treeLabelMap, logMapsToElement, logParallelWindowReactivate]);

  const scrollToHighlight = useCallback(
    (postitId) => {
      const hl = highlights.find((h) => h.links?.some((l) => l.id === postitId));
      if (!hl) return;
      /* 어느 타입의 요소에서 본문으로 이동했는지 판별 */
      const link = hl.links?.find((l) => l.id === postitId);
      const sourceType = link?.type === 'chat' ? 'parallel_window' : 'memo';
      const windowLabel = sourceType === 'parallel_window'
        ? `parallel_window_${treeLabelMap[postitId] ?? String(postitId)}`
        : String(postitId);
      logMapsToBody({ sourceType, sourceId: windowLabel });
      const el = document.getElementById(`highlight-${hl.id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setFlashingHighlightId(hl.id);
      setTimeout(() => setFlashingHighlightId(null), 3100);
    },
    [highlights, treeLabelMap, logMapsToBody]
  );

  const handlePostItClick = (e, id) => {
    if (dragMoved.current) return;
    const tag = e.target.tagName.toLowerCase();
    const isInput = tag === 'textarea' || tag === 'input' || tag === 'button' || e.target.closest('button');
    if (!isInput) scrollToHighlight(id);
  };

  /* ── 사이드챗 텍스트 선택 메뉴 (data-message-text-root 기준, 오프셋 계산) ── */
  const handleMouseUpSide = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setSelectionMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      return;
    }
    const range       = selection.getRangeAt(0);
    const exactText   = range.toString();
    const trimmedText = exactText.trim();
    if (!trimmedText) {
      setSelectionMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      return;
    }
    const ancestor = range.commonAncestorContainer;
    const node     = ancestor.nodeType === Node.TEXT_NODE ? ancestor.parentElement : ancestor;
    const textRoot = node?.closest('[data-message-text-root]');
    if (!textRoot) {
      setSelectionMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      return;
    }
    const messageRow = textRoot.closest('[data-side-message-id]');
    if (!messageRow) {
      setSelectionMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      return;
    }
    const sideMessageId  = Number(messageRow.getAttribute('data-side-message-id'));
    const leadingSpaces  = exactText.length - exactText.trimStart().length;
    const startRaw       = countVisibleCharsUpTo(textRoot, range.startContainer, range.startOffset);
    const startOffset    = startRaw + leadingSpaces;
    const endOffset      = startOffset + trimmedText.length;
    const rect = range.getBoundingClientRect();
    setSelectionMenu({
      visible: true, text: trimmedText,
      x: rect.left + rect.width / 2, y: rect.top - 10, originY: rect.top,
      messageId: null, startOffset, endOffset,
      parentChatId: activeThreadId, sideMessageId,
    });
  };

  /* ── 텍스트 선택 메뉴 (오프셋: data-message-text-root 기준) ── */
  const handleMouseUpCenter = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setSelectionMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      return;
    }

    const range        = selection.getRangeAt(0);
    const exactText    = range.toString();
    const trimmedText  = exactText.trim();

    if (!trimmedText) {
      setSelectionMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      return;
    }

    const ancestor = range.commonAncestorContainer;
    const node     = ancestor.nodeType === Node.TEXT_NODE ? ancestor.parentElement : ancestor;
    const textRoot = node?.closest('[data-message-text-root]');

    if (!textRoot || !centerRef.current?.contains(textRoot)) {
      setSelectionMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      return;
    }

    const messageRow = textRoot.closest('[data-message-id]');
    if (!messageRow) {
      setSelectionMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      return;
    }

    const messageId     = Number(messageRow.getAttribute('data-message-id'));
    const leadingSpaces = exactText.length - exactText.trimStart().length;
    // ★ countVisibleCharsUpTo: walkTextNodes 기반으로 블록 요소 \n 없이 카운팅
    const startRaw    = countVisibleCharsUpTo(textRoot, range.startContainer, range.startOffset);
    const startOffset = startRaw + leadingSpaces;
    const endOffset   = startOffset + trimmedText.length;

    const rect = range.getBoundingClientRect();
    setSelectionMenu({
      visible: true, text: trimmedText,
      x: rect.left + rect.width / 2, y: rect.top - 10, originY: rect.top,
      messageId, startOffset, endOffset,
      parentChatId: null,
      sideMessageId: null,
    });
  };

  /* ── 포스트잇 생성 (다중 연결 merge 로직) ── */
  const handleCreateNote = () => {
    const yPos     = Math.max(24, selectionMenu.originY - 24);
    const now      = Date.now();
    const xPos = leftRef.current
      ? leftRef.current.clientWidth - NOTE_CARD_W - 24
      : 24;

    const newNote = {
      id: now,
      text: selectionMenu.text,
      title: truncateTitle(selectionMenu.text),
      isCollapsed: false,
      stored: true,
      snapping: false,
      floatX: 0,
      floatY: 0,
      x: xPos, y: yPos,
      width: NOTE_CARD_W,
      height: NOTE_CARD_H,
    };
    setNotes((prev) => [...prev, newNote]);
    logMemoCreate({ memoId: String(now), sourceText: selectionMenu.text });

    // 사이드챗 선택 여부에 따라 messageId / sideChatId 결정
    const isSideSel   = selectionMenu.sideMessageId !== null;
    const hlMessageId = isSideSel ? selectionMenu.sideMessageId : selectionMenu.messageId;
    const hlSideChatId = isSideSel ? selectionMenu.parentChatId : null;

    // 같은 구간 하이라이트에 link 추가, 없으면 새로 생성
    const existingHl =
      highlights.find(
        (h) =>
          (isSideSel ? h.sideChatId === hlSideChatId : !h.sideChatId) &&
          h.messageId   === hlMessageId &&
          h.startOffset === selectionMenu.startOffset &&
          h.endOffset   === selectionMenu.endOffset
      ) ||
      highlights.find(
        (h) =>
          (isSideSel ? h.sideChatId === hlSideChatId : !h.sideChatId) &&
          h.messageId === hlMessageId &&
          h.text      === selectionMenu.text
      );

    if (existingHl) {
      setHighlights((prev) =>
        prev.map((h) =>
          h.id === existingHl.id
            ? { ...h, links: [...(h.links || []), { id: now, type: 'note' }] }
            : h
        )
      );
    } else {
      setHighlights((prev) => [
        ...prev,
        {
          id: now,
          messageId:   hlMessageId,
          ...(hlSideChatId ? { sideChatId: hlSideChatId } : {}),
          startOffset: selectionMenu.startOffset,
          endOffset:   selectionMenu.endOffset,
          text:        selectionMenu.text,
          links:       [{ id: now, type: 'note' }],
        },
      ]);
    }

    setSelectionMenu({ visible: false, text: '', x: 0, y: 0, originY: 0, messageId: null, startOffset: 0, endOffset: 0, parentChatId: null, sideMessageId: null });
    window.getSelection()?.removeAllRanges();
  };

  const handleCreateSideChat = () => {
    const now = Date.now();
    const parentChatId = selectionMenu.parentChatId ?? null;
    const parentDepth  = parentChatId
      ? (orderedTree.find((c) => c.id === parentChatId)?.depth ?? 0)
      : -1;
    const newDepth = parentDepth + 1;

    /* 꼬리질문 ID: 부모 레이블 없으면 루트 카운터, 있으면 "부모레이블-n" */
    const siblingCount = sideChats.filter((c) => c.parentId === parentChatId).length + 1;
    const parentLabel  = parentChatId ? (treeLabelMap[parentChatId] ?? '') : '';
    const newWindowId  = parentLabel ? `${parentLabel}-${siblingCount}` : String(siblingCount);

    const newChat = {
      id: now,
      parentId: parentChatId,
      depth: newDepth,
      sourceText: selectionMenu.text,
      title: truncateTitle(selectionMenu.text),
      messages: [{ id: 1, sender: 'ai', text: t('sideChatInitMsg')(selectionMenu.text) }],
      input: '',
    };
    setSideChats((prev) => [...prev, newChat]);
    setActiveSideChatId(now);
    logParallelWindowCreate({ windowId: newWindowId, depth: newDepth });

    // 사이드챗 선택 여부에 따라 messageId / sideChatId 결정
    const isSideSel    = selectionMenu.sideMessageId !== null;
    const hlMessageId  = isSideSel ? selectionMenu.sideMessageId : selectionMenu.messageId;
    const hlSideChatId = isSideSel ? selectionMenu.parentChatId : null;

    const existingHl =
      highlights.find(
        (h) =>
          (isSideSel ? h.sideChatId === hlSideChatId : !h.sideChatId) &&
          h.messageId   === hlMessageId &&
          h.startOffset === selectionMenu.startOffset &&
          h.endOffset   === selectionMenu.endOffset
      ) ||
      highlights.find(
        (h) =>
          (isSideSel ? h.sideChatId === hlSideChatId : !h.sideChatId) &&
          h.messageId === hlMessageId &&
          h.text      === selectionMenu.text
      );

    if (existingHl) {
      setHighlights((prev) =>
        prev.map((h) =>
          h.id === existingHl.id
            ? { ...h, links: [...(h.links || []), { id: now, type: 'chat' }] }
            : h
        )
      );
    } else {
      setHighlights((prev) => [
        ...prev,
        {
          id: now,
          messageId:   hlMessageId,
          ...(hlSideChatId ? { sideChatId: hlSideChatId } : {}),
          startOffset: selectionMenu.startOffset,
          endOffset:   selectionMenu.endOffset,
          text:        selectionMenu.text,
          links:       [{ id: now, type: 'chat' }],
        },
      ]);
    }

    setSelectionMenu({ visible: false, text: '', x: 0, y: 0, originY: 0, messageId: null, startOffset: 0, endOffset: 0, parentChatId: null, sideMessageId: null });
    window.getSelection()?.removeAllRanges();
  };

  /* ── 삭제 확인 다이얼로그 ── */
  const askConfirmDelete = (type, id) => setConfirmDialog({ visible: true, type, id });
  const handleCancelDelete = () => setConfirmDialog({ visible: false, type: null, id: null });
  const handleConfirmDelete = () => {
    const { type, id } = confirmDialog;
    setConfirmDialog({ visible: false, type: null, id: null });
    if (type === 'note')       removeNote(id);
    else if (type === 'chat')  removeSideChat(id);
  };

  /* ── 포스트잇 삭제 (link 제거 → highlights 고아 정리) ── */
  const removeNote = (noteId) => {
    logMemoDelete({ memoId: String(noteId) });
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    setHighlights((prev) =>
      prev
        .map((h) => ({ ...h, links: (h.links || []).filter((l) => l.id !== noteId) }))
        .filter((h) => (h.links || []).length > 0)
    );
  };

  const removeSideChat = (chatId) => {
    const windowLabel = treeLabelMap[chatId] ?? String(chatId);
    logParallelWindowDelete({ windowId: `parallel_window_${windowLabel}` });
    setSideChats((prev) => prev.filter((c) => c.id !== chatId));
    setActiveSideChatId((cur) => (cur === chatId ? null : cur));
    setHighlights((prev) =>
      prev
        .map((h) => ({ ...h, links: (h.links || []).filter((l) => l.id !== chatId) }))
        .filter((h) => (h.links || []).length > 0)
    );
  };

  /* ── 포스트잇 기타 조작 ── */
  const toggleNoteCollapse    = (id) => setNotes((prev) => prev.map((n) => n.id === id ? { ...n, isCollapsed: !n.isCollapsed } : n));
  const handleNoteTitleChange = (id, v) => setNotes((prev) => prev.map((n) => n.id === id ? { ...n, title: v } : n));
  // 메모 본문 편집 (textarea)
  const handleNoteChange      = (id, v) => setNotes((prev) => prev.map((n) => n.id === id ? { ...n, text: v } : n));

  const handleSideChatTitleChange = (id, v) => setSideChats((prev) => prev.map((c) => c.id === id ? { ...c, title: v } : c));
  const updateSideChatInput       = (id, v) => setSideChats((prev) => prev.map((c) => c.id === id ? { ...c, input: v } : c));

  /* ── 메인 채팅 제출 (스트리밍) ── */
  const ensureSessionTitle = (text) => {
    const cur = chatHistory.find((c) => c.id === activeChatId);
    if (!cur || cur.title !== t('newChatTitle')) return;
    setChatHistory((prev) =>
      prev.map((c) => (c.id === activeChatId ? { ...c, title: truncateTitle(text, 22) } : c))
    );
  };

  const handleMainSubmit = async (e) => {
    e.preventDefault();
    if (isMainLoading) return;
    const text = mainInput.trim();
    if (!text) return;

    logPromptSubmit({ location: 'main', targetWindowId: 'main_window' });

    const userMsg = { id: Date.now(), sender: 'user', text };
    setMainMessages((prev) => [...prev, userMsg]);
    ensureSessionTitle(text);
    setMainInput('');

    const aiMsgId = Date.now() + 1;
    setStreamingAiMsgId(aiMsgId);
    setIsMainLoading(true);
    setMainMessages((prev) => [...prev, { id: aiMsgId, sender: 'ai', text: '' }]);
    startAIWait();

    try {
      if (!ai) throw new Error('API 키 없음');
      const sysInstr = translations[currentLang].systemInstruction;
      const sysAck   = translations[currentLang].sideChatAck;
      const stream = await ai.models.generateContentStream({
        model: GEMINI_MODEL,
        contents: [
          { role: 'user',  parts: [{ text: sysInstr }] },
          { role: 'model', parts: [{ text: sysAck }] },
          { role: 'user',  parts: [{ text }] },
        ],
      });
      let full = '';
      for await (const chunk of stream) {
        full += chunk.text ?? '';
        setMainMessages((prev) =>
          prev.map((m) => (m.id === aiMsgId ? { ...m, text: full } : m))
        );
      }
    } catch (err) {
      setMainMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId ? { ...m, text: translations[currentLang].errorMsg } : m
        )
      );
    } finally {
      stopAIWait();
      setIsMainLoading(false);
      setStreamingAiMsgId(null);
    }
  };

  /* ── 사이드챗 AI 제출 (스트리밍) ── */
  const handleSideSubmit = async (chatId, e) => {
    e.preventDefault();
    const chat = sideChats.find((c) => c.id === chatId);
    if (!chat || !chat.input?.trim() || loadingSideChatIds.has(chatId)) return;

    const windowLabel = treeLabelMap[chatId] ?? String(chatId);
    logPromptSubmit({
      location:       'parallel',
      targetWindowId: `parallel_window_${windowLabel}`,
    });

    const text = chat.input.trim();
    const userMsg = { id: Date.now(), sender: 'user', text };
    setSideChats((prev) =>
      prev.map((c) => c.id === chatId ? { ...c, messages: [...c.messages, userMsg], input: '' } : c)
    );

    if (!ai) return;

    const aiMsgId = Date.now() + 1;
    setLoadingSideChatIds((prev) => new Set([...prev, chatId]));
    setSideChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? { ...c, messages: [...c.messages, { id: aiMsgId, sender: 'ai', text: '' }] }
          : c
      )
    );
    startAIWait();

    try {
      const tr = translations[currentLang];
      const mainCtx = mainMessages
        .map((m) => `${m.sender === 'user' ? tr.aiUser : tr.aiAI}: ${m.text}`)
        .join('\n');
      const systemInstruction =
        `${tr.sideChatSystemBase}\n\n${tr.sideChatContextPrefix(mainCtx)}`;

      // v1 API는 config.systemInstruction 미지원 → history 맨 앞 user/model 쌍으로 삽입
      const allHistory = (chat.messages || [])
        .filter((m) => !(m.sender === 'ai' && m.text === ''))
        .map((m) => ({ role: m.sender === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));
      const firstUserIdx = allHistory.findIndex((m) => m.role === 'user');
      const conversationHistory = firstUserIdx >= 0 ? allHistory.slice(firstUserIdx) : [];

      const fullHistory = [
        { role: 'user',  parts: [{ text: systemInstruction }] },
        { role: 'model', parts: [{ text: tr.sideChatAck }] },
        ...conversationHistory,
      ];

      const chatSession = ai.chats.create({
        model: GEMINI_MODEL,
        history: fullHistory,
      });
      const stream = await chatSession.sendMessageStream({ message: text });
      let full = '';
      for await (const chunk of stream) {
        full += chunk.text ?? '';
        setSideChats((prev) =>
          prev.map((c) =>
            c.id === chatId
              ? { ...c, messages: c.messages.map((m) => m.id === aiMsgId ? { ...m, text: full } : m) }
              : c
          )
        );
      }
    } catch (err) {
      setSideChats((prev) =>
        prev.map((c) =>
          c.id === chatId
            ? { ...c, messages: c.messages.map((m) => m.id === aiMsgId ? { ...m, text: translations[currentLang].sideChatErrorMsg } : m) }
            : c
        )
      );
    } finally {
      stopAIWait();
      setLoadingSideChatIds((prev) => { const s = new Set(prev); s.delete(chatId); return s; });
    }
  };

  /* ── 노트 AI 제출 (스트리밍) ── */
  const handleNoteSubmit = async (noteId, e) => {
    e.preventDefault();
    const note = notes.find((n) => n.id === noteId);
    if (!note || !note.input?.trim() || loadingNoteIds.has(noteId)) return;

    const text = note.input.trim();
    const userMsg = { id: Date.now(), sender: 'user', text };
    setNotes((prev) =>
      prev.map((n) => n.id === noteId ? { ...n, messages: [...(n.messages || []), userMsg], input: '' } : n)
    );

    if (!ai) return;

    const aiMsgId = Date.now() + 1;
    setLoadingNoteIds((prev) => new Set([...prev, noteId]));
    setNotes((prev) =>
      prev.map((n) =>
        n.id === noteId
          ? { ...n, messages: [...(n.messages || []), { id: aiMsgId, sender: 'ai', text: '' }] }
          : n
      )
    );

    try {
      const tr = translations[currentLang];
      const mainCtx = mainMessages
        .map((m) => `${m.sender === 'user' ? tr.aiUser : tr.aiAI}: ${m.text}`)
        .join('\n');
      const sysInstr = tr.noteSystemInstruction(mainCtx);

      const rawHistory = (note.messages || [])
        .filter((m) => !(m.sender === 'ai' && m.text === ''))
        .map((m) => ({ role: m.sender === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));
      rawHistory.push({ role: 'user', parts: [{ text }] });

      // v1 API: 시스템 지침을 history 맨 앞 user/model 쌍으로 삽입
      const contents = [
        { role: 'user',  parts: [{ text: sysInstr }] },
        { role: 'model', parts: [{ text: tr.sideChatAck }] },
        ...rawHistory,
      ];

      const noteStream = await ai.models.generateContentStream({
        model: GEMINI_MODEL, contents,
      });
      let full = '';
      for await (const chunk of noteStream) {
        full += chunk.text ?? '';
        setNotes((prev) =>
          prev.map((n) =>
            n.id === noteId
              ? { ...n, messages: (n.messages || []).map((m) => m.id === aiMsgId ? { ...m, text: full } : m) }
              : n
          )
        );
      }
    } catch (err) {
      setNotes((prev) =>
        prev.map((n) =>
          n.id === noteId
            ? { ...n, messages: (n.messages || []).map((m) => m.id === aiMsgId ? { ...m, text: translations[currentLang].sideChatErrorMsg } : m) }
            : n
        )
      );
    } finally {
      setLoadingNoteIds((prev) => { const s = new Set(prev); s.delete(noteId); return s; });
    }
  };

  /* ── 드래그 / 리사이즈 ── */
  const startDrag = (e, id, type, itemX, itemY) => {
    e.preventDefault();
    dragMoved.current = false;
    if (type === 'note') startMemoDragDrop(String(id));

    if (type === 'note') {
      const note = notes.find((n) => n.id === id);
      if (note?.stored && !note?.snapping) {
        // 수납된 메모 → 뷰포트 좌표를 DOM에서 직접 읽어 floating 전환
        const el = postItRefs.current[id];
        const rect = el?.getBoundingClientRect();
        if (rect) {
          const startX = rect.left;
          const startY = rect.top;
          setNotes((prev) =>
            prev.map((n) =>
              n.id === id ? { ...n, stored: false, snapping: false, floatX: startX, floatY: startY } : n
            )
          );
          setDragInfo({ type, id, startX, startY, mouseX: e.clientX, mouseY: e.clientY });
          return;
        }
      }
      // 이미 floating 상태
      const fx = note?.floatX ?? itemX ?? 0;
      const fy = note?.floatY ?? itemY ?? 0;
      setDragInfo({ type, id, startX: fx, startY: fy, mouseX: e.clientX, mouseY: e.clientY });
      return;
    }

    setDragInfo({ type, id, startX: itemX, startY: itemY, mouseX: e.clientX, mouseY: e.clientY });
  };

  useEffect(() => {
    /* ── 수납 슬롯 viewport 좌표 계산 헬퍼 ── */
    const computeSnapSlot = (excludeId) => {
      const panelRect = leftPanelRef.current?.getBoundingClientRect();
      if (!panelRect) return null;
      const storedOthers = notes.filter((n) => n.stored && n.id !== excludeId);
      let slotY = panelRect.top + NOTE_STACK_PAD;
      storedOthers.forEach((n) => {
        slotY += (n.isCollapsed ? 44 : NOTE_CARD_H) + NOTE_STACK_GAP;
      });
      return {
        x: panelRect.left + (panelRect.width - NOTE_CARD_W) / 2,
        y: slotY,
        panelRect,
      };
    };

    const onMove = (e) => {
      if (dragInfo) {
        dragMoved.current = true;
        const dx   = e.clientX - dragInfo.mouseX;
        const dy   = e.clientY - dragInfo.mouseY;
        const newX = dragInfo.startX + dx;
        const newY = dragInfo.startY + dy;

        if (dragInfo.type === 'note') {
          const panelEl = leftPanelRef.current;
          if (panelEl) {
            const panelRect = panelEl.getBoundingClientRect();
            const note      = notes.find((n) => n.id === dragInfo.id);
            const noteH     = note?.isCollapsed ? 44 : NOTE_CARD_H;
            const overlapW  = Math.max(0, Math.min(panelRect.right,  newX + NOTE_CARD_W) - Math.max(panelRect.left, newX));
            const overlapH  = Math.max(0, Math.min(panelRect.bottom, newY + noteH)        - Math.max(panelRect.top,  newY));
            const overlapRatio = (NOTE_CARD_W * noteH) > 0 ? (overlapW * overlapH) / (NOTE_CARD_W * noteH) : 0;

            // 60% 이상일 때만 수납 "예고" (실제 스냅은 mouseup 시)
            setIsSnapZoneHighlighted(overlapRatio >= NOTE_SNAP_THRESHOLD);
          }

          /* 드래그 중에는 항상 플로팅(포털) 상태로 따라다니게 위치만 갱신 */
          setNotes((prev) =>
            prev.map((n) => n.id === dragInfo.id ? { ...n, floatX: newX, floatY: newY } : n)
          );
        }
      }
    };

    const onUp = () => {
      if (dragInfo?.type === 'note') {
        stopMemoDragDrop(String(dragInfo.id));
        const nid       = dragInfo.id;
        const noteState = notes.find((n) => n.id === nid);
        const panelEl   = leftPanelRef.current;

        if (noteState && !noteState.stored && panelEl && !noteState.snapping) {
          const panelRect = panelEl.getBoundingClientRect();
          const noteH     = noteState.isCollapsed ? 44 : NOTE_CARD_H;
          const nL        = noteState.floatX ?? 0;
          const nT        = noteState.floatY ?? 0;
          const overlapW = Math.max(0, Math.min(panelRect.right,  nL + NOTE_CARD_W) - Math.max(panelRect.left, nL));
          const overlapH = Math.max(0, Math.min(panelRect.bottom, nT + noteH)        - Math.max(panelRect.top,  nT));
          const overlapRatio = (NOTE_CARD_W * noteH) > 0 ? (overlapW * overlapH) / (NOTE_CARD_W * noteH) : 0;

          if (overlapRatio >= NOTE_SNAP_THRESHOLD) {
            const slot = computeSnapSlot(nid);
            if (slot) {
              setIsSnapZoneHighlighted(false);
              setNotes((prev) =>
                prev.map((n) => n.id === nid ? { ...n, snapping: true, floatX: slot.x, floatY: slot.y } : n)
              );
              setDragInfo(null);
              setTimeout(() => { dragMoved.current = false; }, 50);
              return;
            }
          }
        }
      }

      setIsSnapZoneHighlighted(false);
      setDragInfo(null);
      setTimeout(() => { dragMoved.current = false; }, 50);
    };

    if (dragInfo) {
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragInfo, notes]);

  /* ── 페이퍼 오버레이 ── */
  const PaperOverlay = () => (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none"
      style={{
        opacity: 0.025,
        backgroundImage:
          'linear-gradient(to right, rgba(239,68,68,0.45) 0 1px, transparent 1px), repeating-linear-gradient(to bottom, rgba(15,23,42,0.22) 0 1px, transparent 1px 24px)',
        backgroundSize: '100% 100%, 100% 100%',
        backgroundPosition: '18% 0, 0 0',
      }}
    />
  );

  /* ════════════════════════════════════════
     렌더
  ════════════════════════════════════════ */
  if (!isLoggedIn) {
    return <AuthGate onLogin={handleLogin} />;
  }

  return (
    <div
      className="flex h-screen w-screen overflow-hidden antialiased text-slate-900 bg-white tracking-tight"
      style={{
        fontFamily: currentLang === 'en' ? FONT_STACK_EN : FONT_STACK_KO,
        letterSpacing: currentLang === 'en' ? '-0.01em' : undefined,
        lineHeight:    currentLang === 'en' ? 1.7 : undefined,
      }}
      onMouseUp={(e) => {
        if (e.target.closest('[data-selection-menu]')) return;
        if (!e.target.closest('[data-message-text-root]')) {
          setSelectionMenu((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        }
      }}
    >
      <style>{`
        .shadow-postit      { box-shadow: rgba(0,0,0,0.05) 0px 1px 3px 0px; }
        .shadow-postit-lift { box-shadow: rgba(0,0,0,0.10) 0px 8px 22px -10px, rgba(0,0,0,0.06) 0px 2px 6px 0px; }
        .bg-turquoise-50    { background-color: rgba(206,246,248,0.70); }
        @keyframes typingDotPulse {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
          40%           { transform: translateY(-3px); opacity: 0.9; }
        }
        .typing-dot {
          width: 6px; height: 6px; border-radius: 9999px;
          background: rgba(100,116,139,0.9);
          animation: typingDotPulse 1.1s infinite ease-in-out;
        }
        .typing-dot:nth-child(2) { animation-delay: 0.12s; }
        .typing-dot:nth-child(3) { animation-delay: 0.24s; }
      `}</style>

      {/* ── 오버레이 사이드바 ── */}
      <div
        className="absolute top-0 left-0 h-full bg-white/92 backdrop-blur-md border-r border-slate-200 transition-[width] duration-300 z-50 flex flex-col overflow-hidden"
        style={{
          width:     isSidebarOpen ? LAYOUT.OVERLAY_SIDEBAR_W : 0,
          boxShadow: isSidebarOpen ? '0 25px 50px -12px rgba(0,0,0,0.25)' : 'none',
          borderColor: isSidebarOpen ? undefined : 'transparent',
        }}
      >
        <div className="p-6 whitespace-nowrap overflow-hidden shrink-0">
          <button
            onClick={handleNewChat}
            className="flex items-center justify-center gap-2 bg-slate-900 text-white rounded-xl px-5 py-3 w-full hover:bg-slate-800 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">{t('newChat')}</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-6 space-y-1.5">
          <div className="text-[11px] font-semibold text-slate-400 px-3 py-3 uppercase tracking-wider">
            Recent
          </div>
          {chatHistory.map((chat) => (
            <button
              key={chat.id}
              onClick={() => loadChat(chat.id)}
              className={`group flex items-center justify-between w-full text-left px-4 py-3 rounded-xl text-[14px] transition-all duration-200 ${
                activeChatId === chat.id
                  ? 'bg-slate-100 text-slate-900 font-semibold shadow-sm'
                  : 'hover:bg-slate-50 text-slate-600'
              }`}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <MessageSquare className="w-4 h-4 shrink-0 opacity-70" />
                <span className="truncate text-left">{chat.title}</span>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0 ml-2">
                <div
                  onClick={(e) => handleRenameChat(chat.id, e)}
                  className="p-1.5 hover:bg-white rounded-md text-slate-500 shadow-sm border border-transparent hover:border-slate-200"
                  title={t('renameTitle')}
                >
                  <Pencil className="w-4 h-4" />
                </div>
                <div
                  onClick={(e) => handleDeleteChat(chat.id, e)}
                  className="p-1.5 hover:bg-red-50 rounded-md text-red-500 shadow-sm border border-transparent hover:border-red-100"
                  title={t('deleteTitle')}
                >
                  <Trash2 className="w-4 h-4" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => setIsSidebarOpen((v) => !v)}
        className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-16 bg-white border border-l-0 border-slate-200 rounded-r-xl shadow-sm hover:bg-slate-50 text-slate-500 z-50 cursor-pointer"
        style={{
          left:       isSidebarOpen ? LAYOUT.OVERLAY_SIDEBAR_W : 0,
          transition: 'left 300ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* ══════════════ 좌측 패널: 수납 구역 ══════════════ */}
      <div
        ref={leftPanelRef}
        data-scroll-section="notes_panel"
        className="relative h-full overflow-hidden border-r border-slate-200 bg-white"
        style={{
          width:      LAYOUT.LEFT_NOTES_W,
          minWidth:   LAYOUT.LEFT_NOTES_MIN_W,
          flexShrink: 0,
          flexGrow:   0,
        }}
      >
        <div
          className={`absolute inset-0 flex flex-col overflow-hidden transition-transform duration-200 ease-out origin-center ${
            isSnapZoneHighlighted ? 'scale-[0.982]' : 'scale-100'
          }`}
        >
          <PaperOverlay />
          {/* 자석 수납 Highlight 오버레이 */}
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'rgba(253, 224, 71, 0.28)',
              opacity:      isSnapZoneHighlighted ? 1 : 0,
              transition:   'opacity 0.12s ease, box-shadow 0.2s ease',
              zIndex:       2,
              boxShadow:    isSnapZoneHighlighted ? 'inset 0 4px 14px rgba(15, 23, 42, 0.09)' : 'none',
            }}
          />
          <div
            ref={leftRef}
            className="absolute inset-0 z-[10] overflow-y-auto overflow-x-hidden scroll-smooth"
          >
            {notes.length === 0 ? (
              <div className="relative flex min-h-full flex-col items-center justify-center gap-3 px-6 pb-6 pt-10 text-center opacity-95">
                <StickyNote className="w-9 h-9 shrink-0 text-yellow-300 opacity-35" />
                <p className="max-w-[220px] text-center text-[13px] leading-relaxed text-slate-400">
                  {t('memoStorageEmptyGuide')
                    .split('%%MEMO%%')
                    .map((segment, i, arr) => (
                      <React.Fragment key={`memo-empty-${currentLang}-${i}`}>
                        {segment}
                        {i < arr.length - 1 && (
                          <span className="font-bold text-yellow-600">{t('memoStorageHighlightWord')}</span>
                        )}
                      </React.Fragment>
                    ))}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-[8px] py-[10px]">
                {notes.filter((n) => n.stored && !n.snapping).map((note) => {
              const isCollapsed  = !!note.isCollapsed;
              const storedH      = isCollapsed ? 44 : NOTE_CARD_H;
              const isFlashing   =
                flashingId === note.id ||
                (hoveredHighlightId &&
                  highlights.find((h) => h.id === hoveredHighlightId)?.links?.some((l) => l.id === note.id));
              const isLocalHovered = hoveredNoteId === note.id;
              const badgeNum       = highlightIndexMap[note.id];

              const noteShadow = isFlashing
                ? '0 8px 20px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)'
                : isLocalHovered
                  ? '0 4px 12px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)'
                  : 'rgba(0,0,0,0.04) 0px 1px 2px 0px';

              return (
                <div
                  key={note.id}
                  ref={(el) => (postItRefs.current[note.id] = el)}
                  style={{
                    width:      NOTE_STORED_W,
                    height:     storedH,
                    boxShadow:  noteShadow,
                    flexShrink: 0,
                    transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                    transform:  isFlashing ? 'translateX(2px)' : isLocalHovered ? 'translateX(1px)' : 'none',
                  }}
                  onClick={(e) => handlePostItClick(e, note.id)}
                  onMouseEnter={() => {
                    setHoveredNoteId(note.id);
                    const hl = highlights.find((h) => h.links?.some((l) => l.id === note.id));
                    setHoveredPostItId(hl?.id ?? null);
                  }}
                  onMouseLeave={() => {
                    setHoveredNoteId(null);
                    setHoveredPostItId(null);
                  }}
                  className={`rounded-xl flex flex-col pointer-events-auto bg-yellow-50 ${
                    isCollapsed ? 'overflow-hidden' : ''
                  } ${isFlashing ? 'border border-yellow-300/70' : 'border border-slate-200/50'}`}
                >
                  {/* 헤더 */}
                  <div
                    className={`relative flex items-center justify-between px-4 select-none ${
                      isCollapsed ? 'h-11' : 'h-11 border-b border-black/5'
                    } cursor-grab active:cursor-grabbing`}
                    onMouseDown={(e) => startDrag(e, note.id, 'note', note.floatX, note.floatY)}
                  >
                    <div className="flex items-center gap-2 overflow-hidden w-full mr-3">
                      <GripHorizontal className="w-4 h-4 text-slate-500/40 shrink-0" />
                      <span className="flex items-center justify-center w-5 h-5 bg-yellow-300 text-yellow-900 text-[11px] font-bold rounded-full shrink-0">
                        {badgeNum}
                      </span>
                      {isCollapsed ? (
                        <input
                          value={note.title}
                          onChange={(e) => handleNoteTitleChange(note.id, e.target.value)}
                          className="bg-transparent border-none outline-none text-[13px] font-semibold text-slate-700 w-full truncate"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="text-[13px] font-semibold text-slate-700 truncate">{note.title}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 relative z-10">
                      <button
                        onClick={(e) => { e.stopPropagation(); scrollToHighlight(note.id); }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="p-1.5 hover:bg-black/5 rounded-lg text-slate-500/70 transition-colors"
                        title={t('moveToText')}
                      >
                        <MoveUpRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleNoteCollapse(note.id); }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="p-1.5 hover:bg-black/5 rounded-lg text-slate-500/70 transition-colors"
                      >
                        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); askConfirmDelete('note', note.id); }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="p-1.5 hover:bg-black/5 rounded-lg text-slate-500/70 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {!isCollapsed && (
                    <textarea
                      value={note.text || ''}
                      onChange={(e) => handleNoteChange(note.id, e.target.value)}
                      className="flex-1 w-full bg-transparent resize-none focus:outline-none p-4 text-[13px] text-slate-700 font-medium leading-relaxed placeholder:text-slate-400/60 text-left"
                      placeholder={t('notePlaceholder')}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      onFocus={() => startMemoEdit(String(note.id))}
                      onBlur={(e) => stopMemoEdit(String(note.id), e.target.value.length)}
                    />
                  )}
                </div>
              );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════ 플로팅 메모 포털 (floating + snapping) ══════════════ */}
      {createPortal(
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9000 }}>
          {notes.filter((n) => !n.stored || n.snapping).map((note) => {
            const isActiveDrag   = dragInfo?.type === 'note' && dragInfo?.id === note.id;
            const isCollapsed    = !!note.isCollapsed;
            const floatW         = NOTE_CARD_W;
            const floatH         = isCollapsed ? 44 : NOTE_CARD_H;
            const isFlashing     =
              flashingId === note.id ||
              (hoveredHighlightId &&
                highlights.find((h) => h.id === hoveredHighlightId)?.links?.some((l) => l.id === note.id));
            const isLocalHovered = hoveredNoteId === note.id;
            const badgeNum       = highlightIndexMap[note.id];

            const noteShadow = isActiveDrag
              ? '0 20px 50px rgba(0,0,0,0.22), 0 8px 20px rgba(0,0,0,0.14)'
              : isFlashing
                ? '0 12px 32px rgba(0,0,0,0.14), 0 4px 10px rgba(0,0,0,0.08)'
                : isLocalHovered
                  ? '0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)'
                  : '0 4px 14px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.05)';

            return (
              <motion.div
                key={note.id}
                ref={(el) => (postItRefs.current[note.id] = el)}
                style={{
                  position:       'fixed',
                  left:           0,
                  top:            0,
                  width:          floatW,
                  height:         floatH,
                  pointerEvents:  'auto',
                  zIndex:         isActiveDrag ? 9999 : isFlashing ? 9500 : 9100,
                  boxShadow:      noteShadow,
                }}
                animate={{ x: note.floatX ?? 0, y: note.floatY ?? 0 }}
                transition={
                  note.snapping
                    ? { type: 'spring', stiffness: 300, damping: 28 }
                    : { duration: 0 }
                }
                onAnimationComplete={() => {
                  if (note.snapping) {
                    setNotes((prev) =>
                      prev.map((n) =>
                        n.id === note.id ? { ...n, stored: true, snapping: false } : n
                      )
                    );
                  }
                }}
                onClick={(e) => handlePostItClick(e, note.id)}
                onMouseEnter={() => {
                  setHoveredNoteId(note.id);
                  const hl = highlights.find((h) => h.links?.some((l) => l.id === note.id));
                  setHoveredPostItId(hl?.id ?? null);
                }}
                onMouseLeave={() => {
                  setHoveredNoteId(null);
                  setHoveredPostItId(null);
                }}
                className={`rounded-xl flex flex-col bg-yellow-100 ${
                  isCollapsed ? 'overflow-hidden' : ''
                } ${isFlashing ? 'border border-slate-300' : 'border border-slate-200/80'}`}
              >
                <div
                  className={`relative flex items-center justify-between px-4 select-none ${
                    isCollapsed ? 'h-11' : 'h-11 border-b border-black/5'
                  } cursor-grab active:cursor-grabbing`}
                  onMouseDown={(e) => startDrag(e, note.id, 'note', note.floatX, note.floatY)}
                >
                  {isCollapsed && (
                    <>
                      <div className="absolute inset-x-0 top-0 h-[18px]" style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.55), rgba(255,255,255,0))' }} />
                      <div className="absolute inset-x-0 top-[18px] h-[10px]" style={{ boxShadow: 'rgba(0,0,0,0.06) 0px 3px 10px -8px inset' }} />
                    </>
                  )}
                  <div className="flex items-center gap-2 overflow-hidden w-full mr-3">
                    <GripHorizontal className="w-4 h-4 text-slate-700/40 shrink-0" />
                    <span className="flex items-center justify-center w-5 h-5 bg-yellow-400 text-yellow-900 text-[11px] font-bold rounded-full shrink-0">
                      {badgeNum}
                    </span>
                    {isCollapsed ? (
                      <input
                        value={note.title}
                        onChange={(e) => handleNoteTitleChange(note.id, e.target.value)}
                        className="bg-transparent border-none outline-none text-[13px] font-semibold text-slate-900 w-full truncate"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="text-[13px] font-semibold text-slate-900 truncate">{note.title}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 relative z-10">
                    <button
                      onClick={(e) => { e.stopPropagation(); scrollToHighlight(note.id); }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="p-1.5 hover:bg-black/5 rounded-lg text-slate-700/70 transition-colors"
                      title={t('moveToText')}
                    >
                      <MoveUpRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleNoteCollapse(note.id); }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="p-1.5 hover:bg-black/5 rounded-lg text-slate-700/70 transition-colors"
                    >
                      {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); askConfirmDelete('note', note.id); }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="p-1.5 hover:bg-black/5 rounded-lg text-slate-700/70 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {!isCollapsed && (
                  <textarea
                    value={note.text || ''}
                    onChange={(e) => handleNoteChange(note.id, e.target.value)}
                    className="flex-1 w-full bg-transparent resize-none focus:outline-none p-4 text-[13px] text-slate-800 font-medium leading-relaxed placeholder:text-slate-400/70 text-left"
                    placeholder={t('notePlaceholder')}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={() => startMemoEdit(String(note.id))}
                    onBlur={(e) => stopMemoEdit(String(note.id), e.target.value.length)}
                  />
                )}
              </motion.div>
            );
          })}
        </div>,
        document.body
      )}

      {/* ══════════════ 중앙 패널 ══════════════ */}
      <div
        ref={centerRef}
        className="relative h-full bg-white flex flex-col"
        onMouseUp={handleMouseUpCenter}
        style={{
          flex:    '1 1 0',
          minWidth: 320,
          zIndex:   1,
        }}
      >
        <PaperOverlay />

        {/* 헤더 */}
        <div className="relative shrink-0 px-7 py-4 border-b border-slate-200/60 flex items-center gap-3 bg-white/70 backdrop-blur-sm">
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shadow-sm shrink-0">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-semibold text-slate-800 truncate">{centerTitle}</div>
            <div className="text-[10.5px] text-slate-400 truncate">
              {t('centerSubtitle')}{ctxBlockIndex > 0 ? ` · Block ${ctxBlockIndex}` : ''}
            </div>
          </div>
          {/* ── 인터페이스 선택으로 돌아가기 ── */}
          <button
            onClick={() => navigate('/experiment-select')}
            className="text-[12px] text-slate-400 hover:text-slate-600 transition-colors px-2 py-1 rounded-md hover:bg-slate-100 shrink-0"
          >
            ← 인터페이스 선택
          </button>

          {/* ── [실험 시작] 임시 버튼 ── 실험 종료 후 이 한 줄만 제거 */}
          <StartButton onBeforeEndBlock={saveAiAnswerHeights} />
        </div>

        {/* 메시지 스크롤 영역 */}
        <div
          ref={centerScrollRef}
          data-scroll-section="main_canvas"
          className="relative flex-1 overflow-y-auto overflow-x-hidden px-7 py-8 space-y-7 pb-28"
        >
          {mainMessages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                ref={msg.id === streamingAiMsgId ? streamingAiMsgRef : null}
                className={`flex items-start ${isUser ? 'justify-end' : 'justify-start'} gap-3`}
                data-message-id={msg.id}
                data-msg-role={isUser ? 'user' : 'ai'}
                style={{ scrollMarginTop: 24 }}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shrink-0 shadow-sm">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                <div className={`min-w-0 ${isUser ? 'max-w-[88%]' : 'max-w-[92%]'}`}>
                  <div
                    className={`text-left text-[14px] font-medium ${
                      isUser
                        ? 'whitespace-pre-wrap leading-relaxed bg-slate-100 text-slate-800 border border-slate-200/70 rounded-2xl rounded-tr-md px-5 py-3 shadow-sm'
                        : 'ai-markdown-wrap bg-white/80 text-slate-800 border border-slate-200/70 rounded-2xl rounded-tl-md px-6 py-4 shadow-postit'
                    }`}
                  >
                    <MessageTextWithHighlightOverlays
                      messageId={msg.id}
                      isUser={isUser}
                      msgText={msg.text || ''}
                      isStreamingSkeleton={!isUser && streamingAiMsgId === msg.id && !msg.text}
                      highlights={highlights.filter((h) => !h.sideChatId)}
                      highlightIndexMap={highlightIndexMap}
                      scrollToPostIt={scrollToPostIt}
                      onHighlightHover={setHoveredHighlightId}
                      onHighlightLeave={() => setHoveredHighlightId(null)}
                      flashingHighlightId={flashingHighlightId}
                      hoveredPostItId={hoveredPostItId}
                      markdownRehypePlugins={markdownRehypePlugins}
                      markdownComponents={markdownComponents}
                      scrollContainerRef={centerScrollRef}
                    />
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={mainBottomRef} style={{ scrollMarginBottom: 140 }} />
        </div>

        {/* 입력창 */}
        <div className="absolute bottom-0 left-0 right-0 z-10 px-7 pb-6 pt-5 bg-gradient-to-t from-white via-white to-transparent">
          <form
            onSubmit={handleMainSubmit}
            className="relative w-full rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-sm shadow-sm"
          >
            <input
              type="text"
              value={mainInput}
              onChange={(e) => setMainInput(e.target.value)}
              placeholder={t('inputPlaceholder')}
              className="w-full pl-4 pr-12 py-3 rounded-2xl focus:outline-none bg-transparent text-[13px] text-slate-800 placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={isMainLoading}
              className={`absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200 shadow-sm ${
                isMainLoading
                  ? 'bg-slate-300 text-white cursor-not-allowed'
                  : 'bg-slate-900 text-white hover:bg-slate-800 hover:scale-110 active:scale-95'
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

      </div>

      {/* ══════════════ 세로 목차 컬럼 (Conversation Index) ══════════════ */}
      {(
        <div
          ref={sidebarRef}
          data-scroll-section="toc"
          className="relative flex flex-col h-full overflow-y-auto scrollbar-none"
          style={{
            width:     LAYOUT.TOC_W,
            minWidth:  LAYOUT.TOC_MIN_W,
            flexShrink: 0,
            flexGrow:   0,
            background:  '#dce3ed',
            borderLeft:  '1px solid #c8d3e0',
            borderRight: '1px solid #c8d3e0',
          }}
        >
          {/* 헤더 — 드래그 핸들 */}
          <div
            onMouseDown={handleTocHeaderMouseDown}
            title="드래그하여 패널 너비 조정"
            className="shrink-0 px-2 pt-3 pb-2 border-b border-[#c8d3e0] sticky top-0 z-20 select-none group relative"
            style={{
              background: isTocDragging ? '#c8d8ea' : '#dce3ed',
              cursor: 'col-resize',
              transition: 'background 0.15s',
            }}
          >
            {/* 아이콘 + 레이블 — 한 행 */}
            <div className="flex items-center gap-1.5">
              <GripVertical
                className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 shrink-0 transition-colors"
                style={{ opacity: isTocDragging ? 1 : 0.6 }}
              />
              <MessageSquarePlus className="w-3 h-3 text-cyan-500 shrink-0" />
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                {t('deepDivePanelHeader')}
              </span>
            </div>
            {/* 드래그 중 강조 선 */}
            {isTocDragging && (
              <div
                className="absolute inset-y-0 left-0 w-0.5 bg-blue-400"
                style={{ pointerEvents: 'none' }}
              />
            )}
          </div>

          {/* 빈 상태: 고스트 미리보기 */}
          {orderedTree.length === 0 && (() => {
            const INDENT = 11;
            const ghostTitles = t('ghostTitles');
            const ghost = [
              { depth: 0, label: '1',     title: ghostTitles[0], h: 52 },
              { depth: 1, label: '1-1',   title: ghostTitles[1], h: 44 },
              { depth: 2, label: '1-1-1', title: ghostTitles[2], h: 38 },
            ];
            const ghostStackPx       = ghost.reduce((sum, row) => sum + row.h, 0);
            const sidebarHeaderPx    = 46;
            const emptyHintVertAlign = `translateY(calc(-0.5 * (${sidebarHeaderPx}px + ${ghostStackPx}px)))`;
            return (
              <div className="relative flex flex-col flex-1" style={{ minHeight: 0 }} aria-hidden="true">
                {ghost.map(({ depth, label, title, h }) => {
                  const bg =
                    depth === 0 ? 'rgba(255,255,255,0.30)'
                    : depth === 1 ? 'rgba(232,240,254,0.35)'
                    : 'rgba(210,227,252,0.40)';
                  const pl = 9 + depth * INDENT;
                  return (
                    <div
                      key={depth}
                      style={{
                        position: 'relative', minHeight: h,
                        paddingLeft: pl, paddingRight: 8,
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: bg,
                        borderBottom: '0.5px solid rgba(150,170,195,0.30)',
                        borderRight:  '0.5px solid rgba(150,170,195,0.30)',
                      }}
                    >
                      <div style={{
                        position: 'absolute', left: 0, top: '12%', bottom: '12%', width: 4,
                        borderRadius: '0 3px 3px 0', background: 'rgba(37,99,235,0.18)',
                      }} />
                      {depth > 0 && (
                        <svg width={depth === 1 ? 8 : 7} height={depth === 1 ? 8 : 7}
                          viewBox="0 0 9 9" fill="none" style={{ flexShrink: 0, opacity: 0.30 }}>
                          <path d="M2 1.5 L2 7 L7.5 7" stroke="#475569" strokeWidth="1.6"
                            strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      <span style={{
                        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: depth === 0 ? 13 : depth === 1 ? 11 : undefined,
                        height: depth === 0 ? 13 : depth === 1 ? 11 : undefined,
                        minWidth: depth === 2 ? 20 : undefined,
                        padding: depth === 2 ? '1px 4px' : undefined,
                        fontSize: depth === 0 ? '8px' : '7px', fontWeight: 600,
                        borderRadius: 9999,
                        background: 'rgba(37,99,235,0.15)', color: 'rgba(37,99,235,0.45)',
                      }}>{label}</span>
                      <span style={{
                        fontSize: depth === 0 ? 11 : depth === 1 ? 10 : 9,
                        fontWeight: depth === 0 ? 700 : depth === 1 ? 500 : 400,
                        color: 'rgba(60,90,130,0.35)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{title}</span>
                    </div>
                  );
                })}
                {/* 안내 문구 — 병렬 대화창 빈 화면과 세로 정렬 맞춤 */}
                <div
                  className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center"
                  style={{ transform: emptyHintVertAlign }}
                >
                  <MessageSquarePlus className="w-9 h-9 opacity-25 text-slate-500" />
                  <p className="text-[13px] leading-relaxed whitespace-pre-line" style={{ color: 'rgba(90,110,140,0.70)' }}>
                    {t('tocGuide')}
                  </p>
                </div>
              </div>
            );
          })()}

          {/* 트리 아이템 */}
          {orderedTree.map((chat) => {
            const isActive  = chat.id === activeThreadId;
            const treeLabel = treeLabelMap[chat.id] ?? '';
            const depth     = chat.depth || 0;
            const INDENT    = 11;
            const isFlashing =
              flashingId === chat.id ||
              !!(hoveredHighlightId &&
                highlights.find((h) => h.id === hoveredHighlightId)?.links?.some((l) => l.id === chat.id));
            const isHovered = hoveredTabId === chat.id;

            const tabMinHeight = depth === 0 ? 52 : depth === 1 ? 44 : 38;
            const depthBg      = depth === 0 ? '#FFFFFF' : depth === 1 ? '#E8F0FE' : '#D2E3FC';
            const hoverBg      = depth === 0 ? '#EEF3FF' : depth === 1 ? '#D5E5FD' : '#BFCFF8';
            const activeBg     = depth === 0 ? '#DBEAFE' : depth === 1 ? '#BFDBFE' : '#93C5FD';
            const depthShadow  = depth === 0
              ? '0 3px 8px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.07)'
              : 'inset 0 2px 4px rgba(0,0,0,0.05)';
            const pl = 9 + depth * INDENT;

            return (
              <div
                key={chat.id}
                data-tab-id={chat.id}
                style={{
                  position: 'relative', minHeight: tabMinHeight,
                  paddingLeft: pl, paddingRight: 6,
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: isActive ? activeBg : (isHovered || isFlashing) ? hoverBg : depthBg,
                  borderBottom: '0.5px solid rgba(150,170,195,0.25)',
                  boxShadow: isActive ? depthShadow : 'none',
                  cursor: 'pointer',
                  transition: 'background 0.1s ease, box-shadow 0.15s ease',
                }}
                onMouseEnter={() => {
                  setHoveredTabId(chat.id);
                  const hl = highlights.find((h) => h.links?.some((l) => l.id === chat.id));
                  setHoveredPostItId(hl?.id ?? null);
                }}
                onMouseLeave={() => {
                  setHoveredTabId(null);
                  setHoveredPostItId(null);
                }}
                onClick={() => {
                  if (chat.id !== activeThreadId) {
                    logParallelWindowReactivate({ windowId: `parallel_window_${treeLabelMap[chat.id] ?? String(chat.id)}` });
                  }
                  setActiveSideChatId(chat.id);
                }}
              >
                {/* L자 연결선 */}
                {depth > 0 && (
                  <svg width={depth === 1 ? 8 : 7} height={depth === 1 ? 8 : 7}
                    viewBox="0 0 9 9" fill="none" style={{ flexShrink: 0, opacity: 0.45 }}>
                    <path d="M2 1.5 L2 7 L7.5 7" stroke="#475569" strokeWidth="1.6"
                      strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {/* 배지 */}
                <span style={{
                  flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: 20, height: depth === 0 ? 14 : 12,
                  padding: '1px 4px',
                  fontSize: depth === 0 ? '8px' : '7px', fontWeight: 700,
                  borderRadius: 9999,
                  background: isActive ? 'rgba(37,99,235,0.85)' : 'rgba(37,99,235,0.15)',
                  color: isActive ? '#fff' : 'rgba(37,99,235,0.6)',
                }}>{treeLabel}</span>
                {/* 제목 */}
                <span style={{
                  flex: 1,
                  fontSize: depth === 0 ? 11 : 10,
                  fontWeight: isActive ? 600 : depth === 0 ? 500 : 400,
                  color: isActive ? '#1e3a5f' : isHovered ? '#334155' : 'rgba(51,65,85,0.75)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{chat.title}</span>
                {/* 액션 버튼 */}
                {isHovered && (
                  <div className="shrink-0 flex items-center gap-0.5">
                    <button
                      className="p-0.5 rounded hover:bg-black/10 text-slate-400 hover:text-slate-600 transition-colors"
                      onClick={(e) => { e.stopPropagation(); scrollToHighlight(chat.id); }}
                      title={t('moveToText')}
                    >
                      <MoveUpRight className="w-2.5 h-2.5" />
                    </button>
                    <button
                      className="p-0.5 rounded hover:bg-black/10 text-slate-400 hover:text-red-400 transition-colors"
                      onClick={(e) => { e.stopPropagation(); askConfirmDelete('chat', chat.id); }}
                      title={t('deleteTitle')}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════ 우측 패널: Deep Dive ══════════════ */}
      <div
        className="relative flex flex-col h-full border-l border-slate-200 bg-white"
        style={{
          width:     rightPanelW,
          minWidth:  LAYOUT.RIGHT_PANEL_MIN_W,
          flexShrink: 0,
          flexGrow:   0,
          transition: isTocDragging ? 'none' : 'width 0.15s ease',
        }}
      >
        <PaperOverlay />

        {/* 적층 종이 효과 (우측 경계) */}
        <div className="pointer-events-none absolute right-0 top-0 h-full z-0 flex flex-row-reverse">
          <div style={{ width: 5, background: '#dee2e6', boxShadow: '-1px 0 0 #ced4da' }} />
          <div style={{ width: 5, background: '#e9ecef', boxShadow: '-1px 0 0 #dee2e6' }} />
          <div style={{ width: 6, background: '#f1f3f5' }} />
        </div>

        {/* 패널 헤더 */}
        <div className="relative shrink-0 px-4 py-3 border-b border-slate-200/60 bg-white/70 backdrop-blur-sm flex items-center gap-2 z-10">
          <MessageSquarePlus className="w-4 h-4 text-cyan-500 shrink-0" />
          <span className="text-[13px] font-semibold text-slate-700">{t('deepDivePanelHeader')}</span>
          {sideChats.length > 0 && (
            <span className="ml-auto flex items-center justify-center w-5 h-5 rounded-full bg-cyan-100 text-cyan-700 text-[11px] font-bold">
              {sideChats.length}
            </span>
          )}
        </div>

        {sideChats.length === 0 ? (
          /* ── 빈 상태 ── */
          <div className="relative flex-1 flex flex-col items-center justify-center gap-3 text-slate-400 px-6 text-center">
            <MessageSquarePlus className="w-9 h-9 opacity-25" />
            {currentLang === 'en' ? (
              <p className="text-[13px] leading-relaxed">
                Highlight what interests you and click{' '}
                <span className="font-bold text-cyan-600">Deep Dive</span>{' '}
                to start a deeper conversation.
              </p>
            ) : (
              <p className="text-[13px] leading-relaxed">
                궁금한 내용을 하이라이트하고{' '}
                <span className="font-bold text-cyan-600">추가질문</span>{' '}
                버튼을 눌러 더 깊은 대화를 시작하세요.
              </p>
            )}
          </div>
        ) : activeThread ? (
          <>
            {/* 출처 텍스트 */}
            <div className="shrink-0 mx-4 mt-3 mb-1 px-3 py-2 rounded-xl bg-cyan-50/70 border border-cyan-100/80">
              <p className="text-[9.5px] font-semibold text-cyan-500 uppercase tracking-widest mb-0.5">
                {t('sourceRefShort')}
              </p>
              <p className="text-[11.5px] text-slate-600 leading-snug line-clamp-2">
                &ldquo;{activeThread.sourceText}&rdquo;
              </p>
            </div>

            {/* 메시지 목록 */}
            <div
              ref={sideScrollRef}
              data-scroll-section={`parallel_window_${treeLabelMap[activeThread?.id] ?? String(activeThread?.id ?? '')}`}
              className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-3.5 text-left"
              onMouseUp={handleMouseUpSide}
            >
              {activeThread.messages.map((msg) => {
                const isU = msg.sender === 'user';
                return (
                  <div
                    key={msg.id}
                    data-side-message-id={msg.id}
                    data-msg-role={isU ? 'user' : 'ai'}
                    className={`flex items-start ${isU ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] text-left font-normal ${
                        isU
                          ? 'bg-slate-50 text-slate-700 border border-slate-100 rounded-2xl rounded-tr-sm px-3.5 py-2 text-[12.5px] leading-[1.7] shadow-sm'
                          : 'bg-white border border-slate-100 text-slate-700 rounded-2xl rounded-tl-sm px-3.5 py-2.5 shadow-postit side-chat-markdown-wrap'
                      }`}
                    >
                      <MessageTextWithHighlightOverlays
                        messageId={msg.id}
                        isUser={isU}
                        msgText={msg.text || ''}
                        isStreamingSkeleton={!isU && !msg.text}
                        highlights={highlights.filter((h) => h.sideChatId === activeThread.id)}
                        highlightIndexMap={highlightIndexMap}
                        scrollToPostIt={scrollToPostIt}
                        onHighlightHover={setHoveredHighlightId}
                        onHighlightLeave={() => setHoveredHighlightId(null)}
                        flashingHighlightId={flashingHighlightId}
                        hoveredPostItId={hoveredPostItId}
                        markdownRehypePlugins={markdownRehypePlugins}
                        markdownComponents={markdownComponents}
                        scrollContainerRef={sideScrollRef}
                        markdownClassName="side-chat-markdown"
                      />
                    </div>
                  </div>
                );
              })}
              <div ref={sideChatBottomRef} />
            </div>

            {/* 입력 */}
            <form
              onSubmit={(e) => handleSideSubmit(activeThread.id, e)}
              className="shrink-0 px-4 pb-4 pt-2 border-t border-slate-100 bg-white/85 backdrop-blur-md"
            >
              <div className="relative flex items-center rounded-xl border border-slate-100 bg-white/90 shadow-sm focus-within:ring-2 focus-within:ring-cyan-300/40 focus-within:border-cyan-200 transition-all">
                <input
                  type="text"
                  value={activeThread.input || ''}
                  onChange={(e) => updateSideChatInput(activeThread.id, e.target.value)}
                  placeholder={t('sideChatInputPlaceholder')}
                  disabled={loadingSideChatIds.has(activeThread.id)}
                  className="flex-1 pl-3 pr-9 py-2 bg-transparent text-[12.5px] text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:opacity-50 rounded-xl"
                />
                <button
                  type="submit"
                  disabled={loadingSideChatIds.has(activeThread.id)}
                  className="absolute right-2 p-1 text-cyan-500 hover:bg-cyan-50 rounded-lg transition-colors disabled:opacity-35"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-[13px] px-4 text-center">
            {t('selectThreadHint')}
          </div>
        )}
      </div>

      {/* ══ 세로 목차 돌출 바 포털 ══ */}
      {protrBarInfo && createPortal(
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            left:   protrBarInfo.sidebarLeft - 5,
            top:    protrBarInfo.top,
            height: protrBarInfo.height,
            width: 8,
            background: 'linear-gradient(180deg, #60a5fa 0%, #2563eb 100%)',
            borderRadius: '3px 0 0 3px',
            boxShadow: '-2px 0 7px rgba(37,99,235,0.18), -1px 0 3px rgba(37,99,235,0.10)',
            zIndex: 200,
            pointerEvents: 'none',
            transition: 'top 0.15s ease, height 0.15s ease',
          }}
        />,
        document.body
      )}

      {/* ══ 선택 메뉴 포털 (viewport 최상단 z-9999) ══ */}
      {selectionMenu.visible && createPortal(
        <div
          data-selection-menu
          style={{
            position: 'fixed',
            zIndex: 9999,
            left: selectionMenu.x,
            top:  selectionMenu.y,
            transform: 'translate(-50%, -100%)',
          }}
          onMouseDown={(e) => e.preventDefault()}
          className="flex items-center gap-1.5 p-1.5 bg-slate-900 rounded-xl shadow-xl border border-slate-700"
        >
          <button
            onClick={handleCreateNote}
            className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-white/10 text-white text-[13px] font-semibold transition-colors"
          >
            <StickyNote className="w-4 h-4 text-yellow-300" />
            <span>{t('memoButton')}</span>
          </button>
          <div className="w-px h-5 bg-white/15 mx-1" />
          <button
            onClick={handleCreateSideChat}
            className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-white/10 text-white text-[13px] font-semibold transition-colors"
          >
            <MessageSquarePlus className="w-4 h-4 text-cyan-300" />
            <span>{t('deepDiveButton')}</span>
          </button>
        </div>,
        document.body
      )}

      {/* ── 삭제 확인 다이얼로그 ── */}
      {confirmDialog.visible && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(15,23,42,0.32)',
            backdropFilter: 'blur(2px)',
          }}
          onMouseDown={handleCancelDelete}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 16,
              boxShadow: '0 8px 32px rgba(15,23,42,0.18), 0 2px 8px rgba(15,23,42,0.10)',
              padding: '24px 28px 20px',
              minWidth: 300,
              maxWidth: 380,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <p style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 700,
              color: '#0f172a',
              whiteSpace: 'nowrap',
            }}>
              {confirmDialog.type === 'note' ? t('confirmNoteDeleteTitle') : t('confirmChatDeleteTitle')}
            </p>
            <p style={{
              margin: 0,
              fontSize: 13,
              color: '#64748b',
              whiteSpace: 'nowrap',
              marginBottom: 6,
            }}>
              {confirmDialog.type === 'note' ? t('confirmNoteDeleteMsg') : t('confirmChatDeleteMsg')}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button
                onClick={handleCancelDelete}
                style={{
                  padding: '7px 16px',
                  fontSize: 13,
                  fontWeight: 500,
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  color: '#475569',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#f8fafc')}
              >
                {t('cancelLabel')}
              </button>
              <button
                onClick={handleConfirmDelete}
                style={{
                  padding: '7px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 8,
                  border: '1px solid rgba(239,68,68,0.3)',
                  background: '#fef2f2',
                  color: '#dc2626',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#fee2e2')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#fef2f2')}
              >
                {t('deleteTitle')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
