import React from "react";
import { cn } from "./UI";

export const SkeletonBlock: React.FC<{
  className?: string;
}> = ({ className }) => (
  <div
    className={cn(
      "animate-pulse rounded-md bg-dicecho-border/25",
      className
    )}
  />
);

export const StaggeredItem: React.FC<
  React.HTMLAttributes<HTMLDivElement> & {
    index: number;
    children: React.ReactNode;
  }
> = ({ index: _index, className, children, style, ...props }) => (
  <div className={className} style={style} {...props}>
    {children}
  </div>
);

export const FeedCardSkeleton: React.FC<{ compact?: boolean }> = ({
  compact = false,
}) => (
  <div className="flex gap-4 rounded-lg border border-dicecho-border/40 bg-dicecho-card/75 p-4 shadow-sm dicecho-card-shadow">
    <SkeletonBlock className="h-10 w-10 shrink-0 rounded-full" />
    <div className="min-w-0 flex-1 space-y-3">
      <div className="flex items-center gap-2">
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="h-3 w-12" />
      </div>
      <div className="space-y-2">
        <SkeletonBlock className="h-3 w-11/12" />
        <SkeletonBlock className="h-3 w-3/4" />
        {!compact && <SkeletonBlock className="h-3 w-1/2" />}
      </div>
      <div className="flex justify-between pt-2">
        <SkeletonBlock className="h-3 w-14" />
        <div className="flex gap-4">
          <SkeletonBlock className="h-3 w-12" />
          <SkeletonBlock className="h-3 w-10" />
        </div>
      </div>
    </div>
  </div>
);

export const FeedSkeletonList: React.FC<{ count?: number }> = ({
  count = 3,
}) => (
  <div className="space-y-6">
    {Array.from({ length: count }).map((_, index) => (
      <StaggeredItem key={index} index={index}>
        <FeedCardSkeleton compact={index > 0} />
      </StaggeredItem>
    ))}
  </div>
);

export const ChannelSkeletonList: React.FC = () => (
  <div className="space-y-6">
    {Array.from({ length: 3 }).map((_, groupIndex) => (
      <div key={groupIndex} className="space-y-2 px-3">
        <SkeletonBlock className="h-3 w-16" />
        <div className="space-y-1">
          {Array.from({ length: groupIndex === 0 ? 1 : 2 }).map(
            (_, itemIndex) => (
              <SkeletonBlock
                key={itemIndex}
                className="h-9 w-full rounded-lg"
              />
            )
          )}
        </div>
      </div>
    ))}
  </div>
);

export const CharacterCardSkeleton: React.FC = () => (
  <div className="rounded-lg border border-dicecho-border/40 bg-dicecho-card/75 p-5 shadow-sm">
    <div className="mb-4 flex gap-4">
      <SkeletonBlock className="h-16 w-16 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonBlock className="h-4 w-28" />
        <SkeletonBlock className="h-3 w-20" />
        <div className="mt-2 flex gap-3">
          <SkeletonBlock className="h-5 w-12" />
          <SkeletonBlock className="h-5 w-14" />
        </div>
      </div>
    </div>
    <div className="space-y-2">
      <SkeletonBlock className="h-3 w-full" />
      <SkeletonBlock className="h-3 w-5/6" />
    </div>
    <SkeletonBlock className="mt-4 h-8 w-full rounded-lg" />
  </div>
);

export const FriendCardSkeleton: React.FC = () => (
  <div className="flex items-center gap-4 rounded-lg border border-dicecho-border/45 bg-dicecho-card/70 p-4 shadow-sm">
    <SkeletonBlock className="h-14 w-14 shrink-0 rounded-full" />
    <div className="min-w-0 flex-1 space-y-2">
      <SkeletonBlock className="h-4 w-28" />
      <SkeletonBlock className="h-3 w-20" />
      <SkeletonBlock className="h-3 w-36" />
    </div>
    <div className="space-y-1">
      <SkeletonBlock className="h-8 w-8 rounded-lg" />
      <SkeletonBlock className="h-8 w-8 rounded-lg" />
    </div>
  </div>
);

export const RoomCardSkeleton: React.FC = () => (
  <div className="flex min-h-full flex-col rounded-lg border border-dicecho-border/40 bg-dicecho-card/80 p-3 shadow-sm dicecho-card-shadow">
    <div className="relative isolate aspect-[3/4] overflow-hidden rounded-lg bg-dicecho-panel/65">
      <SkeletonBlock className="absolute inset-0 rounded-none bg-dicecho-border/18" />
      <div className="absolute left-2 top-2">
        <SkeletonBlock className="h-5 w-12 rounded-full bg-dicecho-border/35" />
      </div>
      <div className="absolute right-2 top-2">
        <SkeletonBlock className="h-7 w-7 rounded-full bg-dicecho-border/35" />
      </div>
      <div className="absolute inset-x-0 bottom-0 space-y-2 bg-gradient-to-t from-black/45 via-black/24 to-transparent px-3 pb-3 pt-10">
        <SkeletonBlock className="h-4 w-2/3 bg-dicecho-border/45" />
        <div className="space-y-1.5">
          <SkeletonBlock className="h-3 w-full bg-dicecho-border/35" />
          <SkeletonBlock className="h-3 w-4/5 bg-dicecho-border/30" />
        </div>
      </div>
    </div>
    <div className="mt-3 grid grid-cols-2 gap-2">
      <div className="rounded-lg border border-dicecho-border/30 bg-dicecho-panel/60 px-3 py-2">
        <SkeletonBlock className="h-3 w-16 bg-dicecho-border/30" />
        <SkeletonBlock className="mt-2 h-4 w-10 bg-dicecho-border/40" />
      </div>
      <div className="rounded-lg border border-dicecho-border/30 bg-dicecho-panel/60 px-3 py-2">
        <SkeletonBlock className="h-3 w-14 bg-dicecho-border/30" />
        <SkeletonBlock className="mt-2 h-4 w-8 bg-dicecho-border/40" />
      </div>
    </div>
  </div>
);

export const RoomGridSkeleton: React.FC<{ count?: number }> = ({
  count = 8,
}) => (
  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
    {Array.from({ length: count }).map((_, index) => (
      <StaggeredItem key={index} index={index}>
        <RoomCardSkeleton />
      </StaggeredItem>
    ))}
  </div>
);

export const HistoryCardSkeleton: React.FC = () => (
  <div className="rounded-lg border border-dicecho-border/40 bg-dicecho-card/70 p-3">
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonBlock className="h-4 w-36" />
        <SkeletonBlock className="h-3 w-28" />
      </div>
      <SkeletonBlock className="h-5 w-12 rounded" />
    </div>
    <div className="flex items-center gap-2 rounded-lg border border-dicecho-border/30 bg-dicecho-panel/60 p-1.5">
      <SkeletonBlock className="h-6 w-6 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="h-2.5 w-16" />
      </div>
    </div>
  </div>
);

export const HistorySkeletonList: React.FC<{ count?: number }> = ({
  count = 3,
}) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, index) => (
      <StaggeredItem key={index} index={index}>
        <HistoryCardSkeleton />
      </StaggeredItem>
    ))}
  </div>
);
