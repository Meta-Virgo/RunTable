import React from "react";
import { Activity, RefreshCw, Send, Sparkles, X } from "lucide-react";
import { Button } from "../UI";

interface ChatAiAssistantModalProps {
  open: boolean;
  aiPrompt: string;
  setAiPrompt: (prompt: string) => void;
  aiResult: string;
  aiLoading: boolean;
  aiError: string;
  onAskAI: () => void;
  onUseResult: (result: string) => void;
  onClose: () => void;
}

export const ChatAiAssistantModal: React.FC<ChatAiAssistantModalProps> = ({
  open,
  aiPrompt,
  setAiPrompt,
  aiResult,
  aiLoading,
  aiError,
  onAskAI,
  onUseResult,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles size={20} className="text-purple-400" />
            AI 跑团助手
          </h3>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
            <label className="text-xs font-bold text-slate-400 mb-2 block uppercase tracking-wider">
              指令 (Prompt)
            </label>
            <textarea
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              placeholder="例如：描述一下调查员们推开门后看到的景象，要恐怖一点..."
              className="w-full bg-slate-950/50 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all min-h-[80px] resize-y placeholder-slate-600"
            />
            <div className="flex justify-end mt-2">
              <Button
                onClick={onAskAI}
                disabled={aiLoading}
                size="sm"
                className="bg-purple-600 hover:bg-purple-500 text-white border-none shadow-lg shadow-purple-900/20"
              >
                {aiLoading ? (
                  <RefreshCw size={14} className="animate-spin mr-2" />
                ) : (
                  <Sparkles size={14} className="mr-2" />
                )}
                {aiLoading ? "生成中..." : "开始生成"}
              </Button>
            </div>
          </div>

          {aiError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <Activity size={16} /> {aiError}
            </div>
          )}

          {aiResult && (
            <div className="space-y-2 animate-slide-up">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-400 block uppercase tracking-wider">
                  生成结果
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => onUseResult(aiResult)}
                    className="text-xs flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    <Send size={12} /> 填入输入框
                  </button>
                </div>
              </div>
              <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                {aiResult}
              </div>
            </div>
          )}

          <div className="text-[10px] text-slate-600 text-center pt-2">
            AI 可能会产生错误或虚构事实，请核对后使用。
          </div>
        </div>
      </div>
    </div>
  );
};

