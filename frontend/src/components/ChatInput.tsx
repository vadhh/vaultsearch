import { Send, Square } from 'lucide-react';

interface ChatInputProps {
  input: string;
  setInput: (val: string) => void;
  isLoading: boolean;
  sendMessage: () => void;
  stopGeneration: () => void;
}

export default function ChatInput({
  input,
  setInput,
  isLoading,
  sendMessage,
  stopGeneration,
}: ChatInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  return (
    <div className="p-6 relative z-20">
      <div className="max-w-4xl mx-auto">
        <div className="relative flex items-center gap-3 bg-[#0f0f11] p-2.5 pl-5 rounded-2xl border border-white/10 focus-within:border-blue-500/50 focus-within:shadow-[0_0_20px_rgba(59,130,246,0.15)] transition-all duration-300">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            className="flex-1 bg-transparent text-white placeholder-gray-600 focus:outline-none text-sm h-10"
            disabled={isLoading}
          />
          <div className="h-8 w-[1px] bg-white/10 mx-1"></div>

          {isLoading ? (
            <button
              onClick={stopGeneration}
              className="bg-red-500/20 hover:bg-red-500/40 text-red-500 p-3 rounded-xl transition-all border border-red-500/20"
              title="Stop Generating"
            >
              <Square size={18} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={() => sendMessage()}
              className="bg-blue-600 hover:bg-blue-500 p-3 rounded-xl text-white transition-all hover:shadow-[0_0_15px_rgba(37,99,235,0.4)]"
            >
              <Send size={18} />
            </button>
          )}
        </div>
        <p className="text-center text-[10px] text-gray-700 mt-3 font-medium">
          AI can make mistakes. Verify with cited sources.
        </p>
      </div>
    </div>
  );
}
