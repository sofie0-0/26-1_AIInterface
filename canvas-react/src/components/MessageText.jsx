import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { findRangeFromOffsets, rectsRelativeToTextRoot } from '../utils/highlightUtils.js';

/* ─────────────────── MessageTextWithHighlightOverlays ─────────────────── */
export default function MessageTextWithHighlightOverlays({
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

// rehype 플러그인/컴포넌트 기본값 (App.jsx에서 useMemo로 메모화해 전달해도 되고,
// 여기서 export해서 공유해도 됨)
export const defaultRehypePlugins = [rehypeRaw, [rehypeSanitize, defaultSchema]];
