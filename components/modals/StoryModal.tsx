import React from "react";
import { Copy, FileText, X } from "lucide-react";
import { Button } from "../UI";

export const StoryModal: React.FC<{
  content: string;
  onClose: () => void;
  isLoading?: boolean;
}> = ({ content, onClose, isLoading }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div
      className="absolute inset-0 bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    ></div>
    <div className="bg-[#f8f9fa] rounded-3xl w-full max-w-3xl h-[85vh] flex flex-col relative z-10 shadow-2xl overflow-hidden animate-slide-up">
      <div className="px-6 md:px-8 py-5 border-b flex justify-between items-center bg-white">
        <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
          <FileText size={20} className="text-indigo-600" /> 战报预览
        </h3>
        <button onClick={onClose}>
          <div className="text-slate-400 hover:text-slate-800 transition-colors">
            <X size={24} />
          </div>
        </button>
      </div>
      <div className="flex-1 p-6 md:p-10 overflow-y-auto font-serif text-slate-800 leading-relaxed whitespace-pre-wrap text-base md:text-lg bg-[#fdfdfd]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <p>正在生成战报，请稍候...</p>
          </div>
        ) : (
          content
        )}
      </div>
      <div className="p-6 border-t bg-slate-50 flex justify-end">
        <Button
          onClick={() => navigator.clipboard.writeText(content)}
          variant="secondary"
          className="bg-white border-slate-300 text-slate-700 hover:bg-slate-100 shadow-sm"
          icon={Copy}
          disabled={isLoading}
        >
          复制全文
        </Button>
      </div>
    </div>
  </div>
);
