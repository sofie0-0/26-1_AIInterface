import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Bot,
  ChevronDown,
  ChevronRight,
  MoveUpRight,
  GripHorizontal,
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
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';

/* ─────────────────── 상수 ─────────────────── */
const GEMINI_API_VERSION = 'v1';
const GEMINI_MODEL = 'gemini-2.5-flash';

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
    sidebarGuide: '여러 대화를 한눈에 파악하고 대화의 줄기를 계층적으로 관리하세요.',
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
    generatingAnswer: '답변 생성 중',
    errorMsg: '죄송합니다. 오류가 발생했습니다.',
    sideChatErrorMsg: '오류가 발생했습니다.',
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
    sidebarGuide: 'Manage multiple conversations at a glance and organize them hierarchically.',
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
    generatingAnswer: 'Generating response',
    errorMsg: 'Sorry, an error occurred.',
    sideChatErrorMsg: 'An error occurred.',
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

function computeCanvasHeight(items, collapsedH, paddingBottom = 48) {
  if (!items?.length) return '100%';
  const maxBottom = items.reduce((acc, it) => {
    const h = it.isCollapsed ? collapsedH : (it.height || 0);
    return Math.max(acc, (it.y || 0) + h);
  }, 0);
  return Math.max(maxBottom + paddingBottom, 1);
}

/* ─── 하이라이트 오프셋 헬퍼 ─── */

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
          <div className="ai-markdown">
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

        const sortedLinks = [...links].sort(
          (a, b) => (highlightIndexMap[a.id] ?? 999) - (highlightIndexMap[b.id] ?? 999)
        );

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

