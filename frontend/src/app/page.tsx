'use client';

import { useState, useRef, useEffect, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Upload, FileText, Send, ShieldCheck, Zap, Trash2, RefreshCw, ChevronRight, BookOpen, Square } from 'lucide-react';

// --- Components ---

const MemoizedMarkdown = memo(({ content }: { content: string }) => {
  return (
    <ReactMarkdown 
      components={{
        a: ({node, ...props}) => <span className="text-blue-400 font-medium underline decoration-blue-500/30 underline-offset-4">{props.children}</span>,
        ul: ({node, ...props}) => <ul className="list-disc pl-4 space-y-1 my-2 text-gray-300" {...props} />,
        li: ({node, ...props}) => <li className="pl-1" {...props} />,
        strong: ({node, ...props}) => <strong className="font-semibold text-blue-100" {...props} />
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

// --- Main App ---

export default function Home() {
  const [messages, setMessages] = useState<{ role: 'user' | 'bot'; content: string }[]>([]);
  const [streamingContent, setStreamingContent] = useState(''); 
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [documents, setDocuments] = useState<string[]>([]);
  const [isDocsLoading, setIsDocsLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null); 

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, isLoading]);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setIsDocsLoading(true);
    try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const res = await fetch(`${API_URL}/documents`);
        const data = await res.json();
        
        // Debug Log to check what backend sends
        console.log("Documents fetched:", data);

        if (data.documents && Array.isArray(data.documents)) {
            setDocuments(data.documents);
        } else {
            setDocuments([]); 
        }
    } catch (e) {
        console.error("Failed to fetch docs", e);
    } finally {
        setIsDocsLoading(false);
    }
  };

  const handleDelete = async (filename: string) => {
    if(!confirm(`Permanently delete "${filename}" from memory?`)) return;
    
    try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const res = await fetch(`${API_URL}/documents/${filename}`, { method: 'DELETE' });
        if (res.ok) {
            setMessages(prev => [...prev, {role: 'bot', content: `🗑️ **System:** Removed ${filename} from context.`}]);
            fetchDocuments();
        }
    } catch (e) {
        console.error("Failed to delete", e);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setUploadStatus(`Indexing ${selectedFile.name}...`);

      const formData = new FormData();
      formData.append("file", selectedFile);

      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const response = await fetch(`${API_URL}/upload`, {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          setUploadStatus('✅ Ready');
          fetchDocuments();
        } else {
          setUploadStatus('❌ Failed');
        }
      } catch (error) {
        console.error("Upload error:", error);
        setUploadStatus('❌ Error');
      }
    }
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
        setIsLoading(false);
        // Save whatever was streamed so far
        if (streamingContent) {
            setMessages((prev) => [...prev, { role: 'bot', content: streamingContent + " [Stopped]" }]);
            setStreamingContent('');
        }
    }
  };

  const sendMessage = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim()) return;

    // Reset abort controller for new request
    abortControllerRef.current = new AbortController();

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: textToSend }]);
    setIsLoading(true);
    setStreamingContent(''); 

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: textToSend }),
        signal: abortControllerRef.current.signal 
      });

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let currentText = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value, { stream: true });
        currentText += chunkValue;
        setStreamingContent(currentText);
      }

      setMessages((prev) => [...prev, { role: 'bot', content: currentText }]);
      setStreamingContent(''); 

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Generation stopped by user');
      } else {
        console.error(error);
        setMessages((prev) => [...prev, { role: 'bot', content: "❌ Error connecting to Brain." }]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="flex h-screen bg-[#050507] text-gray-100 font-sans overflow-hidden selection:bg-blue-500/30">
      
      {/* 1. Sidebar */}
      <div className="w-72 bg-[#0c0c0e]/80 backdrop-blur-xl border-r border-white/5 flex flex-col p-6 gap-6 z-20 shadow-[4px_0_24px_rgba(0,0,0,0.4)]">
        
        {/* Brand */}
        <div className="flex items-center gap-3 group cursor-default">
          <div className="h-9 w-9 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform duration-300">
            <ShieldCheck size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              VaultSearch
            </h1>
            <p className="text-[10px] text-gray-500 tracking-wider font-medium">LOCAL INTELLIGENCE</p>
          </div>
        </div>

        {/* Knowledge Base Card */}
        <div className="bg-[#121214] p-4 rounded-2xl border border-white/5 flex flex-col gap-4 shadow-inner">
            <div className="flex items-center justify-between">
                <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <BookOpen size={12} /> Knowledge Base
                </h2>
                <button 
                    onClick={fetchDocuments} 
                    className={`text-gray-600 hover:text-blue-400 transition-colors ${isDocsLoading ? 'animate-spin' : ''}`}
                    title="Refresh List"
                >
                    <RefreshCw size={12}/>
                </button>
            </div>
            
            <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf"
                className="hidden" 
            />
            
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-xs py-3 rounded-xl transition-all font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 border border-white/10"
            >
                <Upload size={14} className="text-blue-100" />
                <span className="text-white">Upload Documents</span>
            </button>

            {/* List */}
            <div className="space-y-1 max-h-56 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 pr-1">
                {documents.length === 0 ? (
                    <div className="text-center py-6 border-2 border-dashed border-white/5 rounded-xl">
                      <p className="text-[10px] text-gray-600 font-medium">
                        {isDocsLoading ? "Scanning Brain..." : "No documents indexed"}
                      </p>
                    </div>
                ) : (
                    documents.map((doc, i) => (
                        <div key={i} className="group flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] border border-transparent hover:border-white/5 transition-all">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="h-6 w-6 rounded bg-blue-500/10 flex items-center justify-center shrink-0">
                                  <FileText size={12} className="text-blue-400" />
                                </div>
                                <span className="text-xs text-gray-300 truncate font-medium">{doc}</span>
                            </div>
                            <button 
                                onClick={() => handleDelete(doc)}
                                className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 hover:bg-red-400/10 p-1.5 rounded-md transition-all"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))
                )}
            </div>
            <p className="text-[10px] text-green-400 h-4 text-center font-medium animate-pulse">{uploadStatus}</p>
        </div>
        
        <div className="mt-auto pt-6 border-t border-white/5">
            <div className="flex items-center gap-2 text-[10px] text-gray-600">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              System Online (Llama 3)
            </div>
        </div>
      </div>

      {/* 2. Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
        
        {/* Aurora Background */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/5 rounded-full blur-[100px]"></div>
        </div>

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
                        Secure, air-gapped document intelligence.<br/>
                        Upload a PDF to the <span className="text-gray-300 font-semibold">Knowledge Base</span> to begin.
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-4 w-full max-w-lg">
                    {["Summarize this document", "What are the key risks?", "Find specific dates", "List all compliance requirements"].map((query, i) => (
                        <button 
                            key={i}
                            onClick={() => sendMessage(query)}
                            className="group p-4 bg-[#121214]/50 hover:bg-[#121214] border border-white/5 hover:border-blue-500/30 rounded-xl transition-all text-left flex items-center justify-between"
                        >
                            <span className="text-sm text-gray-400 group-hover:text-gray-200 transition-colors">{query}</span>
                            <ChevronRight size={14} className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-blue-400" />
                        </button>
                    ))}
                </div>
            </div>
          )}
          
          {/* MESSAGES */}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
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

        {/* 3. Input Area */}
        <div className="p-6 relative z-20">
          <div className="max-w-4xl mx-auto">
            <div className="relative flex items-center gap-3 bg-[#0f0f11] p-2.5 pl-5 rounded-2xl border border-white/10 focus-within:border-blue-500/50 focus-within:shadow-[0_0_20px_rgba(59,130,246,0.15)] transition-all duration-300">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
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
      </div>
    </div>
  );
}