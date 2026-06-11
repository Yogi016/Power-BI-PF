import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Database,
  ExternalLink,
  FileSearch,
  FileText,
  Image as ImageIcon,
  Link2,
  MessageCircle,
  Mic,
  MicOff,
  RefreshCw,
  Send,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { answerProjectQuestion } from '../lib/chatbotData';
import { generateWeeklyReport } from '../lib/weeklyReportUtils';
import type { ReportAction } from '../lib/reportAgent';
import type { ChatbotSource } from '../lib/chatbotTypes';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onstart: (() => void) | null;
  abort: () => void;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  usedAI?: boolean;
  sources?: ChatbotSource[];
  action?: ReportAction;
  actionStatus?: 'pending' | 'running' | 'completed' | 'cancelled' | 'failed';
}

const createMessageId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const thinkingSteps = [
  { label: 'Membaca data project', icon: Database },
  { label: 'Mencari evidence relevan', icon: FileSearch },
  { label: 'Menyusun insight', icon: Sparkles },
];

const DANTA_LOGO_SRC = '/danta-ai-logo.png';

const getSpeechRecognitionConstructor = (): SpeechRecognitionConstructor | null => {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

const cleanAssistantText = (text: string): string => (
  text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}[-*•]\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
);

const DantaStyles = () => (
  <style>{`
    @keyframes danta-breathe {
      0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.28); }
      50% { transform: scale(1.045); box-shadow: 0 0 0 8px rgba(52, 211, 153, 0); }
    }
    @keyframes danta-scan {
      0% { transform: translateX(-45%); opacity: 0; }
      18% { opacity: 0.9; }
      100% { transform: translateX(145%); opacity: 0; }
    }
    @keyframes danta-dot {
      0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
      40% { transform: translateY(-4px); opacity: 1; }
    }
    @keyframes danta-rise {
      from { transform: translateY(8px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `}</style>
);

const DantaMark: React.FC<{ active?: boolean; small?: boolean }> = ({ active = false, small = false }) => (
  <div
    className={`relative grid shrink-0 place-items-center overflow-hidden rounded-lg bg-white text-emerald-900 shadow-sm ring-1 ring-emerald-200 ${
      small ? 'h-8 w-8' : 'h-11 w-11'
    } ${active ? 'danta-breathe' : ''}`}
    style={active ? { animation: 'danta-breathe 1.8s ease-in-out infinite' } : undefined}
  >
    <img
      src={DANTA_LOGO_SRC}
      alt=""
      aria-hidden="true"
      className="h-full w-full object-cover"
      draggable={false}
    />
    {active && (
      <span
        className="absolute inset-y-0 w-8 bg-white/45 blur-sm"
        style={{ animation: 'danta-scan 1.7s ease-in-out infinite' }}
      />
    )}
  </div>
);

const AnswerText: React.FC<{ text: string; isUser: boolean }> = ({ text, isUser }) => {
  if (isUser) {
    return <p className="whitespace-pre-wrap break-words">{text}</p>;
  }

  const paragraphs = cleanAssistantText(text)
    .split(/\n{1,2}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <div className="space-y-2">
      {paragraphs.map((paragraph, index) => (
        <p key={`${paragraph.slice(0, 24)}-${index}`} className="break-words">
          {paragraph}
        </p>
      ))}
    </div>
  );
};

const SourceCards: React.FC<{ sources?: ChatbotSource[] }> = ({ sources }) => {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-normal text-slate-400">Sumber relevan</p>
      <div className="grid gap-2">
        {sources.map((source) => {
          const Icon = source.type === 'document'
            ? FileText
            : source.meta?.toLowerCase().includes('image')
              ? ImageIcon
              : Link2;

          return (
            <a
              key={source.id}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group grid grid-cols-[32px_1fr_18px] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-left transition hover:border-emerald-200 hover:bg-emerald-50"
              title={source.url}
            >
              <span className="grid h-8 w-8 place-items-center rounded-md bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200 group-hover:ring-emerald-200">
                <Icon size={16} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-bold text-slate-800">{source.title}</span>
                <span className="mt-0.5 block truncate text-[11px] text-slate-500">{source.subtitle}</span>
                {source.meta && (
                  <span className="mt-1 block truncate text-[10px] font-semibold uppercase tracking-normal text-slate-400">
                    {source.meta}
                  </span>
                )}
              </span>
              <ExternalLink size={15} className="text-slate-400 transition group-hover:text-emerald-700" />
            </a>
          );
        })}
      </div>
    </div>
  );
};

