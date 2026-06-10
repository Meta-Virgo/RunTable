import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  Crown,
  ImageIcon,
  Lock,
  MessageSquare,
  Mic,
  Play,
  User,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { Character, Room } from "../types";
import { Button, Input, Modal, cn } from "./UI";
import type { LobbyRoom } from "../services/lobbyCatalogModel";

interface RoomCardProps {
  room: Room;
  currentUserId: string | null;
  myCharacters: Character[];
  onlineUsers: Set<string>;
  onJoinRoom: (
    roomId: string,
    charId: string,
    password?: string | null
  ) => void;
}

const COVER_GRADIENTS = [
  "from-[#5f5a8e] via-[#384154] to-[#242b3c]",
  "from-[#48715f] via-[#384154] to-[#252d3d]",
  "from-[#7c6145] via-[#384154] to-[#262d3e]",
  "from-[#72517a] via-[#384154] to-[#263142]",
  "from-[#4f6f84] via-[#384154] to-[#272f42]",
];

const hashText = (value: string) =>
  Array.from(value).reduce((total, char) => total + char.charCodeAt(0), 0);

export const RoomCard: React.FC<RoomCardProps> = ({
  room,
  currentUserId,
  myCharacters,
  onlineUsers,
  onJoinRoom,
}) => {
  const isKP = currentUserId === room.kp_id;
  const [selectedCharId, setSelectedCharId] = useState<string>("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  const gradient = useMemo(
    () =>
      COVER_GRADIENTS[hashText(room.id || room.title) % COVER_GRADIENTS.length],
    [room.id, room.title]
  );

  useEffect(() => {
    if (isKP) {
      setSelectedCharId("pc");
    } else if (myCharacters.length > 0) {
      setSelectedCharId(myCharacters[0].id);
    } else {
      setSelectedCharId("");
    }
  }, [isKP, myCharacters]);

  const lobbyRoom = room as LobbyRoom;
  const isKpOnline = onlineUsers.has(room.kp_id);
  const activeMemberCount =
    lobbyRoom.activeMemberCount && lobbyRoom.activeMemberCount > 0
      ? lobbyRoom.activeMemberCount
      : Math.max(lobbyRoom.characterCount ?? 0, 1);
  const onlineMemberCount =
    lobbyRoom.activeMemberIds?.filter((userId) => onlineUsers.has(userId))
      .length ?? (isKpOnline ? 1 : 0);
  const coverImageUrl = room.cover_image_url?.trim();
  const typeLabel = room.type === "voice" ? "语音团" : "文字团";
  const TypeIcon = room.type === "voice" ? Mic : MessageSquare;
  const requiresPassword = Boolean(room.has_password && !isKP);
  const canJoin =
    isKP ||
    (Boolean(selectedCharId) &&
      (!requiresPassword || Boolean(passwordInput.trim())));

  const onJoinClick = () => {
    if (!canJoin) return;

    onJoinRoom(
      room.id,
      selectedCharId,
      requiresPassword ? passwordInput : null
    );
  };

  const openDetails = () => setShowDetails(true);

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openDetails();
  };

  return (
    <>
      <article
        role="button"
        tabIndex={0}
        aria-label={`查看房间 ${room.title}`}
        onClick={openDetails}
        onKeyDown={handleCardKeyDown}
        className="group flex min-h-full cursor-pointer flex-col rounded-lg border border-dicecho-border/40 bg-dicecho-card/80 p-3 shadow-sm transition-colors hover:border-dicecho-primary/50 hover:bg-dicecho-card focus:outline-none focus:ring-2 focus:ring-dicecho-primary/60 dicecho-card-shadow"
      >
        <RoomCover
          room={room}
          coverImageUrl={coverImageUrl}
          gradient={gradient}
          typeLabel={typeLabel}
          TypeIcon={TypeIcon}
          compact
        />

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <RoomMetric
            icon={Users}
            label="在线人数"
            value={
              <>
                {onlineMemberCount}
                <span className="ml-1 text-xs font-medium text-dicecho-muted">
                  {" / "}
                  {activeMemberCount}
                </span>
              </>
            }
          />
          <RoomMetric
            icon={isKpOnline ? UserCheck : UserX}
            iconClassName={isKpOnline ? "text-dicecho-accent" : undefined}
            label="KP 状态"
            value={isKpOnline ? "在线" : "离线"}
            valueClassName={
              isKpOnline ? "text-dicecho-accent" : "text-dicecho-muted"
            }
          />
        </div>
      </article>

      {showDetails && (
        <Modal
          onClose={() => setShowDetails(false)}
          title={null}
          className="max-w-4xl"
        >
          <div className="grid max-h-[90vh] overflow-y-auto custom-scrollbar md:grid-cols-[minmax(0,0.92fr)_minmax(0,1fr)]">
            <div className="p-4 md:p-5">
              <RoomCover
                room={room}
                coverImageUrl={coverImageUrl}
                gradient={gradient}
                typeLabel={typeLabel}
                TypeIcon={TypeIcon}
              />
            </div>

            <div className="flex min-h-0 flex-col gap-5 border-t border-dicecho-border/40 p-5 md:border-l md:border-t-0 md:p-6">
              <div className="pr-8">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-dicecho-muted">
                  <span>#{room.room_number || "???"}</span>
                  <span>{typeLabel}</span>
                  {room.has_password && (
                    <span className="inline-flex items-center gap-1 text-amber-300/90">
                      <Lock size={12} />
                      需要密码
                    </span>
                  )}
                </div>
                <h3 className="text-2xl font-bold leading-tight text-white">
                  {room.title}
                </h3>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-dicecho-muted">
                  {room.description || "暂无简介，等待 KP 补充房间介绍。"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <RoomMetric
                  icon={Users}
                  label="在线人数"
                  value={
                    <>
                      {onlineMemberCount}
                      <span className="ml-1 text-xs font-medium text-dicecho-muted">
                        {" / "}
                        {activeMemberCount}
                      </span>
                    </>
                  }
                />
                <RoomMetric
                  icon={isKpOnline ? UserCheck : UserX}
                  iconClassName={isKpOnline ? "text-dicecho-accent" : undefined}
                  label="KP 状态"
                  value={isKpOnline ? "在线" : "离线"}
                  valueClassName={
                    isKpOnline ? "text-dicecho-accent" : "text-dicecho-muted"
                  }
                />
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-4 border-t border-dicecho-border/40 pt-5">
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="mb-2 ml-1 text-xs font-medium text-dicecho-muted">
                    选择角色
                  </div>
                  <div className="grid flex-1 content-start gap-2 overflow-y-auto pr-1 custom-scrollbar">
                    {isKP && (
                      <RoleChoiceCard
                        id="pc"
                        selected={selectedCharId === "pc"}
                        title="我是 KP"
                        subtitle="主持人"
                        icon={Crown}
                        onSelect={setSelectedCharId}
                      />
                    )}
                    {myCharacters.map((character) => (
                      <RoleChoiceCard
                        key={character.id}
                        id={character.id}
                        selected={selectedCharId === character.id}
                        title={character.name}
                        subtitle={character.job || "调查员"}
                        avatarUrl={character.avatar_url}
                        icon={User}
                        onSelect={setSelectedCharId}
                      />
                    ))}
                  </div>
                </div>

                {requiresPassword && (
                  <Input
                    label="房间密码"
                    type="password"
                    placeholder="输入房间密码"
                    value={passwordInput}
                    onChange={(event) => setPasswordInput(event.target.value)}
                    autoFocus
                  />
                )}

                {!isKP && myCharacters.length === 0 && (
                  <p className="text-xs text-amber-300/90">
                    请先创建一个角色，再加入房间。
                  </p>
                )}

                <Button
                  className="w-full"
                  icon={Play}
                  onClick={onJoinClick}
                  disabled={!canJoin}
                >
                  进入房间
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

const RoomCover: React.FC<{
  room: Room;
  coverImageUrl?: string;
  gradient: string;
  typeLabel: string;
  TypeIcon: React.ElementType;
  compact?: boolean;
}> = ({ room, coverImageUrl, gradient, typeLabel, TypeIcon, compact }) => (
  <div
    className={cn(
      "relative isolate aspect-[3/4] overflow-hidden rounded-lg",
      compact && "mb-0"
    )}
  >
    {coverImageUrl ? (
      <img
        src={coverImageUrl}
        alt={`${room.title} 封面`}
        className="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
      />
    ) : (
      <div className={cn("absolute inset-0 bg-gradient-to-br", gradient)} />
    )}
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_22%,rgba(255,255,255,0.18),transparent_24%),linear-gradient(180deg,rgba(15,20,32,0.04)_0%,rgba(15,20,32,0.18)_48%,rgba(15,20,32,0.46)_100%)]" />
    {!coverImageUrl && (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-white/70">
        <ImageIcon size={34} className="opacity-70" />
        <span className="text-xs font-medium">未设置封面</span>
      </div>
    )}
    <div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/35 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
      #{room.room_number || "???"}
    </div>
    <div
      className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white backdrop-blur-sm"
      title={typeLabel}
      aria-label={typeLabel}
    >
      <TypeIcon size={14} />
    </div>
  </div>
);

const RoomMetric: React.FC<{
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  iconClassName?: string;
  valueClassName?: string;
}> = ({ icon: Icon, label, value, iconClassName, valueClassName }) => (
  <div className="rounded-lg border border-dicecho-border/30 bg-dicecho-panel/60 px-3 py-2">
    <div className="flex items-center gap-1.5 text-dicecho-muted">
      <Icon size={14} className={iconClassName} />
      {label}
    </div>
    <div className={cn("mt-1 text-base font-bold text-white", valueClassName)}>
      {value}
    </div>
  </div>
);

const RoleChoiceCard: React.FC<{
  id: string;
  selected: boolean;
  title: string;
  subtitle: string;
  avatarUrl?: string | null;
  icon: React.ElementType;
  onSelect: (id: string) => void;
}> = ({
  id,
  selected,
  title,
  subtitle,
  avatarUrl,
  icon: Icon,
  onSelect,
}) => (
  <button
    type="button"
    onClick={() => onSelect(id)}
    className={cn(
      "flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
      selected
        ? "border-dicecho-primary/70 bg-dicecho-primary/18 text-white shadow-sm"
        : "border-dicecho-border/35 bg-dicecho-panel/55 text-slate-200 hover:border-dicecho-primary/45 hover:bg-dicecho-raised/70"
    )}
  >
    <span
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border",
        selected
          ? "border-dicecho-primary/50 bg-dicecho-primary/20"
          : "border-dicecho-border/40 bg-dicecho-card/80"
      )}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <Icon size={18} className="text-dicecho-primary" />
      )}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-semibold">{title}</span>
      <span className="mt-0.5 block truncate text-xs text-dicecho-muted">
        {subtitle}
      </span>
    </span>
    <span
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
        selected
          ? "border-dicecho-primary bg-dicecho-primary text-white"
          : "border-dicecho-border/50 text-transparent"
      )}
    >
      <Check size={14} />
    </span>
  </button>
);
