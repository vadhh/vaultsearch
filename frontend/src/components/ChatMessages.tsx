import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import { ShieldCheck, ChevronRight } from 'lucide-react';

interface ChatMessagesProps {
  messages: { role: 'user' | 'bot'; content: string }[];
  streamingContent: string;
  isLoading: boolean;
  sendMessage: (textOverride?: string) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

const MemoizedMarkdown = memo(({ content }: { content: string }) => {
  return (
    <ReactMarkdown
      components={{
        a: ({ node, ...props }) => (
          <span className="text-blue-400 font-medium underline decoration-blue-500/30 underline-offset-4">
            {props.children}
          </span>
        ),
        ul: ({ node, ...props }) => (
          <ul className="list-disc pl-4 space-y-1 my-2 text-gray-300" {...props} />
        ),
        li: ({ node, ...props }) => <li className="pl-1" {...props} />,
        strong: ({ node, ...props }) => <strong className="font-semibold text-blue-100" {...props} />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
});
MemoizedMarkdown.displayName = 'MemoizedMarkdown';

const LoadingIndicator = () => (
  <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-500">
    <div className="bg-[#1c1c21] border border-blue-500/20 px-5 py-4 rounded-2xl rounded-tl-none shadow-[0_0_15px_rgba(59,130,246,0.05)] flex items-center gap-3">
      <div className="flex space-x-1.5">
        <div className="w-2 h-2 bg-blue-500/80 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
        <div className="w-2 h-2 bg-cyan-400/80 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
        <div className="w-2 h-2 bg-blue-600/80 rounded-full animate-bounce"></div>
      </div>
    </div>
  </div>
);

export default function ChatMessages({
  messages,
  streamingContent,
  isLoading,
  sendMessage,
  messagesEndRef,
}: ChatMessagesProps) {
  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 relative z-10 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
      {/* ZERO STATE */}
      {messages.length === 0 && !isLoading && (
        <div className="h-full flex flex-col items-center justify-center -mt-10 space-y-10 animate-in fade-in zoom-in duration-700">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
            <div className="h-28 w-28 bg-[#0f0f11] border border-white/10 rounded-3xl flex items-center justify-center shadow-2xl relative">
              <ShieldCheck size={64} className="text-white drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
            </div>
          </div>

          <div className="text-center space-y-4 max-w-lg">
            <h2 className="text-5xl font-bold tracking-tight text-white">
              Vault<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Search</span>
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              Secure, air-gapped document intelligence.<br />
              Upload a PDF to the <span className="text-gray-300 font-semibold">Knowledge Base</span> to begin.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full max-w-lg">
            {[
              'Summarize this document',
              'What are the key risks?',
              'Find specific dates',
              'List all compliance requirements',
            ].map((query, i) => (
              <button
                key={i}
                onClick={() => sendMessage(query)}
                className="group p-4 bg-[#121214]/50 hover:bg-[#121214] border border-white/5 hover:border-blue-500/30 rounded-xl transition-all text-left flex items-center justify-between"
              >
                <span className="text-sm text-gray-400 group-hover:text-gray-200 transition-colors">
                  {query}
                </span>
                <ChevronRight
                  size={14}
                  className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-blue-400"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* MESSAGES */}
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`flex ${
            msg.role === 'user' ? 'justify-end' : 'justify-start'
          } animate-in fade-in slide-in-from-bottom-4 duration-500`}
        >
          <div
            className={`max-w-3xl p-6 rounded-2xl shadow-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-tr-sm shadow-[0_4px_20px_rgba(37,99,235,0.2)]'
                : 'bg-[#1c1c21] border border-white/5 text-gray-200 rounded-tl-sm shadow-[0_4px_20px_rgba(0,0,0,0.2)]'
            }`}
          >
            <MemoizedMarkdown content={msg.content} />
          </div>
        </div>
      ))}

      {/* LOADING & STREAMING */}
      {isLoading && !streamingContent && <LoadingIndicator />}

      {streamingContent && (
        <div className="flex justify-start">
          <div className="max-w-3xl p-6 rounded-2xl rounded-tl-sm bg-[#1c1c21] border border-blue-500/20 text-gray-200 shadow-[0_0_30px_rgba(59,130,246,0.1)]">
            <p className="whitespace-pre-wrap leading-relaxed">
              {streamingContent}
              <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-blue-400 animate-pulse rounded-full"></span>
            </p>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
