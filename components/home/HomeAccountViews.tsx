import React from "react";
import {
  Bell,
  CheckCheck,
  History,
  RefreshCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type { Character, GameHistory, Notification } from "../../types";
import type { HomePlayerHistoryItem } from "../../services/homeProfileModel";
import { summarizeMarkdown } from "../../services/squareMarkdown";
import { AvatarUpload } from "../AvatarUpload";
import { Messages } from "../Messages";
import { StaggeredItem } from "../Skeleton";
import { Button, Input, Textarea, cn } from "../UI";
import type { HomeTab } from "./HomeNavigation";

type AccountTab = Extract<HomeTab, "profile" | "notifications" | "settings">;
type SettingsSection = "profile" | "security";
type MessageCenterPane = "social" | "square";

interface HomeAccountViewsProps {
  activeTab: AccountTab;
  messageCenterPane: MessageCenterPane;
  onSelectMessageCenterPane: (pane: MessageCenterPane) => void;
  settingsSection: SettingsSection;
  setSettingsSection: (section: SettingsSection) => void;
  currentUserId: string | null;
  userCode: number | null;
  userNickname: string | null;
  userBio: string | null;
  userAvatar: string | null;
  userCreatedAt: string | null;
  isVip: boolean;
  levelInfo?: {
    level: number;
    experience: number;
    nextLevelExp: number;
  };
  kpHistory: GameHistory[];
  playerHistory: HomePlayerHistoryItem[];
  editNickname: string;
  setEditNickname: (value: string) => void;
  editBio: string;
  setEditBio: (value: string) => void;
  editAvatar: string | null;
  setEditAvatar: (value: string | null) => void;
  newPassword: string;
  setNewPassword: (value: string) => void;
  confirmNewPassword: string;
  setConfirmNewPassword: (value: string) => void;
  loading: boolean;
  notifications: Notification[];
  unreadCount: number;
  socialMessageCount: number;
  myCharacters: Character[];
  initialInviteToken?: string | null;
  onMarkNotificationRead: (notificationId: string) => void | Promise<void>;
  onDeleteNotification: (notificationId: string) => void | Promise<void>;
  onRefreshNotifications: () => void | Promise<void>;
  onLoginRequest: () => void;
  onJoinRoom: (
    roomId: string,
    charId: string,
    password?: string | null,
    isRestoring?: boolean,
    invitation?: { invitationId?: string; inviteToken?: string }
  ) => Promise<void> | void;
  onInviteTokenHandled?: () => void;
  onSaveProfile: () => void | Promise<void>;
  onResetProfile: () => void;
  onChangePassword: () => void | Promise<void>;
  onShowHistory: () => void;
}

export const HomeAccountViews: React.FC<HomeAccountViewsProps> = ({
  activeTab,
  messageCenterPane,
  onSelectMessageCenterPane,
  settingsSection,
  setSettingsSection,
  currentUserId,
  userCode,
  userNickname,
  userBio,
  userAvatar,
  userCreatedAt,
  isVip,
  levelInfo,
  kpHistory,
  playerHistory,
  editNickname,
  setEditNickname,
  editBio,
  setEditBio,
  editAvatar,
  setEditAvatar,
  newPassword,
  setNewPassword,
  confirmNewPassword,
  setConfirmNewPassword,
  loading,
  notifications,
  unreadCount,
  socialMessageCount,
  myCharacters,
  initialInviteToken,
  onMarkNotificationRead,
  onDeleteNotification,
  onRefreshNotifications,
  onLoginRequest,
  onJoinRoom,
  onInviteTokenHandled,
  onSaveProfile,
  onResetProfile,
  onChangePassword,
  onShowHistory,
}) => {
  const displayName = userNickname || "未命名用户";
  const displayBio = normalizeBio(userBio);
  const totalHistory = kpHistory.length + playerHistory.length;
  const accountCreatedDate = userCreatedAt
    ? new Date(userCreatedAt).toLocaleDateString()
    : "---";

  return (
    <div className="mx-auto max-w-screen-xl space-y-6">
      {activeTab === "profile" && (
        <StandaloneAccountPage
          title="个人中心"
          description={`UID: ${userCode || "---"} · 注册时间: ${accountCreatedDate}`}
        >
          <ProfileCenter
            displayName={displayName}
            displayBio={displayBio}
            userAvatar={userAvatar}
            userCode={userCode}
            userCreatedAt={userCreatedAt}
            isVip={isVip}
            levelInfo={levelInfo}
            kpHistory={kpHistory}
            playerHistory={playerHistory}
            totalHistory={totalHistory}
            onShowHistory={onShowHistory}
          />
        </StandaloneAccountPage>
      )}

      {activeTab === "notifications" && (
        <StandaloneAccountPage
          title="消息中心"
          description={
            socialMessageCount + unreadCount > 0
              ? `${socialMessageCount} 条私信/邀请待处理 · ${unreadCount} 条广场未读`
              : "私信、房间邀请和广场通知集中在这里处理。"
          }
        >
          <UnifiedMessagesCenter
            currentUserId={currentUserId}
            myCharacters={myCharacters}
            initialInviteToken={initialInviteToken}
            activePane={messageCenterPane}
            socialMessageCount={socialMessageCount}
            notifications={notifications}
            unreadCount={unreadCount}
            onSelectPane={onSelectMessageCenterPane}
            onMarkNotificationRead={onMarkNotificationRead}
            onDeleteNotification={onDeleteNotification}
            onRefreshNotifications={onRefreshNotifications}
            onLoginRequest={onLoginRequest}
            onJoinRoom={onJoinRoom}
            onInviteTokenHandled={onInviteTokenHandled}
          />
        </StandaloneAccountPage>
      )}

      {activeTab === "settings" && (
        <StandaloneAccountPage
          title="设置"
          description="管理账户资料、头像和登录安全。"
          toolbar={
            <SettingsSectionTabs
              section={settingsSection}
              onSelect={setSettingsSection}
            />
          }
        >
          <SettingsCenter
            section={settingsSection}
            editNickname={editNickname}
            setEditNickname={setEditNickname}
            editBio={editBio}
            setEditBio={setEditBio}
            editAvatar={editAvatar}
            setEditAvatar={setEditAvatar}
            userAvatar={userAvatar}
            newPassword={newPassword}
            setNewPassword={setNewPassword}
            confirmNewPassword={confirmNewPassword}
            setConfirmNewPassword={setConfirmNewPassword}
            loading={loading}
            onSaveProfile={onSaveProfile}
            onResetProfile={onResetProfile}
            onChangePassword={onChangePassword}
          />
        </StandaloneAccountPage>
      )}
    </div>
  );
};

const StandaloneAccountPage: React.FC<{
  title: string;
  description: string;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, description, toolbar, children }) => (
  <section className="min-w-0 space-y-5">
    <div className="flex flex-col gap-4 rounded-lg border border-dicecho-border/40 bg-dicecho-panel/75 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
      <div className="min-w-0">
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        <p className="mt-1 text-sm text-dicecho-muted">{description}</p>
      </div>
      {toolbar && <div className="shrink-0">{toolbar}</div>}
    </div>
    {children}
  </section>
);

