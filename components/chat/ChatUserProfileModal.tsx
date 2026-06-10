import React from "react";
import type { Profile } from "../../types";
import { Modal } from "../UI";

interface ChatUserProfileModalProps {
  profile: Profile | null;
  onClose: () => void;
}

export const ChatUserProfileModal: React.FC<ChatUserProfileModalProps> = ({
  profile,
  onClose,
}) => {
  if (!profile) return null;

  return (
    <Modal onClose={onClose} className="max-w-md">
      <div className="p-6">
        <div className="flex items-start gap-4 pr-10">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-dicecho-border/50 bg-dicecho-card">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.nickname || "用户头像"}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xl font-bold text-dicecho-primary">
                {profile.nickname?.[0] || "?"}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-lg font-bold text-white">
                {profile.nickname || "未知用户"}
              </h3>
              {profile.is_vip && (
                <span className="rounded border border-dicecho-primary/35 bg-dicecho-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  VIP
                </span>
              )}
              <span className="rounded bg-dicecho-card px-1.5 py-0.5 text-[10px] font-bold text-slate-200">
                LV.{profile.level || 1}
              </span>
            </div>
            {profile.user_code && (
              <p className="mt-1 text-xs font-mono text-dicecho-muted">
                UID: {profile.user_code}
              </p>
            )}
          </div>
        </div>
        <div className="mt-5 rounded-lg border border-dicecho-border/45 bg-dicecho-card/65 p-4 text-sm leading-relaxed text-slate-300">
          {profile.bio || "这个人很神秘，什么都没有写..."}
        </div>
      </div>
    </Modal>
  );
};
