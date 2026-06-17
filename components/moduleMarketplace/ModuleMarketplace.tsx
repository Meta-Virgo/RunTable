import React from "react";
import {
  AlertCircle,
  BookOpen,
  BookPlus,
  Check,
  ChevronDown,
  Edit3,
  Filter,
  Loader2,
  Map,
  Mic,
  MessageSquare,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import type { ModuleTemplate, ModuleTemplateDetail } from "../../types";
import { useModuleMarketplace } from "../../hooks/useModuleMarketplace";
import {
  getModuleTemplateComplexityLabel,
  getModuleTemplateDurationLabel,
  getModuleTemplatePlayersLabel,
} from "../../services/moduleMarketplace";
import { Button, Input, Modal, cn } from "../UI";
import { UserModuleUploadDialog } from "./UserModuleUploadDialog";

interface ModuleMarketplaceProps {
  isAuthenticated: boolean;
  currentUserId: string | null;
  onLoginRequest: () => void;
  onJoinRoom: (roomId: string, charId: string | "pc") => void;
  onRoomCreated?: () => void;
}

const SORT_OPTIONS = [
  { value: "newest", label: "最后发布时间" },
  { value: "title", label: "标题排序" },
  { value: "duration", label: "短团优先" },
] as const;

export const ModuleMarketplace: React.FC<ModuleMarketplaceProps> = ({
  isAuthenticated,
  currentUserId,
  onLoginRequest,
  onJoinRoom,
  onRoomCreated,
}) => {
  const [query, setQuery] = React.useState("");
  const [activeTag, setActiveTag] = React.useState<string | undefined>();
  const [sourceFilter, setSourceFilter] = React.useState<"all" | "mine">(
    "all"
  );
  const [systemFilter, setSystemFilter] = React.useState("all");
  const [complexityFilter, setComplexityFilter] = React.useState<
    ModuleTemplate["complexity"] | "all"
  >("all");
  const [playerRange, setPlayerRange] = React.useState<[number, number]>([
    1,
    12,
  ]);
  const [sortMode, setSortMode] = React.useState<
    "newest" | "title" | "duration"
  >("newest");
  const [createTarget, setCreateTarget] =
    React.useState<ModuleTemplateDetail | null>(null);
  const [showUploadDialog, setShowUploadDialog] = React.useState(false);
  const [editTarget, setEditTarget] =
    React.useState<ModuleTemplateDetail | null>(null);
  const marketplace = useModuleMarketplace({ query, tag: activeTag });

  const isTemplateOwner = React.useCallback(
    (template: ModuleTemplate | ModuleTemplateDetail) =>
      Boolean(currentUserId && template.created_by_user_id === currentUserId),
    [currentUserId]
  );

  const systemOptions = React.useMemo(
    () =>
      Array.from(
        new Set(marketplace.templates.map((template) => template.system))
      ).sort((left, right) => left.localeCompare(right)),
    [marketplace.templates]
  );

  const systemSelectOptions = React.useMemo(
    () => [
      { value: "all", label: "全部系统" },
      ...systemOptions.map((system) => ({
        value: system,
        label: system.toUpperCase(),
      })),
    ],
    [systemOptions]
  );

  const tagSelectOptions = React.useMemo(
    () => [
      { value: "all", label: "全部标签" },
      ...marketplace.tags.map((tag) => ({ value: tag, label: tag })),
    ],
    [marketplace.tags]
  );

  const visibleTemplates = React.useMemo(() => {
    const sorted = marketplace.visibleTemplates.filter((template) => {
      if (sourceFilter === "mine" && !isTemplateOwner(template)) return false;
      if (systemFilter !== "all" && template.system !== systemFilter) {
        return false;
      }
      if (
        complexityFilter !== "all" &&
        template.complexity !== complexityFilter
      ) {
        return false;
      }
      if (
        (playerRange[0] > 1 || playerRange[1] < 12) &&
        (template.recommended_players_max < playerRange[0] ||
          template.recommended_players_min > playerRange[1])
      ) {
        return false;
      }
      return true;
    });

    return [...sorted].sort((left, right) => {
      if (sortMode === "title") return left.title.localeCompare(right.title);
      if (sortMode === "duration") {
        return left.estimated_minutes_min - right.estimated_minutes_min;
      }
      const leftTime = Date.parse(left.published_at || left.updated_at || "");
      const rightTime = Date.parse(right.published_at || right.updated_at || "");
      return (rightTime || 0) - (leftTime || 0);
    });
  }, [
    complexityFilter,
    isTemplateOwner,
    marketplace.visibleTemplates,
    playerRange,
    sortMode,
    sourceFilter,
    systemFilter,
  ]);

  const openCreateDialog = (template: ModuleTemplateDetail) => {
    if (!isAuthenticated) {
      onLoginRequest();
      return;
    }
    setCreateTarget(template);
  };

  const handleCreated = (roomId: string) => {
    setCreateTarget(null);
    marketplace.closeTemplate();
    onRoomCreated?.();
    onJoinRoom(roomId, "pc");
  };

  const openUploadDialog = () => {
    if (!isAuthenticated) {
      onLoginRequest();
      return;
    }
    setShowUploadDialog(true);
  };

  const resetFilters = () => {
    setActiveTag(undefined);
    setSourceFilter("all");
    setSystemFilter("all");
    setComplexityFilter("all");
    setPlayerRange([1, 12]);
    setSortMode("newest");
  };

  return (
    <div className="mx-auto w-full max-w-screen-2xl">
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_28rem]">
        <section className="min-w-0 space-y-5">
          <div className="space-y-5">
            <div className="flex min-w-0">
              <div className="relative min-w-0 flex-1">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-dicecho-muted"
                  size={17}
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="输入名称 / 简介 / 标签搜索模组"
                  className="h-10 w-full rounded-lg border border-dicecho-border/45 bg-dicecho-card/70 py-2 pl-10 pr-3 text-sm text-slate-100 shadow-sm outline-none transition-colors placeholder:text-slate-400/60 focus:border-dicecho-primary/70"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 border-b border-dicecho-border/35 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm text-dicecho-muted">
                {visibleTemplates.length} 条结果
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {activeTag ? `当前标签：${activeTag}` : "全部已发布模组"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ModuleSelect
                value={sortMode}
                options={SORT_OPTIONS}
                onChange={(value) => setSortMode(value as typeof sortMode)}
                className="min-w-[9rem]"
              />
            </div>
          </div>
          </div>

          {marketplace.isLoading ? (
            <ModuleMarketplaceLoading />
          ) : marketplace.error ? (
            <ModuleMarketplaceError
              message={marketplace.error}
              onRetry={marketplace.refresh}
            />
          ) : visibleTemplates.length === 0 ? (
            <div className="rounded-lg border border-dashed border-dicecho-border/45 bg-dicecho-panel/45 py-16 text-center text-dicecho-muted">
              <BookOpen size={42} className="mx-auto mb-3 opacity-50" />
              <p className="font-semibold text-slate-200">没有匹配的模组</p>
              <p className="mt-1 text-sm">换个关键词或重置筛选试试。</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-[repeat(auto-fill,minmax(11.5rem,13rem))] sm:justify-start">
              {visibleTemplates.map((template) => (
                <ModuleTemplateCard
                  key={template.id}
                  template={template}
                  onOpen={() => marketplace.openTemplate(template)}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <div className="grid grid-cols-1 gap-3">
            <Button
              className="h-10 w-full shadow-lg shadow-dicecho-primary/20"
              variant="primary"
              icon={BookPlus}
              onClick={openUploadDialog}
            >
              上传模组
            </Button>
          </div>

          <div className="rounded-lg border border-dicecho-border/35 bg-dicecho-panel/75 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-base font-bold text-white">
              <Filter size={18} className="text-dicecho-primary" />
              筛选
            </div>
            <div className="mt-4 space-y-4">
              <FilterBlock label="来源">
                <div className="grid grid-cols-2 gap-2">
                  <FilterButton
                    active={sourceFilter === "all"}
                    onClick={() => setSourceFilter("all")}
                  >
                    全部
                  </FilterButton>
                  <FilterButton
                    active={sourceFilter === "mine"}
                    onClick={() => setSourceFilter("mine")}
                  >
                    我的
                  </FilterButton>
                </div>
              </FilterBlock>

              <FilterBlock label="规则系统">
                <ModuleSelect
                  value={systemFilter}
                  options={systemSelectOptions}
                  onChange={setSystemFilter}
                />
              </FilterBlock>

              <FilterBlock label="标签">
                <ModuleSelect
                  value={activeTag || "all"}
                  options={tagSelectOptions}
                  onChange={(value) =>
                    setActiveTag(value === "all" ? undefined : value)
                  }
                />
              </FilterBlock>

              <FilterBlock label="难度">
                <div className="grid grid-cols-4 gap-2">
                  <FilterButton
                    active={complexityFilter === "all"}
                    onClick={() => setComplexityFilter("all")}
                  >
                    全部
                  </FilterButton>
                  <FilterButton
                    active={complexityFilter === "intro"}
                    onClick={() => setComplexityFilter("intro")}
                  >
                    入门
                  </FilterButton>
                  <FilterButton
                    active={complexityFilter === "standard"}
                    onClick={() => setComplexityFilter("standard")}
                  >
                    标准
                  </FilterButton>
                  <FilterButton
                    active={complexityFilter === "advanced"}
                    onClick={() => setComplexityFilter("advanced")}
                  >
                    进阶
                  </FilterButton>
                </div>
              </FilterBlock>

              <FilterBlock
                label="玩家人数"
                value={
                  playerRange[0] === 1 && playerRange[1] === 12
                    ? "不限"
                    : playerRange[0] === playerRange[1]
                      ? `${playerRange[0]} 人`
                      : `${playerRange[0]}-${playerRange[1]} 人`
                }
              >
                <PlayerRangeSlider
                  value={playerRange}
                  onChange={setPlayerRange}
                />
              </FilterBlock>

              <Button
                className="w-full"
                variant="secondary"
                icon={RefreshCw}
                onClick={resetFilters}
              >
                重置筛选
              </Button>
            </div>
          </div>
        </aside>
      </div>

      {marketplace.selectedTemplate && (
        <ModuleTemplateDetailModal
          template={marketplace.selectedTemplate}
          isLoading={marketplace.isDetailLoading}
          error={marketplace.detailError}
          canEdit={isTemplateOwner(marketplace.selectedTemplate)}
          onClose={marketplace.closeTemplate}
          onCreateRoom={() => openCreateDialog(marketplace.selectedTemplate!)}
          onEdit={() => setEditTarget(marketplace.selectedTemplate)}
        />
      )}

      {createTarget && (
        <CreateModuleRoomDialog
          template={createTarget}
          isCreating={marketplace.isCreatingRoom}
          onClose={() => setCreateTarget(null)}
          onCreate={async (input) => {
            const roomId = await marketplace.createRoom(input);
            handleCreated(roomId);
          }}
        />
      )}

      {showUploadDialog && (
        <UserModuleUploadDialog
          currentUserId={currentUserId}
          isPublishing={marketplace.isPublishingTemplate}
          onClose={() => setShowUploadDialog(false)}
          onPublish={marketplace.publishTemplate}
        />
      )}

      {editTarget && (
        <UserModuleUploadDialog
          currentUserId={currentUserId}
          initialTemplate={editTarget}
          isPublishing={marketplace.isUpdatingTemplate}
          isDeleting={marketplace.isDeletingTemplate}
          onClose={() => setEditTarget(null)}
          onPublish={(input) =>
            marketplace.updateTemplate({
              templateId: editTarget.id,
              ...input,
            })
          }
          onDelete={() => marketplace.deleteTemplate(editTarget.id)}
        />
      )}
    </div>
  );
};

const ModuleTemplateCard: React.FC<{
  template: ModuleTemplate;
  onOpen: () => void;
}> = ({ template, onOpen }) => {
  const authorName = template.author?.nickname || "官方模组";

  return (
    <article className="group min-w-0 text-left">
      <button
        type="button"
        onClick={onOpen}
        className="block h-full w-full min-w-0 rounded-lg border border-dicecho-border/40 bg-dicecho-card/80 p-2 text-left shadow-sm transition-colors hover:border-dicecho-primary/50 hover:bg-dicecho-card focus:outline-none focus:ring-2 focus:ring-dicecho-primary/60 dicecho-card-shadow"
      >
        <div className="relative isolate aspect-[3/4] w-full overflow-hidden rounded-lg bg-dicecho-card shadow-sm">
          <ModuleCoverImage template={template} />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_22%,rgba(255,255,255,0.12),transparent_24%),linear-gradient(180deg,rgba(15,20,32,0.02)_0%,rgba(15,20,32,0.10)_100%)]" />
          <span className="absolute left-2 top-2 max-w-[calc(50%-0.75rem)] truncate rounded-md border border-black/20 bg-black/55 px-2 py-1 text-xs font-semibold text-white backdrop-blur">
            {getModuleTemplatePlayersLabel(template)}
          </span>
          <span className="absolute right-2 top-2 max-w-[calc(50%-0.75rem)] truncate rounded-md border border-black/20 bg-black/55 px-2 py-1 text-xs font-semibold text-white backdrop-blur">
            {getModuleTemplateDurationLabel(template)}
          </span>
        </div>
        <div className="mt-2 min-w-0 px-0.5 pb-0.5">
          <h3 className="truncate text-base font-medium leading-5 text-white transition-colors group-hover:text-dicecho-primary">
            {template.title}
          </h3>
          <div className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-dicecho-muted">
            <ModuleAuthorAvatar template={template} />
            <span className="truncate">{authorName}</span>
          </div>
        </div>
      </button>
    </article>
  );
};

const ModuleCoverImage: React.FC<{ template: ModuleTemplate }> = ({
  template,
}) => {
  const [failed, setFailed] = React.useState(false);

  if (template.cover_image_url && !failed) {
    return (
      <img
        src={template.cover_image_url}
        alt={template.title}
        className="h-full w-full object-cover"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className="h-full bg-[radial-gradient(circle_at_28%_18%,rgba(129,140,248,0.24),transparent_34%),linear-gradient(145deg,rgba(31,41,65,0.98),rgba(15,23,42,0.98))]" />
  );
};

const ModuleAuthorAvatar: React.FC<{ template: ModuleTemplate }> = ({
  template,
}) => {
  const avatarUrl = template.author?.avatar_url;
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className="h-4 w-4 shrink-0 rounded-full object-cover"
        loading="lazy"
      />
    );
  }

  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-dicecho-primary/20 text-[10px] text-dicecho-primary">
      {template.author?.nickname?.trim().charAt(0) || "官"}
    </span>
  );
};

const ModuleTemplateDetailModal: React.FC<{
  template: ModuleTemplateDetail;
  isLoading: boolean;
  error: string | null;
  canEdit: boolean;
  onClose: () => void;
  onCreateRoom: () => void;
  onEdit: () => void;
}> = ({
  template,
  isLoading,
  error,
  canEdit,
  onClose,
  onCreateRoom,
  onEdit,
}) => {
  const characters = template.module_template_characters || [];
  const scenes = template.module_template_scenes || [];
  const rosterCharacters = characters.filter(
    (character) => character.character_type !== "investigator"
  );
  const [isDetailSpoilerOpen, setIsDetailSpoilerOpen] = React.useState(false);

  React.useEffect(() => {
    setIsDetailSpoilerOpen(false);
  }, [template.id]);

  return (
    <Modal
      title={template.title}
      icon={BookOpen}
      onClose={onClose}
      className="max-w-5xl"
    >
      <div className="overflow-y-auto p-5 custom-scrollbar md:p-6">
        {isLoading ? (
          <div className="flex items-center gap-2 rounded-lg border border-dicecho-border/40 bg-dicecho-panel/60 px-4 py-3 text-sm text-dicecho-muted">
            <Loader2 size={16} className="animate-spin" />
            正在加载模组详情
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <AlertCircle size={16} />
            {error}
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="space-y-5">
            {template.cover_image_url && (
              <img
                src={template.cover_image_url}
                alt={template.title}
                className="aspect-[16/8] w-full rounded-lg border border-dicecho-border/40 object-cover"
              />
            )}
            <div>
              <h4 className="text-sm font-semibold text-dicecho-primary">
                玩家可见背景
              </h4>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-200">
                {template.player_facing_premise}
              </p>
            </div>
            <DetailSpoilerSection
              title="KP 内容"
              icon={Shield}
              isOpen={isDetailSpoilerOpen}
              onToggle={() => setIsDetailSpoilerOpen((open) => !open)}
              tone="warning"
              collapsedText="玩家可见背景以外的内容默认隐藏，避免提前剧透。"
            >
              <div className="space-y-4">
                <TemplateContentGroup
                  title="KP 私密准备"
                  icon={Shield}
                  empty="这个模板暂未填写 KP 私密准备"
                  tone="warning"
                >
                  {template.keeper_notes ? (
                    <p className="whitespace-pre-wrap text-sm leading-7 text-amber-50/90">
                      {template.keeper_notes}
                    </p>
                  ) : null}
                </TemplateContentGroup>
                <TemplateContentGroup
                  title="NPC / 怪物"
                  icon={Users}
                  empty="这个模板暂未配置 NPC 或怪物"
                >
                  {rosterCharacters.map((character) => (
                    <TemplateListItem
                      key={character.id}
                      title={String(
                        character.payload.name || character.template_character_key
                      )}
                      meta={character.character_type === "monster" ? "怪物" : "NPC"}
                      description={String(
                        character.payload.info?.notes ||
                          character.payload.info?.backstory ||
                          ""
                      )}
                    />
                  ))}
                </TemplateContentGroup>
                <TemplateContentGroup
                  title="预设场景"
                  icon={Map}
                  empty="这个模板暂未配置场景"
                >
                  {scenes.map((scene) => (
                    <TemplateListItem
                      key={scene.id}
                      title={scene.title}
                      meta={scene.is_default ? "默认场景" : "备用场景"}
                      description={scene.description || ""}
                    />
                  ))}
                </TemplateContentGroup>
              </div>
            </DetailSpoilerSection>
          </section>
          <aside className="space-y-3">
            <div className="rounded-lg border border-dicecho-border/40 bg-dicecho-panel/65 p-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <ModuleFact
                  label="人数"
                  value={getModuleTemplatePlayersLabel(template)}
                />
                <ModuleFact
                  label="时长"
                  value={getModuleTemplateDurationLabel(template)}
                />
                <ModuleFact
                  label="难度"
                  value={getModuleTemplateComplexityLabel(template.complexity)}
                />
              </div>
            </div>
            <Button
              className="w-full"
              size="lg"
              icon={Sparkles}
              onClick={onCreateRoom}
            >
              从模组创建房间
            </Button>
            {canEdit && (
              <Button
                className="w-full"
                variant="secondary"
                icon={Edit3}
                onClick={onEdit}
                disabled={isLoading}
              >
                编辑我的模组
              </Button>
            )}
          </aside>
        </div>
      </div>
    </Modal>
  );
};

const CreateModuleRoomDialog: React.FC<{
  template: ModuleTemplateDetail;
  isCreating: boolean;
  onClose: () => void;
  onCreate: (input: {
    templateId: string;
    roomType: "text" | "voice";
    password?: string;
    coverImageUrl?: string | null;
  }) => Promise<void>;
}> = ({ template, isCreating, onClose, onCreate }) => {
  const [roomType, setRoomType] = React.useState<"text" | "voice">("text");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      await onCreate({
        templateId: template.id,
        roomType,
        password,
      });
    } catch (createError: any) {
      setError(createError?.message || "创建房间失败");
    }
  };

  return (
    <Modal
      title="从模组创建房间"
      icon={Sparkles}
      onClose={onClose}
      className="max-w-2xl"
    >
      <div className="space-y-4 overflow-y-auto p-5 custom-scrollbar md:p-6">
        <div className="rounded-lg border border-dicecho-border/40 bg-dicecho-card/60 p-3 text-sm text-slate-300">
          将以
          <span className="font-semibold text-white">《{template.title}》</span>
          作为房间名，并复制房间背景、NPC/怪物和预设场景。生成后你会以 KP 身份进入新房间。
        </div>
        <div className="grid grid-cols-2 gap-3">
          <RoomTypeButton
            active={roomType === "text"}
            icon={MessageSquare}
            label="文字团"
            onClick={() => setRoomType("text")}
          />
          <RoomTypeButton
            active={roomType === "voice"}
            icon={Mic}
            label="语音团"
            onClick={() => setRoomType("voice")}
          />
        </div>
        <Input
          label="房间密码（可选）"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="留空则公开"
          disabled={isCreating}
        />
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-3 border-t border-dicecho-border/40 bg-dicecho-card/50 px-5 py-4 md:px-6">
        <Button variant="ghost" onClick={onClose} disabled={isCreating}>
          取消
        </Button>
        <Button
          icon={isCreating ? Loader2 : Sparkles}
          onClick={submit}
          disabled={isCreating}
        >
          {isCreating ? "创建中" : "创建并进入"}
        </Button>
      </div>
    </Modal>
  );
};

const FilterBlock: React.FC<{
  label: string;
  value?: string;
  children: React.ReactNode;
}> = ({ label, value, children }) => (
  <div>
    <div className="mb-2 flex items-center justify-between gap-3 text-xs font-medium text-dicecho-muted">
      <span>{label}</span>
      {value && <span className="text-slate-300">{value}</span>}
    </div>
    {children}
  </div>
);

const FilterButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex h-9 items-center justify-center rounded-md border px-2 text-xs font-semibold transition-colors",
      active
        ? "border-dicecho-primary/55 bg-dicecho-primary/20 text-white"
        : "border-dicecho-border/35 bg-dicecho-card/65 text-dicecho-muted hover:text-white"
    )}
  >
    {children}
  </button>
);