const ProfileCenter: React.FC<{
  displayName: string;
  displayBio: string;
  userAvatar: string | null;
  userCode: number | null;
  userCreatedAt: string | null;
  isVip: boolean;
  levelInfo?: { level: number; experience: number; nextLevelExp: number };
  kpHistory: GameHistory[];
  playerHistory: HomePlayerHistoryItem[];
  totalHistory: number;
  onShowHistory: () => void;
}> = ({
  displayName,
  displayBio,
  userAvatar,
  userCode,
  userCreatedAt,
  isVip,
  levelInfo,
  kpHistory,
  playerHistory,
  totalHistory,
  onShowHistory,
}) => (
  <div className="space-y-6">
    <div className="overflow-hidden rounded-lg border border-dicecho-border/40 bg-dicecho-panel/75">
      <div className="px-6 py-6 md:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <AvatarUpload
            url={userAvatar}
            onUpload={() => {}}
            editable={false}
            size={96}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-2xl font-bold text-white">
                {displayName}
              </h2>
              {levelInfo && (
                <span className="rounded border border-dicecho-primary/30 bg-dicecho-primary/15 px-2 py-0.5 text-xs font-bold text-dicecho-primary">
                  LV.{levelInfo.level}
                </span>
              )}
              {isVip && (
                <span className="rounded border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-xs font-bold text-amber-200">
                  VIP
                </span>
              )}
            </div>
            <p className="mt-2 text-sm leading-6 text-dicecho-muted">
              {displayBio || "暂无签名"}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-dicecho-muted">
              <span>UID: {userCode || "---"}</span>
              <span>
                注册时间:{" "}
                {userCreatedAt ? new Date(userCreatedAt).toLocaleDateString() : "---"}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <ProfileStat label="跑团履历" value={totalHistory} />
          <ProfileStat label="参与的团" value={playerHistory.length} />
          <ProfileStat label="主持的团" value={kpHistory.length} />
        </div>
      </div>
    </div>

    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="rounded-lg border border-dicecho-border/40 bg-dicecho-panel/75 p-6 md:p-8">
        <h3 className="text-base font-bold text-white">简介</h3>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-300">
          {displayBio || "这个人还没有留下简介。"}
        </p>
      </section>

      <section className="rounded-lg border border-dicecho-border/40 bg-dicecho-panel/75 p-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-bold text-white">个人履历</h3>
          <Button variant="secondary" size="sm" icon={History} onClick={onShowHistory}>
            查看
          </Button>
        </div>
        <div className="mt-5 space-y-3 text-sm">
          <HistoryLine label="参与" value={`${playerHistory.length} 个团`} />
          <HistoryLine label="主持" value={`${kpHistory.length} 个团`} />
          <HistoryLine label="总计" value={`${totalHistory} 条记录`} />
        </div>
      </section>
    </div>
  </div>
);