/* ─────────────────── 메인 컴포넌트 ─────────────────── */
export default function NonLinearChatInterface() {
  /* ── Gemini AI ── */
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const ai = useMemo(() => {
    if (!apiKey) return null;
    return new GoogleGenAI({ apiKey, httpOptions: { apiVersion: GEMINI_API_VERSION } });
  }, [apiKey]);

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
      console.log('API 키 로드:', apiKey ? '✅' : '❌');
      console.log('사용 모델:', GEMINI_MODEL);
      console.log('현재 언어:', currentLang);
    }
  }, [apiKey, currentLang]);

  /* ── 채팅 히스토리 ── */
  const [chatHistory, setChatHistory] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((c) => ({
          ...c,
          data: { ...c.data, highlights: migrateHighlights(c.data?.highlights) },
        }));
      } catch { /* ignore */ }
    }
    return [
      {
        id: 1,
        title: '비선형 상호작용 캔버스',
        data: { messages: initialData.messages, notes: [], sideChats: [], highlights: [] },
      },
    ];
  });

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

  const [activeChatId, setActiveChatId] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_ACTIVE_ID);
    return saved ? JSON.parse(saved) : 1;
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const activeChat = chatHistory.find((c) => c.id === activeChatId) || chatHistory[0];

  /* ── 핵심 상태 ── */
  const [mainMessages, setMainMessages] = useState(() => activeChat?.data?.messages ?? initialData.messages);
  const [notes,        setNotes]        = useState(() => activeChat?.data?.notes ?? []);
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
  });

  /* 드래그/리사이즈 */
  const [dragInfo,   setDragInfo]   = useState(null);
  const [resizeInfo, setResizeInfo] = useState(null);

  /* 우측 패널: 활성 스레드 ID (null = 첫 번째 자동 선택) */
  const [activeSideChatId, setActiveSideChatId] = useState(null);

  /* ── Refs ── */
  const postItRefs      = useRef({});
  const dragMoved       = useRef(false);
  const leftRef         = useRef(null);
  const centerRef       = useRef(null);
  const centerScrollRef = useRef(null);
  const sideChatBottomRef = useRef(null);
  const mainBottomRef   = useRef(null);

  /* ── Markdown 플러그인 (메모화) ── */
  const markdownRehypePlugins = useMemo(() => [rehypeRaw], []);
  const markdownComponents    = useMemo(() => ({}), []);

  /* ── highlightIndexMap: link.id → 전역 배지 번호 ── */
  const highlightIndexMap = useMemo(() => {
    const map = {};
    let idx = 1;
    highlights.forEach((h) => {
      (h.links || []).forEach((link) => {
        if (!(link.id in map)) map[link.id] = idx++;
      });
    });
    return map;
  }, [highlights]);

  /* ── 캔버스 높이 (노트 전용) ── */
  const leftCanvasHeight = useMemo(() => computeCanvasHeight(notes, 44, 64), [notes]);
  const centerTitle      = activeChat?.title?.trim() ? activeChat.title : t('chatFallbackTitle');

  /* 우측 패널: 활성 스레드 (null이면 첫 번째) */
  const activeThreadId = activeSideChatId ?? sideChats[0]?.id ?? null;
  const activeThread   = sideChats.find((c) => c.id === activeThreadId) ?? null;

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
    localStorage.setItem(STORAGE_KEY_HISTORY,   JSON.stringify(chatHistory));
    localStorage.setItem(STORAGE_KEY_ACTIVE_ID, JSON.stringify(activeChatId));
  }, [activeChatId, chatHistory]);

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

  /* ── 스크롤 자동 ── */
  useEffect(() => {
    if (!isMainLoading && mainMessages.length === 0) return;
    requestAnimationFrame(() => {
      mainBottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
    });
  }, [isMainLoading, mainMessages]);

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
      setActiveSideChatId(id);
      setFlashingId(id);
      setTimeout(() => setFlashingId(null), 1500);
      return;
    }
    // 노트는 기존 방식대로 스크롤
    const el = postItRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setFlashingId(id);
      setTimeout(() => setFlashingId(null), 1500);
    }
  }, [sideChats]);

  const scrollToHighlight = useCallback(
    (postitId) => {
      const hl = highlights.find((h) => h.links?.some((l) => l.id === postitId));
      if (!hl) return;
      const el = document.getElementById(`highlight-${hl.id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setFlashingHighlightId(hl.id);
      setTimeout(() => setFlashingHighlightId(null), 3100);
    },
    [highlights]
  );

  const handlePostItClick = (e, id) => {
    if (dragMoved.current) return;
    const tag = e.target.tagName.toLowerCase();
    const isInput = tag === 'textarea' || tag === 'input' || tag === 'button' || e.target.closest('button');
    if (!isInput) scrollToHighlight(id);
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
    });
  };

  /* ── 포스트잇 생성 (다중 연결 merge 로직) ── */
  const handleCreateNote = () => {
    const yPos     = Math.max(24, selectionMenu.originY - 24);
    const now      = Date.now();
    const noteWidth = 250;
    const xPos     = leftRef.current
      ? leftRef.current.clientWidth - noteWidth - 24
      : 24;

    const newNote = {
      id: now,
      text: selectionMenu.text,   // 하이라이트된 텍스트가 초기 메모 내용
      title: truncateTitle(selectionMenu.text),
      isCollapsed: false,
      x: xPos, y: yPos,
      width: noteWidth, height: 280,
    };
    setNotes((prev) => [...prev, newNote]);

    // 같은 구간 하이라이트에 link 추가, 없으면 새로 생성
    const existingHl =
      highlights.find(
        (h) =>
          h.messageId   === selectionMenu.messageId &&
          h.startOffset === selectionMenu.startOffset &&
          h.endOffset   === selectionMenu.endOffset
      ) ||
      highlights.find(
        (h) =>
          h.messageId === selectionMenu.messageId &&
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
          messageId:   selectionMenu.messageId,
          startOffset: selectionMenu.startOffset,
          endOffset:   selectionMenu.endOffset,
          text:        selectionMenu.text,
          links:       [{ id: now, type: 'note' }],
        },
      ]);
    }

    setSelectionMenu({ visible: false, text: '', x: 0, y: 0, originY: 0, messageId: null, startOffset: 0, endOffset: 0 });
    window.getSelection()?.removeAllRanges();
  };

  const handleCreateSideChat = () => {
    const now = Date.now();

    const newChat = {
      id: now,
      sourceText: selectionMenu.text,
      title: truncateTitle(selectionMenu.text),
      messages: [{ id: 1, sender: 'ai', text: t('sideChatInitMsg')(selectionMenu.text) }],
      input: '',
    };
    setSideChats((prev) => [...prev, newChat]);
    setActiveSideChatId(now);

    const existingHl =
      highlights.find(
        (h) =>
          h.messageId   === selectionMenu.messageId &&
          h.startOffset === selectionMenu.startOffset &&
          h.endOffset   === selectionMenu.endOffset
      ) ||
      highlights.find(
        (h) =>
          h.messageId === selectionMenu.messageId &&
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
          messageId:   selectionMenu.messageId,
          startOffset: selectionMenu.startOffset,
          endOffset:   selectionMenu.endOffset,
          text:        selectionMenu.text,
          links:       [{ id: now, type: 'chat' }],
        },
      ]);
    }

    setSelectionMenu({ visible: false, text: '', x: 0, y: 0, originY: 0, messageId: null, startOffset: 0, endOffset: 0 });
    window.getSelection()?.removeAllRanges();
  };

  /* ── 포스트잇 삭제 (link 제거 → highlights 고아 정리) ── */
  const removeNote = (noteId) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    setHighlights((prev) =>
      prev
        .map((h) => ({ ...h, links: (h.links || []).filter((l) => l.id !== noteId) }))
        .filter((h) => (h.links || []).length > 0)
    );
  };

  const removeSideChat = (chatId) => {
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

    const userMsg = { id: Date.now(), sender: 'user', text };
    setMainMessages((prev) => [...prev, userMsg]);
    ensureSessionTitle(text);
    setMainInput('');

    const aiMsgId = Date.now() + 1;
    setStreamingAiMsgId(aiMsgId);
    setIsMainLoading(true);
    setMainMessages((prev) => [...prev, { id: aiMsgId, sender: 'ai', text: '' }]);

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
      setIsMainLoading(false);
      setStreamingAiMsgId(null);
    }
  };

  /* ── 사이드챗 AI 제출 (스트리밍) ── */
  const handleSideSubmit = async (chatId, e) => {
    e.preventDefault();
    const chat = sideChats.find((c) => c.id === chatId);
    if (!chat || !chat.input?.trim() || loadingSideChatIds.has(chatId)) return;

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
    setDragInfo({ type, id, startX: itemX, startY: itemY, mouseX: e.clientX, mouseY: e.clientY });
  };

  const startResize = (e, id, type, dir, width, height) => {
    e.preventDefault();
    e.stopPropagation();
    setResizeInfo({ type, id, dir, startWidth: width, startHeight: height, mouseX: e.clientX, mouseY: e.clientY });
  };

  useEffect(() => {
    const onMove = (e) => {
      if (dragInfo) {
        dragMoved.current = true;
        const dx  = e.clientX - dragInfo.mouseX;
        const dy  = e.clientY - dragInfo.mouseY;
        let newX  = dragInfo.startX + dx;
        let newY  = dragInfo.startY + dy;
        const sc  = leftRef.current;
        const it  = notes.find((n) => n.id === dragInfo.id);

        if (sc && it) {
          const iW = it.width || 250;
          const iH = it.isCollapsed ? 44 : (it.height || 280);
          newX = clamp(newX, 0, Math.max(0, sc.clientWidth  - iW));
          newY = clamp(newY, 0, Math.max(0, sc.scrollHeight - iH));
        }
        setNotes((prev) => prev.map((n) => n.id === dragInfo.id ? { ...n, x: newX, y: newY } : n));
      }

      if (resizeInfo) {
        const dx = e.clientX - resizeInfo.mouseX;
        const dy = e.clientY - resizeInfo.mouseY;
        const sc = leftRef.current;
        if (!sc) return;
        const it = notes.find((n) => n.id === resizeInfo.id);
        if (!it) return;

        let nW = it.width, nH = it.height;
        if (resizeInfo.dir === 'right' || resizeInfo.dir === 'both') {
          nW = Math.max(240, Math.min(resizeInfo.startWidth  + dx, sc.clientWidth  - (it.x || 0)));
        }
        if (resizeInfo.dir === 'bottom' || resizeInfo.dir === 'both') {
          nH = Math.max(140, Math.min(resizeInfo.startHeight + dy, sc.scrollHeight - (it.y || 0)));
        }
        setNotes((prev) => prev.map((n) => n.id === resizeInfo.id ? { ...n, width: nW, height: nH } : n));
      }
    };

    const onUp = () => {
      setDragInfo(null);
      setResizeInfo(null);
      setTimeout(() => { dragMoved.current = false; }, 50);
    };

    if (dragInfo || resizeInfo) {
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragInfo, notes, resizeInfo]);

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
  return (
    <div
      className="flex h-screen w-screen overflow-hidden antialiased text-slate-900 bg-white tracking-tight"
      style={{
        fontFamily: currentLang === 'en' ? FONT_STACK_EN : FONT_STACK_KO,
        letterSpacing: currentLang === 'en' ? '-0.01em' : undefined,
        lineHeight:    currentLang === 'en' ? 1.7 : undefined,
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

      {/* ── 사이드바 ── */}
      <div
        className={`absolute top-0 left-0 h-full bg-white/92 backdrop-blur-md border-r border-slate-200 transition-[width] duration-300 z-50 flex flex-col overflow-hidden ${
          isSidebarOpen ? 'w-72 shadow-xl' : 'w-0 border-transparent shadow-none'
        }`}
      >
        <div className="p-6 whitespace-nowrap overflow-hidden shrink-0">
          <button
            onClick={handleNewChat}
            className="flex items-center justify-center gap-2 bg-slate-900 text-white rounded-xl px-5 py-3 w-full hover:bg-slate-800 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">{t('newChat')}</span>
          </button>
          <p className="mt-3 text-[11px] text-slate-400 leading-relaxed px-1">
            {t('sidebarGuide')}
          </p>
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
        className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-16 bg-white border border-slate-200 rounded-r-xl shadow-sm hover:bg-slate-50 text-slate-500 z-50 cursor-pointer transition-[left] duration-300 ${
          isSidebarOpen ? 'left-72 border-l-0' : 'left-0 border-l-0'
        }`}
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* ══════════════ 좌측 패널: 노트 ══════════════ */}
      <div className="relative flex-[0_0_30%] min-w-0 h-full border-r border-slate-200 bg-white">
        <PaperOverlay />
        <div ref={leftRef} className="absolute inset-0 overflow-y-auto overflow-x-hidden scroll-smooth">
          <div className="relative w-full" style={{ height: leftCanvasHeight }}>
            {notes.map((note) => {
              const isActiveDrag = dragInfo?.type === 'note' && dragInfo?.id === note.id;
              const isCollapsed  = !!note.isCollapsed;
              const height       = isCollapsed ? 44 : (note.height || 280);

              // 텍스트 hover → 이 포스트잇 강조 / 포스트잇 click → 하이라이트로
              const isFlashing =
                flashingId === note.id ||
                (hoveredHighlightId &&
                  highlights.find((h) => h.id === hoveredHighlightId)?.links?.some((l) => l.id === note.id));

              const isLocalHovered = hoveredNoteId === note.id;
              const badgeNum = highlightIndexMap[note.id];

              // 팝업 효과: drag > flash > localHover 순서로 우선순위
              const noteTransform = isActiveDrag
                ? 'scale(1.01)'
                : isFlashing
                  ? 'translateY(-3px) scale(1.03)'
                  : isLocalHovered
                    ? 'translateY(-2px) scale(1.01)'
                    : 'none';
              const noteShadow = isActiveDrag
                ? 'rgba(0,0,0,0.10) 0px 8px 22px -10px, rgba(0,0,0,0.06) 0px 2px 6px 0px'
                : isFlashing
                  ? '0 12px 32px rgba(0,0,0,0.14), 0 4px 10px rgba(0,0,0,0.08)'
                  : isLocalHovered
                    ? '0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)'
                    : 'rgba(0,0,0,0.05) 0px 1px 3px 0px';
              const noteZ = isActiveDrag ? 40 : isFlashing ? 50 : isLocalHovered ? 35 : 30;

              return (
                <div
                  key={note.id}
                  ref={(el) => (postItRefs.current[note.id] = el)}
                  style={{
                    left: note.x, top: note.y, width: note.width || 250, height,
                    transform: noteTransform,
                    boxShadow: noteShadow,
                    zIndex: noteZ,
                    transition: isActiveDrag ? 'none' : 'transform 0.2s ease, box-shadow 0.2s ease',
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
                  className={`absolute rounded-xl flex flex-col pointer-events-auto bg-yellow-100 ${
                    isCollapsed ? 'overflow-hidden' : ''
                  } ${isFlashing ? 'border border-slate-300' : 'border border-slate-200/80'}`}
                >
                  {!isCollapsed && (
                    <>
                      <div className="absolute top-0 right-0 w-2 h-full cursor-e-resize z-10"
                        onMouseDown={(e) => startResize(e, note.id, 'note', 'right', note.width || 250, note.height || 280)} />
                      <div className="absolute bottom-0 left-0 w-full h-2 cursor-s-resize z-10"
                        onMouseDown={(e) => startResize(e, note.id, 'note', 'bottom', note.width || 250, note.height || 280)} />
                      <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-20"
                        onMouseDown={(e) => startResize(e, note.id, 'note', 'both', note.width || 250, note.height || 280)} />
                    </>
                  )}

                  {/* 헤더 */}
                  <div
                    className={`relative flex items-center justify-between px-4 select-none ${
                      isCollapsed ? 'h-11' : 'h-11 border-b border-black/5'
                    } cursor-grab active:cursor-grabbing`}
                    onMouseDown={(e) => startDrag(e, note.id, 'note', note.x, note.y)}
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
                        onClick={(e) => { e.stopPropagation(); removeNote(note.id); }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="p-1.5 hover:bg-black/5 rounded-lg text-slate-700/70 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {!isCollapsed && (
                    /* ── 메모장 body: 자유롭게 편집 가능한 textarea ── */
                    <textarea
                      value={note.text || ''}
                      onChange={(e) => handleNoteChange(note.id, e.target.value)}
                      className="flex-1 w-full bg-transparent resize-none focus:outline-none p-4 text-[13px] text-slate-800 font-medium leading-relaxed placeholder:text-slate-400/70 text-left"
                      placeholder={t('notePlaceholder')}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══════════════ 중앙 패널 ══════════════ */}
      <div
        ref={centerRef}
        className="relative flex-[0_0_40%] min-w-0 h-full bg-white flex flex-col"
        onMouseUp={handleMouseUpCenter}
      >
        <PaperOverlay />

        {/* 헤더 */}
        <div className="relative shrink-0 px-7 py-4 border-b border-slate-200/60 flex items-center gap-3 bg-white/70 backdrop-blur-sm">
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shadow-sm">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-slate-900 truncate">{centerTitle}</div>
            <div className="text-[11px] text-slate-500 truncate">{t('centerSubtitle')}</div>
          </div>
        </div>

        {/* 메시지 스크롤 영역 */}
        <div
          ref={centerScrollRef}
          className="relative flex-1 overflow-y-auto overflow-x-hidden px-7 py-8 space-y-7 pb-28"
        >
          {mainMessages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex items-start ${isUser ? 'justify-end' : 'justify-start'} gap-3`}
                data-message-id={msg.id}
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
                      highlights={highlights}
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
              className="w-full pl-4 pr-12 py-3.5 rounded-2xl focus:outline-none bg-transparent text-[14px] text-slate-900 placeholder:text-slate-400"
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

        {/* 텍스트 선택 메뉴 */}
        {selectionMenu.visible && (
          <div
            style={{
              position: 'fixed',
              left: selectionMenu.x,
              top:  selectionMenu.y,
              transform: 'translate(-50%, -100%)',
            }}
            onMouseDown={(e) => e.preventDefault()}
            className="z-50 flex items-center gap-1.5 p-1.5 bg-slate-900 rounded-xl shadow-xl border border-slate-700"
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
          </div>
        )}
      </div>

      {/* ══════════════ 우측 패널: 추가질문 병렬 대화창 ══════════════ */}
      <div className="flex flex-col flex-[0_0_30%] min-w-0 h-full border-l border-slate-200 bg-white">
        <PaperOverlay />

        {/* ── 패널 헤더 ── */}
        <div className="relative shrink-0 px-4 py-3 border-b border-slate-200/60 bg-white/70 backdrop-blur-sm flex items-center gap-2">
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
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400 px-6 text-center">
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
        ) : (
          <div className="flex flex-col flex-1 min-h-0">

            {/* ── 스레드 탭 목록 ── */}
            <div className="shrink-0 flex overflow-x-auto border-b border-slate-200 bg-white/60 scrollbar-none">
              {sideChats.map((chat) => {
                const isActive  = chat.id === activeThreadId;
                const badgeNum  = highlightIndexMap[chat.id];
                const isFlashing =
                  flashingId === chat.id ||
                  (hoveredHighlightId &&
                    highlights.find((h) => h.id === hoveredHighlightId)?.links?.some((l) => l.id === chat.id));

                const isTabHovered = hoveredTabId === chat.id;
                const tabTransform = isFlashing
                  ? 'translateY(-2px)'
                  : isActive || isTabHovered
                    ? 'translateY(-1px)'
                    : 'none';
                const tabShadow = isFlashing
                  ? '0 4px 14px rgba(34,211,238,0.35)'
                  : isActive
                    ? '0 2px 8px rgba(34,211,238,0.20)'
                    : isTabHovered
                      ? '0 2px 6px rgba(0,0,0,0.08)'
                      : 'none';

                return (
                  <div
                    key={chat.id}
                    style={{
                      transform: tabTransform,
                      boxShadow: tabShadow,
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease',
                    }}
                    className={`group relative flex items-center gap-1.5 px-3 py-2.5 cursor-pointer shrink-0 border-b-2 select-none ${
                      isActive
                        ? 'border-cyan-500 bg-cyan-50/60 text-slate-900'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    } ${isFlashing ? 'bg-cyan-100/80' : ''}`}
                    onMouseEnter={() => {
                      setHoveredTabId(chat.id);
                      const hl = highlights.find((h) => h.links?.some((l) => l.id === chat.id));
                      setHoveredPostItId(hl?.id ?? null);
                    }}
                    onMouseLeave={() => {
                      setHoveredTabId(null);
                      setHoveredPostItId(null);
                    }}
                    onClick={() => setActiveSideChatId(chat.id)}
                  >
                    {badgeNum !== undefined && (
                      <span className={`flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold shrink-0 ${
                        isActive ? 'bg-cyan-500 text-white' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {badgeNum}
                      </span>
                    )}
                    <span className={`text-[12px] font-medium max-w-[90px] truncate ${isActive ? 'font-semibold' : ''}`}>
                      {chat.title}
                    </span>
                    <button
                      className="ml-0.5 p-0.5 rounded hover:bg-black/10 text-slate-400 hover:text-slate-600 transition-all shrink-0"
                      onClick={(e) => { e.stopPropagation(); scrollToHighlight(chat.id); }}
                      title={t('moveToText')}
                    >
                      <MoveUpRight className="w-3 h-3" />
                    </button>
                    <button
                      className="ml-0.5 p-0.5 rounded hover:bg-black/10 text-slate-400 hover:text-slate-600 transition-all shrink-0"
                      onClick={(e) => { e.stopPropagation(); removeSideChat(chat.id); }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* ── 활성 스레드 ── */}
            {activeThread && (
              <>
                {/* 출처 텍스트 */}
                <div className="shrink-0 mx-4 mt-3 mb-1 px-3 py-2 rounded-lg bg-cyan-50 border border-cyan-100">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-[11px] font-semibold text-cyan-600 uppercase tracking-wide">{t('sourceText')}</p>
                  </div>
                  <p className="text-[13px] text-slate-700 leading-snug line-clamp-2">
                    &ldquo;{activeThread.sourceText}&rdquo;
                  </p>
                </div>

                {/* 메시지 목록 */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 space-y-3 text-left">
                  {activeThread.messages.map((msg) => {
                    const isU = msg.sender === 'user';
                    return (
                      <div key={msg.id} className={`flex items-start ${isU ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[92%] rounded-2xl px-4 py-2.5 text-left font-medium ${
                            isU
                              ? 'bg-slate-900 text-white rounded-tr-md text-[15px] leading-[1.6]'
                              : 'bg-white border border-slate-200/80 text-slate-900 rounded-tl-md shadow-postit side-chat-markdown-wrap'
                          }`}
                        >
                          {isU ? (
                            <span className="whitespace-pre-wrap block">{msg.text}</span>
                          ) : msg.text ? (
                            <div className="side-chat-markdown">
                              <ReactMarkdown
                                rehypePlugins={markdownRehypePlugins}
                                components={markdownComponents}
                              >
                                {msg.text}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            <span className="inline-flex gap-1">
                              <span className="typing-dot" />
                              <span className="typing-dot" />
                              <span className="typing-dot" />
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={sideChatBottomRef} />
                </div>

                {/* 입력 */}
                <form
                  onSubmit={(e) => handleSideSubmit(activeThread.id, e)}
                  className="shrink-0 px-4 pb-4 pt-2 border-t border-slate-200/60 bg-white/80 backdrop-blur-sm"
                >
                  <div className="relative flex items-center rounded-xl border border-slate-200 bg-white shadow-sm focus-within:ring-2 focus-within:ring-cyan-400/40 focus-within:border-cyan-400/70 transition-all">
                    <input
                      type="text"
                      value={activeThread.input || ''}
                      onChange={(e) => updateSideChatInput(activeThread.id, e.target.value)}
                      placeholder={t('sideChatInputPlaceholder')}
                      disabled={loadingSideChatIds.has(activeThread.id)}
                      className="flex-1 pl-4 pr-10 py-2.5 bg-transparent text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-60 rounded-xl"
                    />
                    <button
                      type="submit"
                      disabled={loadingSideChatIds.has(activeThread.id)}
                      className="absolute right-2 p-1.5 text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors disabled:opacity-40"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
