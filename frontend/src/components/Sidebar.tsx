import { useRef } from 'react';
import { BookOpen, RefreshCw, Upload, FileText, Trash2, ShieldCheck } from 'lucide-react';

interface SidebarProps {
  documents: string[];
  isDocsLoading: boolean;
  uploadStatus: string;
  fetchDocuments: () => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDelete: (filename: string) => void;
}

export default function Sidebar({
  documents,
  isDocsLoading,
  uploadStatus,
  fetchDocuments,
  handleFileChange,
  handleDelete,
}: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
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
            className={`text-gray-600 hover:text-blue-400 transition-colors ${
              isDocsLoading ? 'animate-spin' : ''
            }`}
            title="Refresh List"
          >
            <RefreshCw size={12} />
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
                {isDocsLoading ? 'Scanning Brain...' : 'No documents indexed'}
              </p>
            </div>
          ) : (
            documents.map((doc, i) => (
              <div
                key={i}
                className="group flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] border border-transparent hover:border-white/5 transition-all"
              >
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
        <p className="text-[10px] text-green-400 h-4 text-center font-medium animate-pulse">
          {uploadStatus}
        </p>
      </div>

      <div className="mt-auto pt-6 border-t border-white/5">
        <div className="flex items-center gap-2 text-[10px] text-gray-600">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          System Online (Llama 3)
        </div>
      </div>
    </div>
  );
}