const NotificationsCenter: React.FC<{
  notifications: Notification[];
  unreadCount: number;
  onMarkNotificationRead: (notificationId: string) => void | Promise<void>;
  onDeleteNotification: (notificationId: string) => void | Promise<void>;
  onRefreshNotifications: () => void | Promise<void>;
}> = ({
  notifications,
  unreadCount,
  onMarkNotificationRead,
  onDeleteNotification,
  onRefreshNotifications,
}) => {
  const markAllRead = () => {
    notifications
      .filter((notification) => !notification.is_read)
      .forEach((notification) => {
        void onMarkNotificationRead(notification.id);
      });
  };

  return (
    <div className="overflow-hidden rounded-lg border border-dicecho-border/40 bg-dicecho-panel/75">
      <div className="flex flex-col gap-3 border-b border-dicecho-border/35 px-6 py-5 md:flex-row md:items-center md:justify-between md:px-8">
        <div>
          <h2 className="text-xl font-bold text-white">消息中心</h2>
          <p className="mt-1 text-sm text-dicecho-muted">
            {unreadCount > 0 ? `${unreadCount} 条未读消息` : "所有消息均已读"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            icon={RefreshCcw}
            onClick={() => void onRefreshNotifications()}
          >
            刷新
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={CheckCheck}
            disabled={unreadCount === 0}
            onClick={markAllRead}
          >
            全部已读
          </Button>
        </div>
      </div>

      <div className="divide-y divide-dicecho-border/30">
        {notifications.length === 0 ? (
          <div className="px-6 py-16 text-center md:px-8">
            <Bell size={42} className="mx-auto text-dicecho-muted/40" />
            <p className="mt-4 text-sm text-dicecho-muted">暂无消息</p>
          </div>
        ) : (
          notifications.map((notification, index) => (
            <StaggeredItem key={notification.id} index={index}>
              <NotificationRow
                notification={notification}
                onMarkRead={onMarkNotificationRead}
                onDelete={onDeleteNotification}
              />
            </StaggeredItem>
          ))
        )}
      </div>
    </div>
  );
};

const UnifiedMessagesCenter: React.FC<{
  currentUserId: string | null;
  myCharacters: Character[];
  initialInviteToken?: string | null;
  activePane: MessageCenterPane;
  socialMessageCount: number;
  notifications: Notification[];
  unreadCount: number;
  onSelectPane: (pane: MessageCenterPane) => void;
  onMarkNotificationRead: (notificationId: string) => void | Promise<void>;
  onDeleteNotification: (notificationId: string) => void | Promise<void>;
  onRefreshNotifications: () => void | Promise<void>;
  onLoginRequest: () => void;
  onJoinRoom: (
    roomId: string,
    charId: string,
    password?: string | null,
    isRestoring?: boolean,
    invitation?: { invitationId?: string; inviteToken?: string }
  ) => Promise<void> | void;
  onInviteTokenHandled?: () => void;
}> = ({
  currentUserId,
  myCharacters,
  initialInviteToken,
  activePane,
  socialMessageCount,
  notifications,
  unreadCount,
  onSelectPane,
  onMarkNotificationRead,
  onDeleteNotification,
  onRefreshNotifications,
  onLoginRequest,
  onJoinRoom,
  onInviteTokenHandled,
}) => (
  <div className="space-y-4">
    <div className="flex flex-wrap gap-2 rounded-lg border border-dicecho-border/40 bg-dicecho-panel/75 p-2">
      <MessageCenterTabButton
        label="私信与邀请"
        active={activePane === "social"}
        badge={socialMessageCount}
        onClick={() => onSelectPane("social")}
      />
      <MessageCenterTabButton
        label="广场通知"
        active={activePane === "square"}
        badge={unreadCount}
        onClick={() => onSelectPane("square")}
      />
    </div>

    {activePane === "social" ? (
      <Messages
        currentUserId={currentUserId}
        myCharacters={myCharacters}
        initialInviteToken={initialInviteToken}
        onLoginRequest={onLoginRequest}
        onJoinRoom={onJoinRoom}
        onInviteTokenHandled={onInviteTokenHandled}
      />
    ) : (
      <NotificationsCenter
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkNotificationRead={onMarkNotificationRead}
        onDeleteNotification={onDeleteNotification}
        onRefreshNotifications={onRefreshNotifications}
      />
    )}
  </div>
);

const MessageCenterTabButton: React.FC<{
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
}> = ({ label, active, badge = 0, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors",
      active
        ? "bg-dicecho-primary/25 text-white"
        : "text-dicecho-muted hover:bg-white/10 hover:text-white"
    )}
  >
    <span>{label}</span>
    {badge > 0 && (
      <span className="rounded-full bg-dicecho-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
        {badge > 99 ? "99+" : badge}
      </span>
    )}
  </button>
);

