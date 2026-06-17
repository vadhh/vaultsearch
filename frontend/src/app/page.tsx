'use client';

import { useState, useRef, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import ChatMessages from '../components/ChatMessages';
import ChatInput from '../components/ChatInput';

export default function Home() {
  const [messages, setMessages] = useState<{ role: 'user' | 'bot'; content: string }[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [documents, setDocuments] = useState<string[]>([]);
  const [isDocsLoading, setIsDocsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
      console.log('Documents fetched:', data);

      if (data.documents && Array.isArray(data.documents)) {
        setDocuments(data.documents);
      } else {
        setDocuments([]);
      }
    } catch (e) {
      console.error('Failed to fetch docs', e);
    } finally {
      setIsDocsLoading(false);
    }
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`Permanently delete "${filename}" from memory?`)) return;

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${API_URL}/documents/${filename}`, { method: 'DELETE' });
      if (res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: 'bot', content: `🗑️ **System:** Removed ${filename} from context.` },
        ]);
        fetchDocuments();
      }
    } catch (e) {
      console.error('Failed to delete', e);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setUploadStatus(`Indexing ${selectedFile.name}...`);

      const formData = new FormData();
      formData.append('file', selectedFile);

      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const response = await fetch(`${API_URL}/upload`, {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          setUploadStatus('✅ Ready');
          fetchDocuments();
        } else {
          setUploadStatus('❌ Failed');
        }
      } catch (error) {
        console.error('Upload error:', error);
        setUploadStatus('❌ Error');
      }
    }
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      if (streamingContent) {
        setMessages((prev) => [...prev, { role: 'bot', content: streamingContent + ' [Stopped]' }]);
        setStreamingContent('');
      }
    }
  };

  const sendMessage = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim()) return;

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
        signal: abortControllerRef.current.signal,
      });

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let currentText = '';

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
        setMessages((prev) => [...prev, { role: 'bot', content: '❌ Error connecting to Brain.' }]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="flex h-screen bg-[#050507] text-gray-100 font-sans overflow-hidden selection:bg-blue-500/30">
      {/* 1. Sidebar */}
      <Sidebar
        documents={documents}
        isDocsLoading={isDocsLoading}
        uploadStatus={uploadStatus}
        fetchDocuments={fetchDocuments}
        handleFileChange={handleFileChange}
        handleDelete={handleDelete}
      />

      {/* 2. Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Aurora Background */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/5 rounded-full blur-[100px]"></div>
        </div>

        {/* Chat Messages */}
        <ChatMessages
          messages={messages}
          streamingContent={streamingContent}
          isLoading={isLoading}
          sendMessage={sendMessage}
          messagesEndRef={messagesEndRef}
        />

        {/* Chat Input */}
        <ChatInput
          input={input}
          setInput={setInput}
          isLoading={isLoading}
          sendMessage={sendMessage}
          stopGeneration={stopGeneration}
        />
      </div>
    </div>
  );
}