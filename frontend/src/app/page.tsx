'use client';

import { useState, useRef, useEffect, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Upload, FileText, Send, ShieldCheck, Zap, Trash2, RefreshCw } from 'lucide-react';

const MemoizedMarkdown = memo(({ content }: { content: string }) => {
  return <ReactMarkdown>{content}</ReactMarkdown>;
});
MemoizedMarkdown.displayName = 'MemoizedMarkdown';

export default function Home() {
  const [messages, setMessages] = useState<{ role: 'user' | 'bot'; content: string }[]>([]);
  const [streamingContent, setStreamingContent] = useState(''); 
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [documents, setDocuments] = useState<string[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  // Load docs on mount
  useEffect(() => {
    fetchDocuments();
  }, []);

  const LoadingIndicator = () => (
  <div className="flex justify-start animate-in fade-in duration-300">
    <div className="max-w-3xl p-5 rounded-2xl rounded-tl-none bg-[#18181b] border border-white/5 text-gray-400 shadow-sm flex items-center gap-3">
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
      </div>
      <span className="text-xs font-medium">Thinking...</span>
    </div>
  </div>
);

  const fetchDocuments = async () => {
    try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const res = await fetch(`${API_URL}/documents`);
        const data = await res.json();
        // Ensure  handling response correctly
        setDocuments(data.documents || []);
    } catch (e) {
        console.error("Failed to fetch docs", e);
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
          fetchDocuments(); // Update list 
        } else {
          setUploadStatus('❌ Failed');
        }
      } catch (error) {
        console.error("Upload error:", error);
        setUploadStatus('❌ Error');
      }
    }
  };

  const sendMessage = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim()) return;

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

    } catch (error) {
      console.error(error);
      setMessages((prev) => [...prev, { role: 'bot', content: "❌ Error connecting to Brain." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#0a0a0c] text-gray-100 font-sans overflow-hidden">
      
      {/* Sidebar */}
      <div className="w-72 bg-[#121214]/80 backdrop-blur-md border-r border-white/5 flex flex-col p-6 gap-6 z-20">
        
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
            <ShieldCheck size={18} className="text-white" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            VaultSearch
          </h1>
        </div>

        {/* Knowledge Base Card */}
        <div className="bg-[#18181b] p-4 rounded-[10px] border border-white/5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Knowledge Base</h2>
                <button onClick={fetchDocuments} className="text-gray-500 hover:text-white transition"><RefreshCw size={12}/></button>
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
                className="w-full bg-blue-600 hover:bg-blue-500 text-sm py-2.5 rounded-lg transition-all font-medium flex items-center justify-center gap-2"
            >
                <Upload size={16} className="text-white" />
                <span className="text-white">Add PDF</span>
            </button>

            {/* Dynamic Document List */}
            <div className="space-y-1 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 pr-1">
                {documents.length === 0 ? (
                    <p className="text-xs text-gray-600 italic text-center py-4">Brain is empty</p>
                ) : (
                    documents.map((doc, i) => (
                        <div key={i} className="group flex items-center justify-between p-2 rounded bg-white/5 hover:bg-white/10 text-xs text-gray-300 border border-transparent hover:border-blue-500/30 transition-all">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <FileText size={12} className="text-blue-400 shrink-0" />
                                <span className="truncate" title={doc}>{doc}</span>
                            </div>
                            <button 
                                onClick={() => handleDelete(doc)}
                                className="text-gray-600 hover:text-red-500 transition-colors p-1"
                                title="Delete from Brain"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))
                )}
            </div>
            
            <p className="text-[10px] text-green-400 h-4 text-center">{uploadStatus}</p>
        </div>
        
        <div className="mt-auto text-xs text-gray-600 px-2">
            Private Local RAG v1.2 <br/>
            Engine: Llama 3
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col relative">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-[#0a0a0c] to-[#0a0a0c] pointer-events-none" />

        <div className="flex-1 overflow-y-auto p-8 space-y-8 relative z-10 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
          {messages.length === 0 && !isLoading && (
            <div className="h-full flex flex-col items-center justify-center -mt-20 space-y-8 animate-in fade-in zoom-in duration-500">
                <div className="h-24 w-24 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/40 rotate-3">
                    <ShieldCheck size={64} className="text-white drop-shadow-md" />
                </div>
                <div className="text-center space-y-2">
                    <h2 className="text-4xl font-bold text-white tracking-tight">
                        Vault<span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Search</span>
                    </h2>
                    <p className="text-gray-400 max-w-md mx-auto">
                        Secure, offline document intelligence.
                    </p>
                </div>

                {/* Suggested Queries */}
                <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
                    {[
                        "Summarize this document",
                        "What are the penalties?",
                        "List key dates",
                        "Find compliance risks"
                    ].map((query, i) => (
                        <button 
                            key={i}
                            onClick={() => sendMessage(query)}
                            className="p-3 text-sm text-gray-400 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-xl transition-all text-left flex items-center justify-between group"
                        >
                            {query}
                            <Zap size={14} className="opacity-0 group-hover:opacity-100 text-yellow-400 transition-opacity" />
                        </button>
                    ))}
                </div>
            </div>
          )}
          
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
              <div className={`max-w-3xl p-5 rounded-2xl shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-[#18181b] border border-white/5 text-gray-200 rounded-tl-none shadow-md'}`}>
                <MemoizedMarkdown content={msg.content} />
              </div>
            </div>
          ))}

          {isLoading && !streamingContent && (
            <LoadingIndicator />
          )}

          {streamingContent && (
            <div className="flex justify-start">
              <div className="max-w-3xl p-5 rounded-2xl rounded-tl-none bg-[#18181b] border border-blue-500/30 text-gray-200 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                 <p className="whitespace-pre-wrap leading-relaxed">{streamingContent}<span className="inline-block w-2 h-4 ml-1 align-middle bg-blue-400 animate-pulse"></span></p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-6 relative z-20">
          <div className="max-w-4xl mx-auto relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
            <div className="relative flex gap-2 bg-[#0a0a0c] p-2 rounded-xl border border-white/10 focus-within:border-blue-500/50 transition-colors">
                <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Ask your documents..."
                className="flex-1 bg-transparent text-white px-4 py-3 focus:outline-none placeholder-gray-500"
                />
                <button onClick={() => sendMessage()} disabled={isLoading} className="bg-blue-600 hover:bg-blue-500 p-3 rounded-lg text-white transition-colors disabled:opacity-50">
                    <Send size={18} />
                </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
