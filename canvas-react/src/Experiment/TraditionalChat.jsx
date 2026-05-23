/**
 * Traditional (선형) 채팅 인터페이스 — 실험 대조군
 *
 * - 포스트잇·병렬창·드래그앤드롭 등 비선형 요소 없음
 * - 채팅 기록 오버레이 사이드바 포함 (Proposed와 동일한 UX 패턴)
 * - 인증: 공통 LoginPage → ExperimentContext에서 userId/apiKey 읽음
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Bot,
  Menu,
  MessageSquare,
  Pencil,
  Plus,
  Send,
  Trash2,
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { useNavigate } from 'react-router-dom';
import { useExperiment } from './ExperimentContext.jsx';
import { useExperimentLog } from './ExperimentLogContext.jsx';
import StartButton from './StartButton.jsx';

/* ── 상수 ── */
const GEMINI_API_VERSION = 'v1';
const GEMINI_MODEL       = 'gemini-2.5-flash';
const FONT_STACK_KO      = '"Pretendard","Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans KR",sans-serif';
const SIDEBAR_W          = 280;
const INIT_MSG           = '안녕하세요! 무엇이든 질문해 주세요. 성심껏 답변해 드리겠습니다.';

/* ── sessionStorage 헬퍼 ── */
function makeStorageKey(userId, blockIndex) {
  return `trad-chat-history-${userId}-block${blockIndex}`;
}

