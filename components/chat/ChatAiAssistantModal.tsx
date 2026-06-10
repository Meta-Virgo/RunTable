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
      <div className="bg-dicecho-panel border border-dicecho-border/55 rounded-lg w-full max-w-2xl shadow-xl shadow-black/25 overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-4 border-b border-dicecho-border/45 bg-dicecho-card/55">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles size={20} className="text-dicecho-primary" />
            AI 跑团助手
          </h3>
          <button
            onClick={onClose}
            className="text-dicecho-muted hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          <div className="bg-dicecho-card/70 rounded-lg p-3 border border-dicecho-border/45">
            <label className="text-xs font-bold text-dicecho-muted mb-2 block uppercase tracking-wider">
              指令 (Prompt)
            </label>
            <textarea
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              placeholder="例如：描述一下调查员们推开门后看到的景象，要恐怖一点..."
              className="w-full bg-dicecho-panel/70 border border-dicecho-border/50 rounded-lg p-3 text-sm text-slate-200 focus:border-dicecho-primary/70 focus:outline-none transition-colors duration-150 min-h-[80px] resize-y placeholder-dicecho-muted/60"
            />
            <div className="flex justify-end mt-2">
              <Button
                onClick={onAskAI}
                disabled={aiLoading}
                size="sm"
                className="bg-dicecho-primary-strong hover:bg-dicecho-primary text-white border-dicecho-primary/70 shadow-lg shadow-dicecho-primary/15"
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
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-dicecho-muted block uppercase tracking-wider">
                  生成结果
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => onUseResult(aiResult)}
                    className="text-xs flex items-center gap-1 text-dicecho-primary hover:text-white transition-colors"
                  >
                    <Send size={12} /> 填入输入框
                  </button>
                </div>
              </div>
              <div className="bg-dicecho-card/70 rounded-lg p-4 border border-dicecho-border/45 text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                {aiResult}
              </div>
            </div>
          )}

          <div className="text-[10px] text-dicecho-muted/70 text-center pt-2">
            AI 可能会产生错误或虚构事实，请核对后使用。
          </div>
        </div>
      </div>
    </div>
  );
};
