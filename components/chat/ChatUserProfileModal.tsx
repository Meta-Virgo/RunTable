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
    <Modal onClose={onClose} className="max-w-md" title="用户信息">
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-800">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.nickname || "用户头像"}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xl font-bold text-indigo-300">
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
                <span className="rounded border border-purple-400/30 bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-bold text-purple-200">
                  VIP
                </span>
              )}
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
                LV.{profile.level || 1}
              </span>
            </div>
            {profile.user_code && (
              <p className="mt-1 text-xs font-mono text-slate-500">
                UID: {profile.user_code}
              </p>
            )}
          </div>
        </div>
        <div className="mt-5 rounded-xl border border-white/10 bg-slate-950/50 p-4 text-sm leading-relaxed text-slate-300">
          {profile.bio || "这个人很神秘，什么都没有写..."}
        </div>
      </div>
    </Modal>
  );
};