const SettingsSectionTabs: React.FC<{
  section: SettingsSection;
  onSelect: (section: SettingsSection) => void;
}> = ({ section, onSelect }) => (
  <div className="inline-flex rounded-lg border border-dicecho-border/45 bg-dicecho-card/50 p-1">
    <button
      type="button"
      onClick={() => onSelect("profile")}
      className={cn(
        "min-h-9 rounded-md px-3 text-sm font-semibold transition-colors",
        section === "profile"
          ? "bg-dicecho-primary/25 text-white"
          : "text-dicecho-muted hover:bg-white/10 hover:text-white"
      )}
    >
      个人资料
    </button>
    <button
      type="button"
      onClick={() => onSelect("security")}
      className={cn(
        "min-h-9 rounded-md px-3 text-sm font-semibold transition-colors",
        section === "security"
          ? "bg-dicecho-primary/25 text-white"
          : "text-dicecho-muted hover:bg-white/10 hover:text-white"
      )}
    >
      密码与安全
    </button>
  </div>
);

const SettingsCenter: React.FC<{
  section: SettingsSection;
  editNickname: string;
  setEditNickname: (value: string) => void;
  editBio: string;
  setEditBio: (value: string) => void;
  editAvatar: string | null;
  setEditAvatar: (value: string | null) => void;
  userAvatar: string | null;
  newPassword: string;
  setNewPassword: (value: string) => void;
  confirmNewPassword: string;
  setConfirmNewPassword: (value: string) => void;
  loading: boolean;
  onSaveProfile: () => void | Promise<void>;
  onResetProfile: () => void;
  onChangePassword: () => void | Promise<void>;
}> = ({
  section,
  editNickname,
  setEditNickname,
  editBio,
  setEditBio,
  editAvatar,
  setEditAvatar,
  userAvatar,
  newPassword,
  setNewPassword,
  confirmNewPassword,
  setConfirmNewPassword,
  loading,
  onSaveProfile,
  onResetProfile,
  onChangePassword,
}) => (
  <div className="overflow-hidden rounded-lg border border-dicecho-border/40 bg-dicecho-panel/75">
    {section === "profile" ? (
      <>
        <div className="border-b border-dicecho-border/35 px-6 py-5 md:px-8">
          <h2 className="text-xl font-bold text-white">个人资料</h2>
          <p className="mt-1 text-sm text-dicecho-muted">
            修改头像、昵称和个人简介。
          </p>
        </div>
        <div className="space-y-6 px-6 py-6 md:px-8">
          <div className="flex items-center gap-4">
            <AvatarUpload
              url={editAvatar || userAvatar}
              onUpload={(url) => setEditAvatar(url)}
              editable
              size={72}
            />
            <div>
              <div className="text-sm font-medium text-white">头像</div>
              <div className="mt-1 text-xs text-dicecho-muted">
                点击头像上传或更换图片。
              </div>
            </div>
          </div>
          <Input
            label="昵称"
            value={editNickname}
            onChange={(event) => setEditNickname(event.target.value)}
            maxLength={40}
          />
          <Textarea
            label="个人简介"
            value={editBio}
            onChange={(event) => setEditBio(event.target.value)}
            rows={9}
            maxLength={2000}
            placeholder="编辑您的个人简介..."
          />
        </div>
        <div className="flex justify-end gap-3 border-t border-dicecho-border/35 bg-dicecho-card/50 px-6 py-4 md:px-8">
          <Button variant="ghost" onClick={onResetProfile}>
            还原
          </Button>
          <Button onClick={() => void onSaveProfile()} disabled={loading}>
            {loading ? "保存中..." : "保存"}
          </Button>
        </div>
      </>
    ) : (
      <>
        <div className="border-b border-dicecho-border/35 px-6 py-5 md:px-8">
          <h2 className="text-xl font-bold text-white">密码与安全</h2>
          <p className="mt-1 text-sm text-dicecho-muted">
            设置一个至少 6 位的新密码。
          </p>
        </div>
        <div className="max-w-xl space-y-5 px-6 py-6 md:px-8">
          <Input
            label="新密码"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="请输入新密码"
          />
          <Input
            label="确认新密码"
            type="password"
            value={confirmNewPassword}
            onChange={(event) => setConfirmNewPassword(event.target.value)}
            placeholder="请再次输入新密码"
          />
        </div>
        <div className="flex justify-end border-t border-dicecho-border/35 bg-dicecho-card/50 px-6 py-4 md:px-8">
          <Button
            onClick={() => void onChangePassword()}
            disabled={!newPassword || newPassword.length < 6 || loading}
            icon={ShieldCheck}
          >
            {loading ? "更新中..." : "更新密码"}
          </Button>
        </div>
      </>
    )}
  </div>
);

