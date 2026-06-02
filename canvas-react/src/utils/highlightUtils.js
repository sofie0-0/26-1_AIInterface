/* ─────────────────── 하이라이트 DOM 유틸 ─────────────────── */

/** 오버레이(data-highlight-overlay-root) 내부를 제외한 가시 텍스트 노드 목록 */
export function walkTextNodes(root) {
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
export function countVisibleCharsUpTo(textRoot, targetNode, targetOffset) {
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
export function rectsRelativeToTextRoot(textRoot, range) {
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
export function findRangeFromOffsets(textRoot, startOffset, endOffset) {
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
export function migrateHighlights(hs) {
  if (!Array.isArray(hs)) return [];
  return hs.map((h) => {
    if (Array.isArray(h.links)) return h;
    const type = h.type || 'note';
    return { ...h, links: [{ id: h.id, type }] };
  });
}