function loadFromStorage(userId, blockIndex) {
  try {
    const raw = sessionStorage.getItem(makeStorageKey(userId, blockIndex));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveToStorage(userId, blockIndex, chatHistory, activeChatId) {
  sessionStorage.setItem(
    makeStorageKey(userId, blockIndex),
    JSON.stringify({ chatHistory, activeChatId }),
  );
}

/* ── 초기 채팅 항목 생성 헬퍼 ── */
function makeInitialChat(id = 1) {
  return {
    id,
    title: '새로운 채팅',
    messages: [{ id: 1, sender: 'ai', text: INIT_MSG }],
    history: [],   // Gemini API용 대화 기록
  };
}

export default function TraditionalChat() {
  const navigate   = useNavigate();
  const { userId, apiKey, blockIndex } = useExperiment();
  const { logPromptSubmitTraditional, startAIWait, stopAIWait, logAiAnswerHeightSnapshot } = useExperimentLog();

  /* ── 채팅 기록 ── */
  const [chatHistory,  setChatHistory]  = useState(() => {
    const saved = loadFromStorage(userId, blockIndex);
    return saved?.chatHistory ?? [makeInitialChat(1)];
  });
  const [activeChatId, setActiveChatId] = useState(() => {
    const saved = loadFromStorage(userId, blockIndex);
    return saved?.activeChatId ?? 1;
  });

  const activeChat = chatHistory.find((c) => c.id === activeChatId) ?? chatHistory[0];

  /* ── 활성 채팅의 메시지 (파생값) ── */
  const [messages, setMessages] = useState(() => activeChat?.messages ?? []);

  /* ── UI 상태 ── */
  const [inputText,       setInputText]       = useState('');
  const [isStreaming,     setIsStreaming]      = useState(false);
  const [streamingMsgId,  setStreamingMsgId]  = useState(null);
  const [isSidebarOpen,   setIsSidebarOpen]   = useState(false);

  const scrollRef  = useRef(null);
  const inputRef   = useRef(null);
  const msgCounter = useRef((activeChat?.messages?.at(-1)?.id ?? 1) + 1);

  /* ── 블록 종료 직전 AI 답변 높이 스냅샷 ── */
  const saveAiAnswerHeight = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const aiRows = container.querySelectorAll('[data-msg-role="ai"]');
    const answerHeightPx = Array.from(aiRows).reduce((sum, el) => sum + el.offsetHeight, 0);
    logAiAnswerHeightSnapshot({
      trigger:        'block_end',
      section:        'main_canvas',
      answerHeightPx,
      answerCount:    aiRows.length,
    });
  }, [logAiAnswerHeightSnapshot]);

  /* ── conversationHistory: 활성 채팅 기준 메모리 참조 ── */
  const conversationHistory = useRef(activeChat?.history ?? []);

  /* ── Gemini AI 인스턴스 ── */
  const ai = useMemo(() => {
    if (!apiKey) return null;
    return new GoogleGenAI({ apiKey, httpOptions: { apiVersion: GEMINI_API_VERSION } });
  }, [apiKey]);

  /* ── 스크롤 자동 하단 이동 ── */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  /* ── chatHistory → sessionStorage 동기화 ── */
  useEffect(() => {
    if (!userId) return;
    saveToStorage(userId, blockIndex, chatHistory, activeChatId);
  }, [chatHistory, activeChatId, userId, blockIndex]);

  /* ── 메시지가 바뀔 때 chatHistory 내 해당 채팅 데이터 갱신 ── */
  useEffect(() => {
    setChatHistory((prev) =>
      prev.map((c) =>
        c.id === activeChatId
          ? { ...c, messages, history: conversationHistory.current }
          : c
      )
    );
  }, [messages, activeChatId]);

  /* ── 새 채팅 생성 ── */
  const handleNewChat = useCallback(() => {
    const newId   = Date.now();
    const newChat = makeInitialChat(newId);
    newChat.title = '새로운 채팅';
    setChatHistory((prev) => [newChat, ...prev]);
    setActiveChatId(newId);
    setMessages(newChat.messages);
    conversationHistory.current = [];
    msgCounter.current = 2;
    setIsSidebarOpen(false);
  }, []);

  /* ── 채팅 불러오기 ── */
  const loadChat = useCallback((id) => {
    if (id === activeChatId) { setIsSidebarOpen(false); return; }
    const c = chatHistory.find((ch) => ch.id === id);
    if (!c) return;
    setActiveChatId(id);
    setMessages(c.messages);
    conversationHistory.current = c.history ?? [];
    msgCounter.current = (c.messages.at(-1)?.id ?? 1) + 1;
    setIsSidebarOpen(false);
  }, [activeChatId, chatHistory]);

  /* ── 채팅 삭제 ── */
  const handleDeleteChat = useCallback((id, e) => {
    e?.stopPropagation();
    if (!window.confirm('이 채팅을 삭제하시겠습니까?')) return;
    setChatHistory((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (next.length === 0) {
        const fresh = makeInitialChat(Date.now());
        setActiveChatId(fresh.id);
        setMessages(fresh.messages);
        conversationHistory.current = [];
        msgCounter.current = 2;
        return [fresh];
      }
      if (id === activeChatId) {
        const fallback = next[0];
        setActiveChatId(fallback.id);
        setMessages(fallback.messages);
        conversationHistory.current = fallback.history ?? [];
        msgCounter.current = (fallback.messages.at(-1)?.id ?? 1) + 1;
      }
      return next;
    });
  }, [activeChatId]);

  /* ── 채팅 이름 변경 ── */
  const handleRenameChat = useCallback((id, e) => {
    e?.stopPropagation();
    const current = chatHistory.find((c) => c.id === id);
    const newTitle = window.prompt('새로운 채팅 이름을 입력하세요.', current?.title ?? '');
    if (newTitle?.trim()) {
      setChatHistory((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: newTitle.trim() } : c))
      );
    }
  }, [chatHistory]);

  /* ── 메시지 전송 ── */
  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isStreaming || !ai) return;

    logPromptSubmitTraditional({ chatId: activeChatId });

    const userMsgId = msgCounter.current++;
    const aiMsgId   = msgCounter.current++;

    setInputText('');
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, sender: 'user', text },
      { id: aiMsgId,   sender: 'ai',   text: '' },
    ]);
    setIsStreaming(true);
    setStreamingMsgId(aiMsgId);
    startAIWait();

    conversationHistory.current = [
      ...conversationHistory.current,
      { role: 'user', parts: [{ text }] },
    ];

    /* 채팅 제목: 첫 사용자 메시지로 자동 설정 */
    setChatHistory((prev) =>
      prev.map((c) => {
        if (c.id !== activeChatId) return c;
        const isDefaultTitle = c.title === '새로운 채팅';
        return isDefaultTitle
          ? { ...c, title: text.slice(0, 30) + (text.length > 30 ? '…' : '') }
          : c;
      })
    );

    try {
      const systemInstruction = '반드시 한국어로 답변하세요.';
      const fullHistory = [
        { role: 'user',  parts: [{ text: systemInstruction }] },
        { role: 'model', parts: [{ text: '네, 한국어로 답변하겠습니다.' }] },
        ...conversationHistory.current.slice(0, -1),
      ];

      const chatSession = ai.chats.create({ model: GEMINI_MODEL, history: fullHistory });
      const stream = await chatSession.sendMessageStream({ message: text });

      let fullText = '';
      for await (const chunk of stream) {
        fullText += chunk.text ?? '';
        setMessages((prev) =>
          prev.map((m) => (m.id === aiMsgId ? { ...m, text: fullText } : m))
        );
      }

      conversationHistory.current = [
        ...conversationHistory.current,
        { role: 'model', parts: [{ text: fullText }] },
      ];
    } catch (err) {
      console.error('AI 오류:', err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId ? { ...m, text: '죄송합니다. 오류가 발생했습니다.' } : m
        )
      );
    } finally {
      stopAIWait();
      setIsStreaming(false);
      setStreamingMsgId(null);
      inputRef.current?.focus();
    }
  }, [inputText, isStreaming, ai, activeChatId, logPromptSubmitTraditional, startAIWait, stopAIWait]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  /* ════════════════════════════════════════
     렌더
  ════════════════════════════════════════ */
  return (
    <div
      style={{ fontFamily: FONT_STACK_KO }}
      className="flex flex-col h-screen w-screen bg-white antialiased text-slate-900 tracking-tight overflow-hidden"
    >
      <style>{`
        .trad-ai-bubble p { margin: 0.35em 0; }
        .trad-ai-bubble ul, .trad-ai-bubble ol { margin: 0.4em 0; padding-left: 1.4em; }
        .trad-ai-bubble li { margin: 0.2em 0; }
        .trad-ai-bubble strong { font-weight: 700; }
        .trad-ai-bubble h1,.trad-ai-bubble h2,.trad-ai-bubble h3,.trad-ai-bubble h4 {
          font-weight: 700; margin: 0.6em 0 0.3em; font-size: 1em;
        }
        .trad-ai-bubble code {
          background: #f1f5f9; border-radius: 4px; padding: 1px 5px; font-size: 0.875em;
        }
        .trad-ai-bubble pre { background: #f1f5f9; border-radius: 8px; padding: 12px 14px; overflow-x: auto; }
        .trad-ai-bubble pre code { background: none; padding: 0; }
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

      {/* ══════════════ 채팅 기록 오버레이 사이드바 ══════════════ */}
      <div
        className="absolute top-0 left-0 h-full bg-white/92 backdrop-blur-md border-r border-slate-200 transition-[width] duration-300 z-50 flex flex-col overflow-hidden"
        style={{
          width:       isSidebarOpen ? SIDEBAR_W : 0,
          boxShadow:   isSidebarOpen ? '0 25px 50px -12px rgba(0,0,0,0.25)' : 'none',
          borderColor: isSidebarOpen ? undefined : 'transparent',
        }}
      >
        <div className="p-6 whitespace-nowrap overflow-hidden shrink-0">
          <button
            onClick={handleNewChat}
            className="flex items-center justify-center gap-2 bg-slate-900 text-white rounded-xl px-5 py-3 w-full hover:bg-slate-800 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">새 채팅</span>
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
                  title="이름 변경"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </div>
                <div
                  onClick={(e) => handleDeleteChat(chat.id, e)}
                  className="p-1.5 hover:bg-red-50 rounded-md text-red-500 shadow-sm border border-transparent hover:border-red-100"
                  title="삭제"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 사이드바 토글 버튼 */}
      <button
        onClick={() => setIsSidebarOpen((v) => !v)}
        className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-16 bg-white border border-l-0 border-slate-200 rounded-r-xl shadow-sm hover:bg-slate-50 text-slate-500 z-50 cursor-pointer"
        style={{
          left:       isSidebarOpen ? SIDEBAR_W : 0,
          transition: 'left 300ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* ══════════════ 메인 레이아웃 ══════════════ */}
      <div className="flex flex-col flex-1 min-h-0">

        {/* ── 헤더 ── */}
        <div className="shrink-0 px-6 py-3 border-b border-slate-200/60 bg-white/70 backdrop-blur-sm flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shadow-sm shrink-0">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-semibold text-slate-800 truncate">
              {activeChat?.title ?? 'AI 어시스턴트'}
            </div>
            <div className="text-[10.5px] text-slate-400 truncate">
              Traditional Interface · {userId} · Block {blockIndex}
            </div>
          </div>

          <button
            onClick={() => navigate('/experiment-select')}
            className="text-[12px] text-slate-400 hover:text-slate-600 transition-colors px-2 py-1 rounded-md hover:bg-slate-100 shrink-0"
          >
            ← 인터페이스 선택
          </button>

          {/* ── [실험 시작] 임시 버튼 ── 실험 종료 후 이 한 줄만 제거 */}
          <StartButton onBeforeEndBlock={saveAiAnswerHeight} />
        </div>

        {/* ── 메시지 목록 ── */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto py-8 space-y-6">
          <div className="max-w-[760px] mx-auto w-full px-6 space-y-6">
            {messages.map((msg) => {
              const isUser            = msg.sender === 'user';
              const isLoadingSkeleton = !isUser && streamingMsgId === msg.id && !msg.text;

              return (
                <div
                  key={msg.id}
                  data-msg-role={isUser ? 'user' : 'ai'}
                  className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}

                  <div className={`min-w-0 ${isUser ? 'max-w-[88%]' : 'max-w-[92%]'}`}>
                    <div
                      className={
                        isUser
                          ? 'whitespace-pre-wrap text-[14px] font-medium leading-relaxed bg-slate-100 text-slate-800 border border-slate-200/70 rounded-2xl rounded-tr-md px-5 py-3 shadow-sm text-left'
                          : 'trad-ai-bubble text-[14px] font-medium bg-white text-slate-800 border border-slate-200/70 rounded-2xl rounded-tl-md px-6 py-4 shadow-sm'
                      }
                    >
                      {isLoadingSkeleton ? (
                        <span className="flex items-center gap-1.5 h-5">
                          <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                        </span>
                      ) : isUser ? (
                        msg.text
                      ) : (
                        <ReactMarkdown rehypePlugins={[rehypeRaw]}>{msg.text || ''}</ReactMarkdown>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ height: 4 }} />
        </div>

        {/* ── 입력창 ── */}
        <div className="shrink-0 py-4 bg-white border-t border-slate-200/60">
          <div className="max-w-[760px] mx-auto w-full px-6">
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex items-end gap-3 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 shadow-sm focus-within:border-slate-300 focus-within:shadow-md transition-all"
            >
              <textarea
                ref={inputRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="메시지를 입력하세요…"
                rows={1}
                className="flex-1 resize-none bg-transparent text-[14px] text-slate-800 placeholder-slate-400 outline-none leading-relaxed"
                style={{ minHeight: 24, maxHeight: 160, overflowY: 'auto', fontFamily: FONT_STACK_KO }}
                onInput={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
                }}
                disabled={isStreaming}
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isStreaming}
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: inputText.trim() && !isStreaming ? '#0f172a' : '#e2e8f0' }}
              >
                <Send className={`w-4 h-4 ${inputText.trim() && !isStreaming ? 'text-white' : 'text-slate-400'}`} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
