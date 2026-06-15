import React from "react";
import { Check, Loader2, Plus, UserCheck, UserPlus } from "lucide-react";
import type { Profile } from "../../types";
import { Button, cn } from "../UI";

interface FriendRequestButtonProps {
  currentUserId?: string | null;
  profile: Profile | null;
  isFriend?: boolean;
  compact?: boolean;
  className?: string;
  onRequestFriend?: (profile: Profile) => Promise<void> | void;
}

export const FriendRequestButton: React.FC<FriendRequestButtonProps> = ({
  currentUserId,
  profile,
  isFriend = false,
  compact = false,
  className,
  onRequestFriend,
}) => {
  const [isSending, setIsSending] = React.useState(false);

  React.useEffect(() => {
    setIsSending(false);
  }, [profile?.id]);

  if (!currentUserId || !profile || profile.id === currentUserId) {
    return null;
  }

  if (isFriend) {
    if (compact) {
      return (
        <button
          type="button"
          disabled
          title="已是好友"
          aria-label="已是好友"
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full border-2 border-dicecho-card bg-emerald-500/90 text-white shadow-sm shadow-black/20 disabled:cursor-default",
            className
          )}
        >
          <Check size={13} strokeWidth={3} />
        </button>
      );
    }

    return (
      <Button
        size="sm"
        variant="secondary"
        disabled
        className={cn("min-w-28", className)}
      >
        <UserCheck size={14} className="mr-2 shrink-0" />
        已是好友
      </Button>
    );
  }

  const handleRequest = async () => {
    if (!onRequestFriend || isSending) return;

    setIsSending(true);
    try {
      await onRequestFriend(profile);
    } finally {
      setIsSending(false);
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        title={isSending ? "发送中..." : "申请好友"}
        aria-label={isSending ? "发送中..." : "申请好友"}
        disabled={!onRequestFriend || isSending}
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-full border-2 border-dicecho-card bg-dicecho-panel/95 text-dicecho-primary shadow-sm shadow-black/20 transition-all hover:border-dicecho-primary/80 hover:bg-dicecho-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-60",
          className
        )}
        onClick={() => void handleRequest()}
      >
        {isSending ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <Plus size={13} strokeWidth={3} />
        )}
      </button>
    );
  }

  return (
    <Button
      size="sm"
      variant="primarySoft"
      disabled={!onRequestFriend || isSending}
      className={cn("min-w-28", className)}
      onClick={() => void handleRequest()}
    >
      {isSending ? (
        <Loader2 size={14} className="mr-2 shrink-0 animate-spin" />
      ) : (
        <UserPlus size={14} className="mr-2 shrink-0" />
      )}
      {isSending ? "发送中..." : "申请好友"}
    </Button>
  );
};
