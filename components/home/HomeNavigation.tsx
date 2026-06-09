import React from "react";
import { LogOut } from "lucide-react";
import { Button, cn } from "../UI";

export type HomeTab = "rooms" | "characters" | "friends" | "profile" | "square";

const HOME_TABS: { id: HomeTab; label: string }[] = [
  { id: "rooms", label: "大厅" },
  { id: "square", label: "广场" },
  { id: "characters", label: "车卡" },
  { id: "friends", label: "好友" },
  { id: "profile", label: "我的" },
];

interface HomeHeaderProps {
  activeTab: HomeTab;
  showHeader: boolean;
  friendRequestCount: number;
  onSelectTab: (tab: HomeTab) => void;
  onLogout: () => void;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  activeTab,
  showHeader,
  friendRequestCount,
  onSelectTab,
  onLogout,
}) => (
  <header
    className={cn(
      "min-h-[4rem] h-auto pt-safe border-b border-white/5 bg-slate-900/50 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-20 transition-all duration-300 ease-in-out",
      showHeader
        ? "translate-y-0"
        : "-translate-y-full -mb-[4.1rem] opacity-0 pointer-events-none"
    )}
  >
    <div className="flex items-center gap-4">
      <h1 className="text-xl font-bold text-white tracking-tight">
        RunTable Pro
      </h1>
      <nav className="hidden md:flex bg-slate-800/50 p-1 rounded-lg">
        {HOME_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm font-medium transition-all",
              activeTab === tab.id
                ? "bg-indigo-600 text-white shadow-lg"
                : "text-slate-400 hover:text-white",
              tab.id === "friends" && "relative"
            )}
          >
            {tab.label}
            {tab.id === "friends" && friendRequestCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse" />
            )}
          </button>
        ))}
      </nav>
    </div>
    <Button variant="ghost" icon={LogOut} onClick={onLogout}>
      退出
    </Button>
  </header>
);

interface HomeMobileNavProps {
  activeTab: HomeTab;
  friendRequestCount: number;
  onSelectTab: (tab: HomeTab) => void;
  mode: "default" | "square";
  showHeader?: boolean;
}

export const HomeMobileNav: React.FC<HomeMobileNavProps> = ({
  activeTab,
  friendRequestCount,
  onSelectTab,
  mode,
  showHeader = true,
}) => (
  <div
    className={cn(
      "md:hidden flex bg-slate-800/50 p-1 rounded-lg",
      mode === "default" && "mb-6",
      mode === "square" &&
        "m-4 shrink-0 overflow-hidden transition-all duration-300 ease-in-out",
      mode === "square" &&
        (showHeader
          ? "translate-y-0 opacity-100"
          : "-translate-y-full -mt-16 opacity-0 pointer-events-none")
    )}
  >
    {HOME_TABS.map((tab) => (
      <button
        key={tab.id}
        onClick={() => onSelectTab(tab.id)}
        className={cn(
          "flex-1 py-2 rounded-md text-sm font-medium",
          activeTab === tab.id ? "bg-indigo-600 text-white" : "text-slate-400",
          tab.id === "friends" && "relative"
        )}
      >
        {tab.label}
        {tab.id === "friends" && friendRequestCount > 0 && (
          <span className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        )}
      </button>
    ))}
  </div>
);

