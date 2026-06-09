import React from "react";
import { Crown, Loader2 } from "lucide-react";
import type { GameHistory, Profile } from "../../types";
import {
  getSquareHistoryCharacterDisplay,
  type SquarePlayerHistoryItem,
  type SquareProfileHistoryTab,
} from "../../services/squareProfileModel";
import { AvatarUpload } from "../AvatarUpload";
import { Modal } from "../UI";

interface SquareProfileModalProps {
  isOpen: boolean;
  profile: Profile | null;
  historyTab: SquareProfileHistoryTab;
  setHistoryTab: (tab: SquareProfileHistoryTab) => void;
  historyLoading: boolean;
  kpHistory: GameHistory[];
  playerHistory: SquarePlayerHistoryItem[];
  onClose: () => void;
}

export const SquareProfileModal: React.FC<SquareProfileModalProps> = ({
  isOpen,
  profile,
  historyTab,
  setHistoryTab,
  historyLoading,
  kpHistory,
  playerHistory,
  onClose,
}) => {
  if (!isOpen || !profile) return null;

  return (
    <Modal
      onClose={onClose}
      title={null}
      headerClassName="hidden"
      className="max-w-md overflow-visible !bg-transparent !border-none !shadow-none !p-0"
    >
      <div className="bg-slate-900/90 border border-slate-700/50 rounded-3xl relative overflow-hidden shadow-2xl backdrop-blur-xl">
        {profile.is_vip && (
          <div className="absolute top-4 left-4 z-10">
            <span className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg border border-purple-400/30">
              VIP
            </span>
          </div>
        )}
        <div className="p-8 pb-0 text-center relative">
          <div className="mx-auto mb-4 flex justify-center relative">
            <div className="relative">
              <svg
                className="absolute -top-1 -left-1 w-[104px] h-[104px] rotate-[-90deg]"
                viewBox="0 0 100 100"
              >
                <circle
                  cx="50"
                  cy="50"
                  r="48"
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="3"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="48"
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="3"
                  strokeDasharray="301.59"
                  strokeDashoffset="52.77825"
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div
                className="relative group block"
                style={{ width: "96px", height: "96px" }}
              >
                <div className="rounded-full overflow-hidden bg-slate-800 border-2 border-slate-700 flex items-center justify-center relative w-full h-full">
                  <AvatarUpload
                    url={profile.avatar_url}
                    onUpload={() => {}}
                    editable={false}
                    size={96}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="relative inline-flex items-center gap-2">
            <h2 className="text-2xl font-bold mb-1 transition-colors text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
              {profile.nickname}
            </h2>
            <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-bold px-1.5 py-0.5 rounded border border-indigo-500/30">
              LV.{profile.level || 1}
            </span>
          </div>
          <div className="flex justify-center items-center gap-2 mb-4 mt-2">
            <span className="text-sm text-slate-400 font-mono bg-slate-900/50 px-2 py-1 rounded">
              UID: {profile.user_code}
            </span>
          </div>
          <p className="text-slate-300 mb-6 max-w-md mx-auto italic">
            {profile.bio || "这个人很神秘，什么都没有写..."}
          </p>
          <div className="grid grid-cols-2 gap-4 text-left mt-6 mb-6">
            <HistoryTabCard
              active={historyTab === "player"}
              count={playerHistory.length}
              label="参与的团"
              onClick={() => setHistoryTab("player")}
            />
            <HistoryTabCard
              active={historyTab === "kp"}
              count={kpHistory.length}
              label="主持的团"
              onClick={() => setHistoryTab("kp")}
            />
          </div>
        </div>
        <div className="bg-slate-950/30 border-t border-white/5 p-4 max-h-[40vh] overflow-y-auto custom-scrollbar">
          {historyLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-indigo-500" />
            </div>
          ) : historyTab === "player" ? (
            <PlayerHistoryList playerHistory={playerHistory} />
          ) : (
            <KpHistoryList kpHistory={kpHistory} />
          )}
        </div>
      </div>
    </Modal>
  );
};

const HistoryTabCard: React.FC<{
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
}> = ({ active, count, label, onClick }) => (
  <div
    onClick={onClick}
    className={`p-4 rounded-xl border cursor-pointer transition-all group ${
      active
        ? "bg-slate-800 border-indigo-500/50 shadow-lg shadow-indigo-500/10"
        : "bg-slate-900/50 border-slate-700/30 hover:bg-slate-800"
    }`}
  >
    <div
      className={`text-xs uppercase font-bold mb-1 transition-colors ${
        active ? "text-indigo-400" : "text-slate-500 group-hover:text-indigo-400"
      }`}
    >
      {label}
    </div>
    <div className="text-2xl font-mono font-bold text-indigo-400">{count}</div>
  </div>
);

const PlayerHistoryList: React.FC<{
  playerHistory: SquarePlayerHistoryItem[];
}> = ({ playerHistory }) => (
  <div className="space-y-3">
    {playerHistory.length === 0 && (
      <div className="text-center py-8 text-slate-500 text-sm">暂无记录</div>
    )}
    {playerHistory.map((item) => {
      const characterDisplay = getSquareHistoryCharacterDisplay(item);
      return (
        <div
          key={item.id}
          className={`relative p-3 rounded-xl border transition-all ${
            characterDisplay.isDead
              ? "bg-slate-950 border-slate-800 grayscale"
              : "bg-slate-800/50 border-slate-700/50 hover:border-indigo-500/30"
          }`}
        >
          <div className="flex justify-between items-start mb-2">
            <div>
              <h4 className="font-bold text-white text-sm line-clamp-1">
                {item.game_history.room_title}
              </h4>
              <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                <Crown size={10} className="text-yellow-500" />
                {new Date(item.game_history.created_at).toLocaleDateString()}
                <span className="w-0.5 h-0.5 rounded-full bg-slate-600" />
                KP: {item.game_history.kp_nickname}
              </div>
            </div>
            <div
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                characterDisplay.isDead
                  ? "bg-red-950 text-red-500 border border-red-900"
                  : characterDisplay.isLost
                  ? "bg-yellow-950 text-yellow-500 border border-yellow-900"
                  : characterDisplay.isCrazy
                  ? "bg-purple-950 text-purple-500 border border-purple-900"
                  : "bg-emerald-950 text-emerald-500 border border-emerald-900"
              }`}
            >
              {item.outcome}
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-900/50 p-1.5 rounded-lg">
            <div className="w-6 h-6 flex items-center justify-center">
              <AvatarUpload
                url={characterDisplay.avatarUrl}
                onUpload={() => {}}
                editable={false}
                size={24}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-slate-300 truncate">
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
  </div>
);

const KpHistoryList: React.FC<{ kpHistory: GameHistory[] }> = ({
  kpHistory,
}) => (
  <div className="space-y-3">
    {kpHistory.length === 0 && (
      <div className="text-center py-8 text-slate-500 text-sm">暂无记录</div>
    )}
    {kpHistory.map((history) => (
      <div
        key={history.id}
        className="bg-slate-800/50 border border-slate-700/50 p-3 rounded-xl hover:border-indigo-500/30 transition-all"
      >
        <div className="flex justify-between items-start mb-1">
          <h4 className="font-bold text-white text-sm">{history.room_title}</h4>
          <span className="text-[10px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded">
            {new Date(history.created_at).toLocaleDateString()}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-400">
          <Crown size={10} className="text-yellow-500" />
          <span>主持人 (KP)</span>
        </div>
      </div>
    ))}
  </div>
);

