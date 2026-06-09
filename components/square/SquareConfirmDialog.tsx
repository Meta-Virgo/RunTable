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
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-lg font-bold text-white">{title}</h3>
        </div>
        <div className="p-4 text-slate-300 text-sm">{content}</div>
        <div className="p-4 flex justify-end gap-2 border-t border-slate-800">
          <button
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
            onClick={onCancel}
          >
            取消
          </button>
          <button
            className="px-3 py-1.5 text-xs rounded-xl bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20 border border-red-500/50 transition-colors"
            onClick={onConfirm}
          >
            删除
          </button>
        </div>
      </div>
    </div>
  );
};

