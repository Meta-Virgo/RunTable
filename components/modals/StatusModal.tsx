import React, { useState } from "react";
import type { Character } from "../../types";
import { Button, cn, NumberStepper } from "../UI";

export const StatusModal: React.FC<{
  char: Character;
  onSave: (hp: number, san: number, mp: number) => void;
  onClose: () => void;
}> = ({ char, onSave, onClose }) => {
  const [status, setStatus] = useState({
    hp: char.hp,
    san: char.san,
    mp: char.mp,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      ></div>
      <div className="glass-panel rounded-3xl w-full max-w-md relative z-10 overflow-hidden animate-slide-up bg-[#0f172a]">
        <div className="p-6 border-b border-white/10 bg-slate-900/50 text-center">
          <h3 className="font-bold text-white text-lg">
            快速状态调整: {char.name}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            直接修改数值，系统会自动记录变动
          </p>
        </div>
        <div className="p-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { label: "HP", color: "text-red-400", key: "hp", min: -10 },
            { label: "SAN", color: "text-emerald-400", key: "san", min: 0 },
            { label: "MP", color: "text-blue-400", key: "mp", min: 0 },
          ].map((item) => (
            <div key={item.key} className="space-y-2 text-center">
              <label
                className={cn(
                  "text-xs font-bold uppercase tracking-wider",
                  item.color
                )}
              >
                {item.label}
              </label>
              <NumberStepper
                value={status[item.key as keyof typeof status]}
                onChange={(value) =>
                  setStatus({ ...status, [item.key]: value })
                }
                min={item.min}
                className="w-full"
              />
            </div>
          ))}
        </div>
        <div className="p-6 bg-slate-900/50 flex justify-center border-t border-white/10">
          <Button
            onClick={() => onSave(status.hp, status.san, status.mp)}
            variant="primary"
            className="w-full"
            size="lg"
          >
            确认变更
          </Button>
        </div>
      </div>
    </div>
  );
};