const PlayerRangeSlider: React.FC<{
  value: [number, number];
  onChange: (value: [number, number]) => void;
}> = ({ value, onChange }) => {
  const [minValue, maxValue] = value;
  const minPercent = ((minValue - 1) / 11) * 100;
  const maxPercent = ((maxValue - 1) / 11) * 100;
  const isCollapsed = minValue === maxValue;
  const minHandleZIndex = isCollapsed && minValue < 12 ? 10 : 20;
  const maxHandleZIndex = isCollapsed && minValue < 12 ? 30 : 10;

  const updateMin = (nextValue: number) => {
    onChange([Math.min(nextValue, maxValue), maxValue]);
  };

  const updateMax = (nextValue: number) => {
    onChange([minValue, Math.max(nextValue, minValue)]);
  };

  return (
    <div>
      <div className="relative h-6">
        <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-dicecho-card/80" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-dicecho-primary"
          style={{
            left: `${minPercent}%`,
            right: `${100 - maxPercent}%`,
          }}
        />
        <input
          type="range"
          min={1}
          max={12}
          value={minValue}
          onChange={(event) => updateMin(Number(event.target.value))}
          className="pointer-events-none absolute inset-0 h-6 w-full appearance-none bg-transparent accent-dicecho-primary [&::-moz-range-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:pointer-events-auto"
          style={{ zIndex: minHandleZIndex }}
          aria-label="最少玩家人数"
        />
        <input
          type="range"
          min={1}
          max={12}
          value={maxValue}
          onChange={(event) => updateMax(Number(event.target.value))}
          className="pointer-events-none absolute inset-0 h-6 w-full appearance-none bg-transparent accent-dicecho-primary [&::-moz-range-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:pointer-events-auto"
          style={{ zIndex: maxHandleZIndex }}
          aria-label="最多玩家人数"
        />
      </div>
    </div>
  );
};

