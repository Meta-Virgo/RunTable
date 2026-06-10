import React from "react";
import {
  BookOpen,
  Dices,
  LogOut,
  MessageSquare,
  User,
  Users,
} from "lucide-react";
import { Button, cn } from "../UI";

export type HomeTab = "rooms" | "characters" | "friends" | "profile" | "square";

const HOME_TABS: { id: HomeTab; label: string; icon: React.ElementType }[] = [
  { id: "rooms", label: "大厅", icon: BookOpen },
  { id: "square", label: "广场", icon: MessageSquare },
  { id: "characters", label: "车卡", icon: Dices },
  { id: "friends", label: "好友", icon: Users },
  { id: "profile", label: "我的", icon: User },
];

interface HomeHeaderProps {
  activeTab: HomeTab;
  friendRequestCount: number;
  onSelectTab: (tab: HomeTab) => void;
  onLogout: () => void;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  activeTab,
  friendRequestCount,
  onSelectTab,
  onLogout,
}) => (
  <header className="min-h-[4rem] h-auto pt-safe border-b border-dicecho-border/40 bg-dicecho-panel/95 backdrop-blur-md sticky top-0 z-20 shadow">
    <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
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
                onClick={() => onSelectTab(tab.id)}
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
      <Button variant="ghost" icon={LogOut} onClick={onLogout}>
        退出
      </Button>
    </div>
  </header>
);

interface HomeMobileNavProps {
  activeTab: HomeTab;
  friendRequestCount: number;
  onSelectTab: (tab: HomeTab) => void;
  mode: "default" | "square";
}

export const HomeMobileNav: React.FC<HomeMobileNavProps> = ({
  activeTab,
  friendRequestCount,
  onSelectTab,
  mode,
}) => (
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
          onClick={() => onSelectTab(tab.id)}
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
