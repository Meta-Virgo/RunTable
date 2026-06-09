import React from "react";
import { Crown, History, Skull } from "lucide-react";
import type { GameHistory } from "../../types";
import {
  getHomeHistoryCharacterDisplay,
  type HomePlayerHistoryItem,
} from "../../services/homeProfileModel";
import { AvatarUpload } from "../AvatarUpload";
import { Button, Modal } from "../UI";

interface HomeHistoryModalProps {
  open: boolean;
  historyTab: "kp" | "player";
  setHistoryTab: (tab: "kp" | "player") => void;
  kpHistory: GameHistory[];
  playerHistory: HomePlayerHistoryItem[];
  onClose: () => void;
}

export const HomeHistoryModal: React.FC<HomeHistoryModalProps> = ({
  open,
  historyTab,
  setHistoryTab,
  kpHistory,
  playerHistory,
  onClose,
}) => {
  if (!open) return null;

  return (
    <Modal
      onClose={onClose}
      title="跑团履历"
      icon={History}
      className="max-w-2xl"
    >
      <div className="flex border-b border-white/5">
        <button
          onClick={() => setHistoryTab("player")}
          className={`flex-1 py-3 text-sm font-bold transition-colors ${
            historyTab === "player"
              ? "bg-slate-800/50 text-white border-b-2 border-indigo-500"
              : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/30"
          }`}
        >
          参与的团 ({playerHistory.length})
        </button>
        <button
          onClick={() => setHistoryTab("kp")}
          className={`flex-1 py-3 text-sm font-bold transition-colors ${
            historyTab === "kp"
              ? "bg-slate-800/50 text-white border-b-2 border-indigo-500"
              : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/30"
          }`}
        >
          主持的团 ({kpHistory.length})
        </button>
      </div>

      <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
        {historyTab === "player" ? (
          <PlayerHistoryList playerHistory={playerHistory} />
        ) : (
          <KpHistoryList kpHistory={kpHistory} />
        )}
      </div>
      <div className="px-6 py-4 border-t border-white/10 bg-white/5 flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          关闭
        </Button>
      </div>
    </Modal>
  );
};

const PlayerHistoryList: React.FC<{
  playerHistory: HomePlayerHistoryItem[];
}> = ({ playerHistory }) => (
  <div className="space-y-3">
    {playerHistory.map((item) => {
      const characterDisplay = getHomeHistoryCharacterDisplay(item);

      return (
        <div
          key={item.id}
          className={`relative p-4 rounded-xl border transition-all ${
            characterDisplay.isDead
              ? "bg-slate-950 border-slate-800 grayscale"
              : "bg-slate-800/50 border-slate-700/50 hover:border-indigo-500/30"
          }`}
        >
          <div className="flex justify-between items-start mb-3">
            <div>
              <h4 className="font-bold text-white text-base line-clamp-1">
                {item.game_history.room_title}
              </h4>
              <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                <History size={12} />
                {new Date(item.game_history.created_at).toLocaleDateString()}
                <span className="w-1 h-1 rounded-full bg-slate-600" />
                KP: {item.game_history.kp_nickname}
              </div>
            </div>
            <div
              className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider flex items-center gap-1 ${
                characterDisplay.isDead
                  ? "bg-slate-800 text-slate-400 border-slate-700"
                  : characterDisplay.isLost
                  ? "bg-amber-900/20 text-amber-400 border-amber-500/20"
                  : characterDisplay.isCrazy
                  ? "bg-purple-900/20 text-purple-400 border-purple-500/20"
                  : "bg-emerald-900/20 text-emerald-400 border-emerald-500/20"
              }`}
            >
              {characterDisplay.isDead && <Skull size={10} />}
              {item.outcome}
            </div>
          </div>

          <div className="flex items-center gap-3 bg-slate-950/30 p-2 rounded-lg border border-white/5">
            <AvatarUpload
              url={characterDisplay.avatarUrl}
              onUpload={() => {}}
              editable={false}
              size={40}
            />
            <div>
              <div className="font-bold text-sm text-slate-200">
                {characterDisplay.name}
              </div>
              <div className="text-[10px] text-slate-500">
                {characterDisplay.job} · {characterDisplay.sex}
              </div>
            </div>
          </div>
        </div>
      );
    })}
    {playerHistory.length === 0 && (
      <div className="text-center py-8 text-slate-500 text-sm">
        暂无参与记录
      </div>
    )}
  </div>
);

const KpHistoryList: React.FC<{ kpHistory: GameHistory[] }> = ({
  kpHistory,
}) => (
  <div className="space-y-3">
    {kpHistory.map((item) => (
      <div
        key={item.id}
        className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-xl hover:border-indigo-500/30 transition-all"
      >
        <div className="flex justify-between items-start mb-2">
          <h4 className="font-bold text-white text-base">{item.room_title}</h4>
          <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
            <Crown size={10} />
            Keeper
          </div>
        </div>
        <p className="text-xs text-slate-400 line-clamp-2 mb-3">
          {item.room_description || "暂无描述..."}
        </p>
        <div className="text-[10px] text-slate-500 font-mono bg-slate-950/50 px-2 py-1 rounded inline-block">
          结团于: {new Date(item.created_at).toLocaleString()}
        </div>
      </div>
    ))}
    {kpHistory.length === 0 && (
      <div className="text-center py-8 text-slate-500 text-sm">
        暂无主持记录
      </div>
    )}
  </div>
);

