import React from "react";
import { Hash, MessageSquare, X } from "lucide-react";
import type { Channel } from "../../types";
import { useElasticScroll } from "../../hooks/useElasticScroll";
import { cn } from "../UI";
import { ChannelSkeletonList } from "../Skeleton";

interface SquareChannelSidebarProps {
  activeChannelId: string | null;
  categories: string[];
  channels: Channel[];
  loadingChannels: boolean;
  showMobileSidebar: boolean;
  onClose: () => void;
  onSelectChannel: (channelId: string) => void;
}

export const SquareChannelSidebar: React.FC<SquareChannelSidebarProps> = ({
  activeChannelId,
  categories,
  channels,
  loadingChannels,
  showMobileSidebar,
  onClose,
  onSelectChannel,
}) => {
  const channelScrollRef = React.useRef<HTMLDivElement>(null);
  const channelContentRef = React.useRef<HTMLDivElement>(null);
  useElasticScroll(channelScrollRef, channelContentRef);

  return (
    <>
      {showMobileSidebar && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      <div
        className={cn(
          "w-64 flex-shrink-0 border-r border-dicecho-border/40 bg-dicecho-panel/95 md:bg-dicecho-panel/75 flex flex-col transition-transform duration-300 ease-in-out z-50",
          "fixed inset-y-0 left-0 md:relative md:translate-x-0",
          showMobileSidebar ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-16 flex items-center px-4 border-b border-dicecho-border/40 justify-between">
          <h2 className="font-bold text-white flex items-center gap-2">
            <MessageSquare className="text-dicecho-primary" size={20} />
            广场频道
          </h2>
          <button
            className="md:hidden text-dicecho-muted hover:text-white"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <div
          ref={channelScrollRef}
          className="flex-1 overflow-y-auto p-3 custom-scrollbar overscroll-y-none"
        >
          <div ref={channelContentRef} className="space-y-6">
            {loadingChannels ? (
              <ChannelSkeletonList />
            ) : (
              categories.map((category) => (
                <div key={category}>
                  <h3 className="text-xs font-bold text-dicecho-muted uppercase px-3 mb-2 tracking-wider">
                    {category}
                  </h3>
                  <div className="space-y-0.5">
                    {channels
                      .filter((channel) => channel.category === category)
                      .map((channel) => (
                        <button
                          key={channel.id}
                          onClick={() => onSelectChannel(channel.id)}
                          className={cn(
                            "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 group",
                            activeChannelId === channel.id
                              ? "bg-dicecho-primary/20 text-white"
                              : "text-dicecho-muted hover:bg-white/10 hover:text-slate-200"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <Hash
                              size={16}
                              className={
                                activeChannelId === channel.id
                                  ? "text-dicecho-primary"
                                  : "text-dicecho-muted group-hover:text-slate-300"
                              }
                            />
                            {channel.name}
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-4 border-t border-dicecho-border/40">
          <div className="bg-dicecho-card/70 rounded-lg border border-dicecho-border/30 p-3 text-xs text-dicecho-muted">
            <p className="font-bold text-slate-200 mb-1">RunTable 广场</p>
            <p>这里是所有调查员的聚集地。</p>
          </div>
        </div>
      </div>
    </>
  );
};