type ModuleSelectOption = {
  value: string;
  label: string;
};

const ModuleSelect: React.FC<{
  value: string;
  options: readonly ModuleSelectOption[];
  onChange: (value: string) => void;
  className?: string;
}> = ({ value, options, onChange, className }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const selectedOption =
    options.find((option) => option.value === value) || options[0];

  React.useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-dicecho-border/45 bg-dicecho-card/70 px-3 text-sm text-slate-100 shadow-sm outline-none transition-colors hover:border-dicecho-border/70 hover:bg-dicecho-raised/55 focus:border-dicecho-primary/55",
          isOpen && "border-dicecho-primary/55 bg-dicecho-card"
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate">{selectedOption?.label || "请选择"}</span>
        <ChevronDown
          size={15}
          className={cn(
            "shrink-0 text-dicecho-muted transition-transform",
            isOpen && "rotate-180 text-slate-200"
          )}
        />
      </button>
      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 top-[calc(100%+0.35rem)] z-30 w-full rounded-lg border border-dicecho-border/45 bg-dicecho-card p-1 shadow-lg shadow-black/20"
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={cn(
                  "flex h-9 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-sm font-medium transition-all",
                  isSelected
                    ? "bg-dicecho-primary/20 text-white"
                    : "text-dicecho-muted hover:bg-white/10 hover:text-white"
                )}
              >
                <span className="truncate">{option.label}</span>
                {isSelected && (
                  <Check size={14} className="shrink-0 text-dicecho-primary" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const ModuleFact: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div>
    <div className="text-xs text-dicecho-muted">{label}</div>
    <div className="mt-1 font-semibold text-white">{value}</div>
  </div>
);

const DetailSpoilerSection: React.FC<{
  title: string;
  icon: React.ElementType;
  isOpen: boolean;
  onToggle: () => void;
  collapsedText: string;
  tone?: "default" | "warning";
  children: React.ReactNode;
}> = ({
  title,
  icon: Icon,
  isOpen,
  onToggle,
  collapsedText,
  tone = "default",
  children,
}) => (
  <div className="space-y-3">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      className={cn(
        "flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
        tone === "warning"
          ? "border-amber-500/20 bg-amber-500/8 hover:border-amber-400/30 hover:bg-amber-500/12"
          : "border-dicecho-border/35 bg-dicecho-panel/45 hover:border-dicecho-primary/45"
      )}
    >
      <span className="min-w-0">
        <span
          className={cn(
            "flex items-center gap-2 text-sm font-semibold",
            tone === "warning" ? "text-amber-200" : "text-dicecho-primary"
          )}
        >
          <Icon size={15} />
          {title}
        </span>
        {!isOpen && (
          <span
            className={cn(
              "mt-0.5 block truncate text-xs font-normal",
              tone === "warning" ? "text-amber-100/65" : "text-dicecho-muted"
            )}
          >
            {collapsedText}
          </span>
        )}
      </span>
      <span className="flex items-center gap-2 text-xs font-semibold text-dicecho-muted">
        {isOpen ? "收起" : "展开"}
        <ChevronDown
          size={15}
          className={cn("transition-transform", isOpen && "rotate-180")}
        />
      </span>
    </button>
    {isOpen && <div>{children}</div>}
  </div>
);

const TemplateContentGroup: React.FC<{
  title: string;
  icon: React.ElementType;
  empty: string;
  tone?: "default" | "warning";
  children: React.ReactNode;
}> = ({ title, icon: Icon, empty, tone = "default", children }) => {
  const childArray = React.Children.toArray(children).filter(Boolean);
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        tone === "warning"
          ? "border-amber-500/20 bg-amber-500/8"
          : "border-dicecho-border/35 bg-dicecho-panel/45"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 text-sm font-semibold",
          tone === "warning" ? "text-amber-200" : "text-dicecho-primary"
        )}
      >
        <Icon size={15} />
        {title}
      </div>
      <div className="mt-3 space-y-2">
        {childArray.length > 0 ? (
          childArray
        ) : (
          <div
            className={cn(
              "rounded-lg border px-4 py-3 text-sm",
              tone === "warning"
                ? "border-amber-500/15 bg-black/10 text-amber-100/70"
                : "border-dicecho-border/35 bg-dicecho-panel/45 text-dicecho-muted"
            )}
          >
            {empty}
          </div>
        )}
      </div>
    </div>
  );
};

