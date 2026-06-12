/* ─────────────────── 다국어 번역 ─────────────────── */
export const translations = {
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
    errorMsg503: 'AI 서버가 혼잡합니다. 잠시 후 다시 시도해 주세요.',
    errorMsg429: 'API 사용 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.',
    errorMsg: '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    sideChatErrorMsg503: 'AI 서버가 혼잡합니다. 잠시 후 다시 시도해 주세요.',
    sideChatErrorMsg429: 'API 사용 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.',
    sideChatErrorMsg: '요청을 처리하지 못했습니다. 다시 시도해 주세요.',
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
    errorMsg503: 'The AI server is busy. Please try again in a moment.',
    errorMsg429: 'API usage limit reached. Please try again later.',
    errorMsg: 'Could not process your request. Please try again.',
    sideChatErrorMsg503: 'The AI server is busy. Please try again.',
    sideChatErrorMsg429: 'API usage limit reached. Please try again later.',
    sideChatErrorMsg: 'Could not process your request. Please try again.',
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

/* ─────────────────── 초기 데이터 ─────────────────── */
export const initialData = {
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