const ProfileStat: React.FC<{ label: string; value: number }> = ({
  label,
  value,
}) => (
  <div className="rounded-lg border border-dicecho-border/35 bg-dicecho-card/60 p-4">
    <div className="text-xs font-semibold text-dicecho-muted">{label}</div>
    <div className="mt-1 text-2xl font-bold text-dicecho-primary">{value}</div>
  </div>
);

const HistoryLine: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div className="flex items-center justify-between rounded-lg bg-dicecho-card/50 px-3 py-2">
    <span className="text-dicecho-muted">{label}</span>
    <span className="font-medium text-slate-200">{value}</span>
  </div>
);

const NotificationRow: React.FC<{
  notification: Notification;
  onMarkRead: (notificationId: string) => void | Promise<void>;
  onDelete: (notificationId: string) => void | Promise<void>;
}> = ({ notification, onMarkRead, onDelete }) => {
  const actorName = notification.actor?.nickname || "未知用户";
  const actionLabel =
    notification.type === "like" ? "赞了你的帖子" : "评论了你的帖子";

  return (
    <article
      className={cn(
        "group flex gap-4 px-6 py-4 transition-colors hover:bg-white/10 md:px-8",
        !notification.is_read && "bg-dicecho-primary/10"
      )}
    >
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-dicecho-border/40 bg-dicecho-card">
        {notification.actor?.avatar_url ? (
          <img
            src={notification.actor.avatar_url}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-sm font-bold text-dicecho-muted">
            {actorName[0] || "?"}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-bold text-white">{actorName}</span>
          <span className="text-slate-300">{actionLabel}</span>
          {!notification.is_read && (
            <span className="h-2 w-2 rounded-full bg-dicecho-primary" />
          )}
        </div>
        {notification.post?.content && (
          <p className="mt-1 truncate text-sm text-dicecho-muted">
            “{summarizeMarkdown(notification.post.content)}”
          </p>
        )}
        <p className="mt-2 text-xs text-dicecho-muted">
          {new Date(notification.created_at).toLocaleString()}
        </p>
      </div>

      <div className="flex shrink-0 items-start gap-1">
        {!notification.is_read && (
          <button
            type="button"
            onClick={() => void onMarkRead(notification.id)}
            className="rounded-md p-2 text-dicecho-muted transition-colors hover:bg-white/10 hover:text-white"
            title="标记已读"
          >
            <CheckCheck size={16} />
          </button>
        )}
        <button
          type="button"
          onClick={() => void onDelete(notification.id)}
          className="rounded-md p-2 text-dicecho-muted transition-colors hover:bg-red-500/10 hover:text-red-300"
          title="删除消息"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  );
};

function normalizeBio(bio: string | null) {
  if (!bio || bio === "NaN" || bio === "null") return "";
  return bio;
}