const TemplateListItem: React.FC<{
  title: string;
  meta: string;
  description: string;
}> = ({ title, meta, description }) => (
  <div className="rounded-lg border border-dicecho-border/35 bg-dicecho-panel/55 p-3">
    <div className="flex items-center justify-between gap-3">
      <h5 className="font-semibold text-white">{title}</h5>
      <span className="shrink-0 rounded-md border border-dicecho-border/35 px-2 py-1 text-xs text-dicecho-muted">
        {meta}
      </span>
    </div>
    {description && (
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-300">
        {description}
      </p>
    )}
  </div>
);

const RoomTypeButton: React.FC<{
  active: boolean;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}> = ({ active, icon: Icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex h-11 items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition-colors",
      active
        ? "border-dicecho-primary/55 bg-dicecho-primary/20 text-white"
        : "border-dicecho-border/45 bg-dicecho-card/65 text-dicecho-muted hover:text-white"
    )}
  >
    <Icon size={17} />
    {label}
  </button>
);

const ModuleMarketplaceLoading = () => (
  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
    {Array.from({ length: 3 }).map((_, index) => (
      <div
        key={index}
        className="h-96 animate-pulse rounded-lg border border-dicecho-border/35 bg-dicecho-panel/55"
      />
    ))}
  </div>
);

const ModuleMarketplaceError: React.FC<{
  message: string;
  onRetry: () => void;
}> = ({ message, onRetry }) => (
  <div className="rounded-lg border border-red-500/30 bg-dicecho-panel/60 px-6 py-14 text-center text-dicecho-muted">
    <AlertCircle size={42} className="mx-auto mb-3 text-red-400" />
    <p className="font-medium text-slate-100">{message}</p>
    <Button
      className="mx-auto mt-5"
      variant="secondary"
      icon={RefreshCw}
      onClick={onRetry}
    >
      重新加载
    </Button>
  </div>
);
