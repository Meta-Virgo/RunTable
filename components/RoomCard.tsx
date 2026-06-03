import React, { useEffect, useState } from "react";
import { Mic, MessageSquare, Play } from "lucide-react";
import { Character, Room } from "../types";
import { Button, Input } from "./UI";

interface RoomCardProps {
  room: Room;
  currentUserId: string | null;
  myCharacters: Character[];
  onJoinRoom: (
    roomId: string,
    charId: string,
    password?: string | null
  ) => void;
}

export const RoomCard: React.FC<RoomCardProps> = ({
  room,
  currentUserId,
  myCharacters,
  onJoinRoom,
}) => {
  const isKP = currentUserId === room.kp_id;
  const [selectedCharId, setSelectedCharId] = useState<string>("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPasswordInput, setShowPasswordInput] = useState(false);

  useEffect(() => {
    if (isKP) {
      setSelectedCharId("pc");
    } else if (myCharacters.length > 0) {
      setSelectedCharId(myCharacters[0].id);
    }
  }, [isKP, myCharacters]);

  const onJoinClick = () => {
    if (room.has_password && !isKP && !showPasswordInput) {
      setShowPasswordInput(true);
      return;
    }

    onJoinRoom(
      room.id,
      selectedCharId,
      room.has_password && !isKP ? passwordInput : null
    );
  };

  return (
    <div className="bg-slate-800/30 border border-slate-700/50 hover:border-indigo-500/30 rounded-xl p-5 transition-all hover:bg-slate-800/50 group flex flex-col">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1 min-w-0 mr-2">
          <div className="flex items-center gap-2">
            {room.type === "voice" ? (
              <Mic size={18} className="text-pink-400 shrink-0" />
            ) : (
              <MessageSquare size={18} className="text-indigo-400 shrink-0" />
            )}
            <h3 className="font-bold text-white text-lg line-clamp-1">
              {room.title}
            </h3>
          </div>
          {room.has_password && (
            <div className="mt-1">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 inline-flex items-center gap-1">
                🔒 私密
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-500 font-mono bg-slate-900/50 px-1.5 py-0.5 rounded border border-white/5">
            #{room.room_number || "???"}
          </span>
          {(room as any).isArchived ? (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20 uppercase">
              Archived
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
              Open
            </span>
          )}
        </div>
      </div>
      <p className="text-slate-400 text-sm mb-4 line-clamp-2 flex-1">
        {room.description || "暂无描述"}
      </p>

      <div className="pt-4 border-t border-white/5 space-y-3">
        <div className="flex flex-col gap-2">
          <label className="text-xs text-slate-500 font-medium">
            选择角色加入:
          </label>
          <select
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 text-slate-300"
            value={selectedCharId}
            onChange={(event) => setSelectedCharId(event.target.value)}
          >
            {isKP && <option value="pc">我是 KP (主持人)</option>}
            {myCharacters.map((character) => (
              <option key={character.id} value={character.id}>
                {character.name} ({character.job})
              </option>
            ))}
          </select>
        </div>

        {showPasswordInput && (
          <div className="animate-fade-in">
            <Input
              type="password"
              placeholder="输入房间密码..."
              value={passwordInput}
              onChange={(event) => setPasswordInput(event.target.value)}
              autoFocus
            />
          </div>
        )}

        <Button className="w-full" icon={Play} onClick={onJoinClick}>
          {showPasswordInput
            ? "验证并进入"
            : room.has_password && !isKP
            ? "输入密码进入"
            : "进入房间"}
        </Button>
      </div>
    </div>
  );
};
