import React from "react";
import {
  Bell,
  BookOpen,
  Dices,
  LogIn,
  LogOut,
  MessageSquare,
  Settings,
  User,
  Users,
} from "lucide-react";
import { Button, cn } from "../UI";

export type HomeTab =
  | "rooms"
  | "characters"
  | "friends"
  | "profile"
  | "notifications"
  | "settings"
  | "square";

const HOME_TABS: { id: HomeTab; label: string; icon: React.ElementType }[] = [
  { id: "rooms", label: "大厅", icon: BookOpen },
  { id: "square", label: "广场", icon: MessageSquare },
  { id: "characters", label: "车卡", icon: Dices },
  { id: "friends", label: "好友", icon: Users },
];

interface HomeHeaderProps {
  activeTab: HomeTab;
  friendRequestCount: number;
  notificationUnreadCount?: number;
  onSelectTab: (tab: HomeTab) => void;
  isAuthenticated: boolean;
  userAvatar?: string | null;
  userNickname?: string | null;
  onAuthAction: () => void;
  onLoginRequest: () => void;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  activeTab,
  friendRequestCount,
  notificationUnreadCount = 0,
  onSelectTab,
  isAuthenticated,
  userAvatar,
  userNickname,
  onAuthAction,
  onLoginRequest,
}) => {
  const [showUserMenu, setShowUserMenu] = React.useState(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);
  const handleSelectTab = (tab: HomeTab) => {
    if (!isAuthenticated && tab !== "rooms") {
      onLoginRequest();
      return;
    }
    onSelectTab(tab);
  };

  React.useEffect(() => {
    if (!showUserMenu) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowUserMenu(false);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [showUserMenu]);

  const openProfile = () => {
    setShowUserMenu(false);
    handleSelectTab("profile");
  };

  const openNotifications = () => {
    setShowUserMenu(false);
    handleSelectTab("notifications");
  };

  const openSettings = () => {
    setShowUserMenu(false);
    handleSelectTab("settings");
  };

  const handleLogout = () => {
    setShowUserMenu(false);
    onAuthAction();
  };

  return (
    <header className="min-h-[4rem] h-auto pt-safe border-b border-dicecho-border/40 bg-dicecho-panel/95 backdrop-blur-md sticky top-0 z-20 shadow">
      <div className="mx-auto flex min-h-16 w-full max-w-screen-2xl items-center justify-between gap-4 px-4 md:px-8">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-dicecho-primary text-white shadow-sm">
              <Dices size={19} />
            </span>
            <h1 className="text-xl font-bold text-white tracking-normal">
              RunTable
            </h1>
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            {HOME_TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleSelectTab(tab.id)}
                  className={cn(
                    "relative inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                    activeTab === tab.id
                      ? "bg-dicecho-primary/20 text-white"
                      : "text-dicecho-muted hover:bg-white/10 hover:text-white",
                    tab.id === "friends" && "relative"
                  )}
                >
                  <Icon size={16} />
                  {tab.label}
                  {tab.id === "friends" && friendRequestCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-dicecho-panel bg-red-500 animate-pulse" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
        {!isAuthenticated ? (
          <Button variant="primary" icon={LogIn} onClick={onAuthAction}>
            登录
          </Button>
        ) : (
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setShowUserMenu((previous) => !previous)}
              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-dicecho-border/55 bg-dicecho-card text-dicecho-muted transition-colors hover:border-dicecho-primary/70 hover:text-white"
              aria-label="打开用户菜单"
              aria-expanded={showUserMenu}
            >
              {userAvatar ? (
                <img
                  src={userAvatar}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <User size={18} />
              )}
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-lg border border-dicecho-border/45 bg-dicecho-panel shadow-xl shadow-black/25">
                <div className="px-4 py-4 text-center">
                  <p className="truncate text-sm font-medium text-slate-200">
                    {userNickname || "未命名用户"}
                  </p>
                </div>
                <div className="border-t border-dicecho-border/35 py-2">
                  <UserMenuItem icon={User} label="个人中心" onClick={openProfile} />
                  <UserMenuItem
                    icon={Bell}
                    label="消息中心"
                    badge={notificationUnreadCount}
                    onClick={openNotifications}
                  />
                  <UserMenuItem icon={Settings} label="设置" onClick={openSettings} />
                </div>
                <div className="border-t border-dicecho-border/35 py-2">
                  <UserMenuItem icon={LogOut} label="登出" onClick={handleLogout} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

const UserMenuItem: React.FC<{
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  badge?: number;
}> = ({ icon: Icon, label, onClick, disabled, badge = 0 }) => (
  <button
    type="button"
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
    className={cn(
      "flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors",
      disabled
        ? "cursor-not-allowed text-dicecho-muted/40"
        : "text-dicecho-muted hover:bg-white/10 hover:text-white"
    )}
  >
    <Icon size={16} />
    <span className="flex-1">{label}</span>
    {badge > 0 && (
      <span className="rounded-full bg-dicecho-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
        {badge > 99 ? "99+" : badge}
      </span>
    )}
  </button>
);

interface HomeMobileNavProps {
  activeTab: HomeTab;
  friendRequestCount: number;
  onSelectTab: (tab: HomeTab) => void;
  isAuthenticated: boolean;
  onLoginRequest: () => void;
  mode: "default" | "square";
}

export const HomeMobileNav: React.FC<HomeMobileNavProps> = ({
  activeTab,
  friendRequestCount,
  onSelectTab,
  isAuthenticated,
  onLoginRequest,
  mode,
}) => {
  const handleSelectTab = (tab: HomeTab) => {
    if (!isAuthenticated && tab !== "rooms") {
      onLoginRequest();
      return;
    }
    onSelectTab(tab);
  };

  return (
    <div
      className={cn(
        "md:hidden flex rounded-lg border border-dicecho-border/40 bg-dicecho-panel/90 p-1 shadow-sm",
        mode === "default" && "mb-6",
        mode === "square" && "m-4 shrink-0 overflow-hidden"
      )}
    >
      {HOME_TABS.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => handleSelectTab(tab.id)}
            className={cn(
              "relative flex-1 rounded-md py-2 text-sm font-medium transition-all",
              activeTab === tab.id
                ? "bg-dicecho-primary/25 text-white"
                : "text-dicecho-muted"
            )}
            title={tab.label}
          >
            <Icon size={16} className="mx-auto mb-0.5" />
            <span className="block text-[11px] leading-none">{tab.label}</span>
            {tab.id === "friends" && friendRequestCount > 0 && (
              <span className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
          </button>
        );
      })}
    </div>
  );
};
