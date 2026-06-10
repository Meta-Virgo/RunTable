import React from "react";

interface SquareConfirmDialogProps {
  open: boolean;
  title: string;
  content: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export const SquareConfirmDialog: React.FC<SquareConfirmDialogProps> = ({
  open,
  title,
  content,
  onCancel,
  onConfirm,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-dicecho-panel border border-dicecho-border/50 rounded-lg w-full max-w-sm shadow-lg shadow-black/25 overflow-hidden">
        <div className="p-4 border-b border-dicecho-border/40">
          <h3 className="text-lg font-bold text-white">{title}</h3>
        </div>
        <div className="p-4 text-slate-300 text-sm">{content}</div>
        <div className="p-4 flex justify-end gap-2 border-t border-dicecho-border/40">
          <button
            className="px-3 py-1.5 text-xs rounded-lg border border-dicecho-border/50 text-slate-300 hover:bg-white/10 transition-colors"
            onClick={onCancel}
          >
            取消
          </button>
          <button
            className="px-3 py-1.5 text-xs rounded-lg bg-red-600 hover:bg-red-500 text-white shadow-sm border border-red-500/50 transition-colors"
            onClick={onConfirm}
          >
            删除
          </button>
        </div>
      </div>
    </div>
  );
};
