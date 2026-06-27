function msToSec(ms) {
    return ms > 0 ? Math.round(ms / 10) / 100 : 0;
  }
  
export function computeMetrics(logs, interfaceType) {
    const isProposed = interfaceType === 'proposed';
  
    let scrollDistPx = 0, scrollDurMs = 0;
    let mouseDistPx  = 0, mouseDurMs  = 0;
    let backwardNavDistPx = 0;
    let backwardNavCount = 0;
    let backwardNavDurMs = 0;
  
    let contextSwitches = 0;
    let m3Count = 0, m3DurMs = 0;
    let interactions = 0;
    let aiWaitMs = 0, typingDurMs = 0, dragDurMs = 0;
  
    let cntParallelWindowCreate     = 0;
    let cntParallelWindowDelete     = 0;
    let cntMemoCreate               = 0;
    let cntMemoEdit                 = 0;
    let cntMemoDelete               = 0;
    let cntMemoMapsToBody           = 0;
    let cntBranchMapsToBody         = 0;
    let cntMemoDragDrop             = 0;
    let cntParallelWindowReactivate = 0;
    let totalPromptTokens = 0, totalOutputTokens = 0, totalTokens = 0;
    let cntUserPrompts = 0;
  
    const timestamps = logs
      .map((e) => new Date(e.timestamp).getTime())
      .filter((t) => !isNaN(t));
    const totalMs = timestamps.length >= 2
      ? Math.max(...timestamps) - Math.min(...timestamps)
      : 0;
  
    for (const entry of logs) {
      const d  = entry.details ?? {};
      const et = entry.eventType;
      switch (et) {
        case 'SCROLL':
          scrollDistPx += d.distancePx ?? 0;
          scrollDurMs  += d.durationMs ?? 0;
  
          backwardNavDistPx += d.backwardDistancePx ?? 0;
          backwardNavCount += d.backwardCount ?? 0;
          backwardNavDurMs += d.backwardDurationMs ?? 0;
          break;
        case 'MOUSE_MOVE':
          mouseDistPx += d.distancePx ?? 0;
          mouseDurMs  += d.durationMs ?? 0;
          break;
        case 'CONTEXT_SWITCH':
          if (d.action === 'leave') contextSwitches += 1;
          break;
        case 'SCROLL_PAUSE_UPWARD':
          if (!d.section?.startsWith('parallel_window')) {
            m3Count += 1;
            m3DurMs += d.scrollUpStartToEnd1sMs ?? 0;
          }
          break;
        case 'MAPS_TO_ELEMENT':
          if (isProposed) { interactions += 1; }
          break;
        case 'PARALLEL_WINDOW_REACTIVATE':
          if (isProposed) { m3Count += 1; interactions += 1; cntParallelWindowReactivate += 1; }
          break;
        case 'ELEMENT_INTERACTION':
          if (isProposed) {
            if (d.action === 'click') interactions += 1;
          }
          break;
        case 'AI_RESPONSE_WAIT':
          aiWaitMs += d.durationMs ?? 0;
          break;
        case 'KEYBOARD_TYPING':
          typingDurMs += d.durationMs ?? 0;
          break;
        case 'PROMPT_SUBMIT_TRADITIONAL':
          cntUserPrompts += 1;
  
          if (!isProposed) interactions += 1;
          break;
        case 'PROMPT_SUBMIT':
          cntUserPrompts += 1;
  
          if (isProposed) interactions += 1;
          break;
        case 'MEMO_CREATE':
          if (isProposed) { interactions += 1; cntMemoCreate += 1; }
          break;
        case 'MEMO_EDIT':
          if (isProposed) { interactions += 1; cntMemoEdit += 1; }
          break;
        case 'MEMO_DELETE':
          if (isProposed) { interactions += 1; cntMemoDelete += 1; }
          break;
          case 'MAPS_TO_BODY':
            if (isProposed) interactions += 1;
          
            if (d?.sourceType === 'memo') {
              cntMemoMapsToBody += 1;
            }
          
            if (d?.sourceType === 'parallel_window') {
              cntBranchMapsToBody += 1;
            }
          
            break;
        case 'PARALLEL_WINDOW_CREATE':
          if (isProposed) { interactions += 1; cntParallelWindowCreate += 1; }
          break;
        case 'PARALLEL_WINDOW_DELETE':
          if (isProposed) { interactions += 1; cntParallelWindowDelete += 1; }
          break;
        case 'MEMO_DRAG_DROP':
          dragDurMs += d.durationMs ?? 0;
          if (isProposed) { interactions += 1; cntMemoDragDrop += 1; }
          break;
        case 'API_TOKEN_USAGE':
          totalPromptTokens += d.promptTokens ?? 0;
          totalOutputTokens += d.outputTokens ?? 0;
          totalTokens     += d.totalTokens ?? 0;
          break;
        default:
          break;
      }
    }
  
    const m3DurSec     = msToSec(m3DurMs);
    const m3Efficiency = m3DurSec > 0
      ? Math.round((m3Count / m3DurSec) * 100) / 100
      : 0;
  
    const activeDurMs = aiWaitMs + mouseDurMs + scrollDurMs + typingDurMs + dragDurMs;
    const idleMs      = Math.max(0, totalMs - activeDurMs);
  
    return {
      scrollDistPx, scrollDurSec: msToSec(scrollDurMs),
      mouseDistPx,  mouseDurSec:  msToSec(mouseDurMs),
      backwardNavDistPx,
      backwardNavCount,
      backwardNavDurSec: msToSec(backwardNavDurMs),
      contextSwitches,
      m3Count, m3DurSec, m3Efficiency,
      interactions,
      idleSec: msToSec(idleMs),
      cntParallelWindowCreate,
      cntParallelWindowDelete,
      cntMemoCreate,
      cntMemoEdit,
      cntMemoDelete,
      cntMemoMapsToBody,
      cntBranchMapsToBody,
      cntMemoDragDrop,
      cntUserPrompts,
      cntParallelWindowReactivate,
      totalPromptTokens,
      totalOutputTokens,
      totalTokens,
    };
  }
  