const ThinkingPanel: React.FC<{ stepIndex: number }> = ({ stepIndex }) => (
  <div className="flex justify-start gap-2" style={{ animation: 'danta-rise 180ms ease-out' }}>
    <DantaMark active small />
    <div className="w-full max-w-[86%] rounded-lg border border-emerald-100 bg-white px-3 py-3 text-sm text-slate-600 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="font-bold text-slate-800">Danta sedang membaca konteks...</p>
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="h-1.5 w-1.5 rounded-full bg-emerald-500"
              style={{ animation: `danta-dot 1.2s ease-in-out ${dot * 0.16}s infinite` }}
            />
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        {thinkingSteps.map((step, index) => {
          const Icon = step.icon;
          const isDone = index < stepIndex;
          const isActive = index === stepIndex;

          return (
            <div
              key={step.label}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 transition ${
                isActive ? 'bg-emerald-50 text-emerald-800' : 'text-slate-500'
              }`}
            >
              <span className={`grid h-5 w-5 place-items-center rounded-md ${isDone ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {isDone ? <CheckCircle2 size={13} /> : <Icon size={13} />}
              </span>
              <span className="text-xs font-semibold">{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

const ReportActionCard: React.FC<{
  messageId: string;
  action: ReportAction;
  status?: ChatMessage['actionStatus'];
  onConfirm: (messageId: string, action: ReportAction) => void;
  onCancel: (messageId: string, action: ReportAction) => void;
}> = ({ messageId, action, status = 'pending', onConfirm, onCancel }) => {
  const confirmDisabled = status === 'running' || status === 'completed' || status === 'cancelled';
  const cancelDisabled = status !== 'pending' && status !== 'failed';
  const confirmText = status === 'running'
    ? 'Membuat PDF...'
    : status === 'failed'
      ? 'Coba lagi generate PDF'
      : action.confirmLabel;

  return (
    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-slate-700">
      <p className="font-black text-emerald-900">{action.draft.title}</p>
      <p className="mt-1 text-slate-600">Periode: {action.draft.periodLabel}</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <div className="rounded-md bg-white px-2 py-1.5">
          <p className="font-black text-slate-900">{action.draft.activityCount}</p>
          <p className="text-[10px] text-slate-500">Aktivitas</p>
        </div>
        <div className="rounded-md bg-white px-2 py-1.5">
          <p className="font-black text-slate-900">{action.draft.evidenceCount}</p>
          <p className="text-[10px] text-slate-500">Evidence</p>
        </div>
        <div className="rounded-md bg-white px-2 py-1.5">
          <p className="font-black text-slate-900">{action.draft.relevantAssetCount}</p>
          <p className="text-[10px] text-slate-500">Asset R2</p>
        </div>
      </div>
      {action.draft.risks.length > 0 && (
        <p className="mt-2 text-slate-600">Risiko utama: {action.draft.risks[0]}</p>
      )}
      {action.draft.recommendations.length > 0 && (
        <p className="mt-1 text-slate-600">Rekomendasi: {action.draft.recommendations[0]}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={confirmDisabled}
          onClick={() => onConfirm(messageId, action)}
          className="rounded-md bg-emerald-600 px-3 py-1.5 font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {confirmText}
        </button>
        <button
          type="button"
          disabled={cancelDisabled}
          onClick={() => onCancel(messageId, action)}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {action.cancelLabel}
        </button>
      </div>
    </div>
  );
};

export const AIChatbot: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [thinkingStepIndex, setThinkingStepIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Halo, saya Danta.AI. Saya bisa bantu baca progress, risiko, dokumen, dan evidence project.',
      usedAI: false,
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const suggestedPrompts = useMemo(() => [
    'Buat laporan mingguan project Mahakam',
    'Project mana paling berisiko?',
    'Kasih evidence project terlambat',
    'Asset R2 apa yang relevan?',
    'Ringkas portfolio hari ini',
  ], []);

  useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading, open, thinkingStepIndex]);

  useEffect(() => {
    setSpeechSupported(Boolean(getSpeechRecognitionConstructor()));

    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      setThinkingStepIndex(0);
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setThinkingStepIndex((current) => Math.min(current + 1, thinkingSteps.length - 1));
    }, 1100);

    return () => window.clearInterval(intervalId);
  }, [loading]);

  const sendQuestion = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setIsListening(false);
    setSpeechError('');
    setInput('');
    setMessages((current) => [
      ...current,
      { id: createMessageId(), role: 'user', content: trimmed },
    ]);
    setLoading(true);

    try {
      const response = await answerProjectQuestion(trimmed);
      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: 'assistant',
          content: response.answer,
          usedAI: response.usedAI,
          sources: response.sources,
          action: response.action,
          actionStatus: response.action ? 'pending' : undefined,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: 'assistant',
          content: error instanceof Error ? error.message : 'Chatbot belum bisa memproses pertanyaan.',
          usedAI: false,
          sources: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendQuestion(input);
  };

  const updateActionStatus = (
    messageId: string,
    actionStatus: ChatMessage['actionStatus'],
    content?: string,
  ) => {
    setMessages((current) => current.map((message) => (
      message.id === messageId
        ? { ...message, actionStatus, content: content || message.content }
        : message
    )));
  };

  const confirmReportAction = async (messageId: string, action: ReportAction) => {
    updateActionStatus(messageId, 'running', `${action.draft.summary}\n\nSedang membuat PDF report...`);
    try {
      await generateWeeklyReport(
        action.projectId,
        new Date(action.weekStartIso),
        new Date(action.weekEndIso),
        {
          assetSources: action.assetSources,
          draftSummary: action.draft.summary,
        },
      );
      updateActionStatus(messageId, 'completed', `${action.draft.summary}\n\nPDF report untuk ${action.projectName} sudah dibuat.`);
    } catch (error) {
      updateActionStatus(
        messageId,
        'failed',
        error instanceof Error ? error.message : 'Gagal membuat PDF report.',
      );
    }
  };

  const cancelReportAction = (messageId: string, action: ReportAction) => {
    updateActionStatus(messageId, 'cancelled', `Draft report untuk ${action.projectName} dibatalkan. Tidak ada PDF yang dibuat.`);
  };

  const toggleVoiceInput = () => {
    if (loading) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      setSpeechError('Input suara belum didukung di browser ini. Coba gunakan Chrome atau Edge.');
      return;
    }

    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = 'id-ID';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    const startingInput = input.trim();
    let finalTranscript = '';

    recognition.onstart = () => {
      setSpeechError('');
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript || '';

        if (result.isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const spokenText = `${finalTranscript} ${interimTranscript}`.trim();
      setInput([startingInput, spokenText].filter(Boolean).join(' ').trim());
    };

    recognition.onerror = (event) => {
      const messagesByError: Record<string, string> = {
        'not-allowed': 'Akses mikrofon ditolak. Izinkan microphone di browser untuk memakai input suara.',
        'no-speech': 'Saya belum menangkap suara. Coba klik mic dan bicara lagi.',
        network: 'Input suara butuh koneksi browser yang stabil. Coba lagi sebentar.',
      };

      setSpeechError(messagesByError[event.error] || 'Input suara belum berhasil diproses. Coba lagi.');
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    try {
      recognition.start();
    } catch {
      setSpeechError('Input suara sedang aktif atau belum siap. Coba lagi sebentar.');
      setIsListening(false);
    }
  };

  const resetChat = () => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setIsListening(false);
    setSpeechError('');
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Halo, saya Danta.AI. Saya bisa bantu baca progress, risiko, dokumen, dan evidence project.',
        usedAI: false,
      },
    ]);
  };

  return (
    <div
      className={`fixed z-[70] ${
        open
          ? 'inset-x-2 bottom-2 sm:inset-auto sm:bottom-6 sm:right-6'
          : 'inset-x-3 bottom-[5.35rem] sm:inset-auto sm:bottom-6 sm:right-6'
      }`}
    >
      <DantaStyles />
      {open ? (
        <section
          className="flex h-[min(88dvh,720px)] max-h-[calc(100dvh-1rem)] w-full flex-col overflow-hidden rounded-lg border border-emerald-100 bg-white shadow-[0_24px_70px_rgba(15,118,110,0.18)] sm:w-[min(92vw,33rem)]"
          aria-label="Danta.AI chatbot project"
        >
          <header className="relative overflow-hidden border-b border-emerald-100 bg-gradient-to-br from-white via-emerald-50 to-sky-50 px-3 py-3 text-slate-900 sm:px-4 sm:py-4">
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-emerald-300 via-teal-200 to-sky-200" />
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <DantaMark active={loading || isListening} />
                <div className="min-w-0">
                  <h2 className="truncate text-base font-black tracking-normal">Danta.AI</h2>
                  <p className="truncate text-xs font-medium text-emerald-700">Project intelligence assistant</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={resetChat}
                  className="grid h-9 w-9 place-items-center rounded-md text-slate-500 transition-colors hover:bg-emerald-100 hover:text-emerald-800"
                  aria-label="Reset chat"
                  title="Reset chat"
                >
                  <RefreshCw size={17} />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="grid h-9 w-9 place-items-center rounded-md text-slate-500 transition-colors hover:bg-emerald-100 hover:text-emerald-800"
                  aria-label="Tutup Danta.AI"
                  title="Tutup"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-emerald-50/60 via-white to-sky-50/50 px-3 py-3 sm:px-4 sm:py-4">
            <div className="space-y-3">
              {messages.map((message) => {
                const isUser = message.role === 'user';
                return (
                  <div key={message.id} className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    {!isUser && <DantaMark small />}
                    <div
                      className={`max-w-[88%] rounded-lg px-3 py-2 text-sm leading-relaxed shadow-sm sm:max-w-[86%] ${
                        isUser
                          ? 'bg-gradient-to-br from-emerald-600 to-teal-600 text-white'
                          : 'border border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      <AnswerText text={message.content} isUser={isUser} />
                      {!isUser && <SourceCards sources={message.sources} />}
                      {!isUser && message.action && (
                        <ReportActionCard
                          messageId={message.id}
                          action={message.action}
                          status={message.actionStatus}
                          onConfirm={(messageId, action) => void confirmReportAction(messageId, action)}
                          onCancel={cancelReportAction}
                        />
                      )}
                      {!isUser && message.usedAI === false && (
                        <p className="mt-2 inline-flex rounded-md bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">
                          Jawaban sistem
                        </p>
                      )}
                    </div>
                    {isUser && (
                      <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                        <User size={15} />
                      </div>
                    )}
                  </div>
                );
              })}

              {loading && <ThinkingPanel stepIndex={thinkingStepIndex} />}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="border-t border-slate-200 bg-white p-2.5 sm:p-3">
            <div className="mb-2.5 flex gap-2 overflow-x-auto pb-1">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void sendQuestion(prompt)}
                  disabled={loading}
                  className="shrink-0 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {prompt}
                </button>
              ))}
            </div>
            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <label htmlFor="ai-chat-input" className="sr-only">Tanya Danta.AI</label>
              <div className="min-w-0 flex-1">
                <div className={`flex items-end rounded-lg border bg-white transition focus-within:ring-2 ${
                  isListening
                    ? 'border-emerald-300 ring-2 ring-emerald-100'
                    : 'border-slate-200 focus-within:border-emerald-400 focus-within:ring-emerald-100'
                }`}>
                  <textarea
                    id="ai-chat-input"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void sendQuestion(input);
                      }
                    }}
                    rows={1}
                    placeholder={isListening ? 'Mendengarkan...' : 'Tanya project, laporan, asset R2, evidence...'}
                    className="max-h-28 min-h-11 flex-1 resize-none rounded-lg border-0 bg-transparent px-3 py-2.5 text-sm text-slate-800 outline-none"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={toggleVoiceInput}
                    disabled={loading}
                    className={`mb-1.5 mr-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-md transition ${
                      isListening
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : speechSupported
                          ? 'text-slate-500 hover:bg-slate-100 hover:text-emerald-700'
                          : 'text-slate-300'
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                    aria-label={isListening ? 'Hentikan input suara' : 'Mulai input suara'}
                    title={speechSupported ? (isListening ? 'Stop suara' : 'Input suara') : 'Input suara belum didukung'}
                  >
                    {isListening ? <MicOff size={17} /> : <Mic size={17} />}
                  </button>
                </div>
                {(isListening || speechError) && (
                  <p className={`mt-1 text-[11px] font-medium ${speechError ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {speechError || 'Silakan bicara. Teks akan masuk otomatis ke kolom chat.'}
                  </p>
                )}
              </div>
              <button
                type="submit"
                disabled={loading || input.trim().length === 0}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-emerald-600 text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                aria-label="Kirim pertanyaan"
                title="Kirim"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative mx-auto flex h-11 w-full max-w-md items-center gap-2.5 rounded-2xl border border-slate-200/90 bg-white/95 px-2.5 text-left text-slate-600 shadow-[0_-8px_24px_rgba(15,23,42,0.10)] backdrop-blur-xl transition hover:border-emerald-200 hover:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-100 sm:mx-0 sm:h-14 sm:w-auto sm:justify-center sm:gap-2 sm:rounded-lg sm:border-0 sm:bg-emerald-600 sm:px-4 sm:text-white sm:shadow-xl sm:backdrop-blur-none sm:hover:bg-emerald-700 sm:focus:ring-emerald-200"
          aria-label="Buka Danta.AI"
          title="Danta.AI"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 transition group-hover:bg-emerald-100 sm:h-auto sm:w-auto sm:bg-transparent sm:text-white sm:ring-0 sm:group-hover:bg-transparent">
            <MessageCircle size={19} />
          </span>
          <span className="min-w-0 flex-1 sm:flex-none">
            <span className="block truncate text-[13px] font-bold leading-tight text-slate-800 sm:hidden">Tanya Danta.AI</span>
            <span className="hidden text-sm font-black tracking-normal sm:block">Danta.AI</span>
            <span className="block truncate text-[10px] font-medium leading-tight text-slate-400 sm:hidden">Insight project, evidence, dokumen</span>
          </span>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white shadow-sm transition group-hover:bg-emerald-700 sm:hidden">
            <Send size={15} />
          </span>
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400 sm:-right-1 sm:-top-1 sm:h-3 sm:w-3" />
        </button>
      )}
    </div>
  );
};
