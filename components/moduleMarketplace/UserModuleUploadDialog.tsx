import React from "react";
import {
  AlertTriangle,
  BookPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Map,
  Plus,
  Skull,
  Trash2,
  User,
  Users,
} from "lucide-react";
import type {
  CreateUserModuleTemplateCharacterInput,
  CreateUserModuleTemplateInput,
  ModuleTemplate,
  ModuleTemplateDetail,
  ModuleTemplateCharacter,
  RoomScene,
  TabletopState,
  Character,
} from "../../types";
import { Button, Input, Modal, Textarea, cn } from "../UI";
import { CoverImageUpload } from "../CoverImageUpload";
import {
  createModuleSceneTabletopState,
  getModuleSceneFormFromTabletopState,
  ModuleSceneCanvasEditor,
} from "./ModuleSceneCanvasEditor";

interface UserModuleUploadDialogProps {
  currentUserId: string | null;
  isPublishing: boolean;
  initialTemplate?: ModuleTemplateDetail | null;
  onClose: () => void;
  onPublish: (input: CreateUserModuleTemplateInput) => Promise<unknown>;
  onDelete?: () => Promise<unknown>;
  isDeleting?: boolean;
}

type UploadStep = 0 | 1 | 2 | 3;

type UploadFormState = {
  title: string;
  system: string;
  coverImageUrl: string;
  tagsText: string;
  recommendedPlayersMin: number;
  recommendedPlayersMax: number;
  estimatedHoursMin: number;
  estimatedHoursMax: number;
  complexity: ModuleTemplate["complexity"];
  playerFacingPremise: string;
  keeperNotes: string;
  bgMusicUrl: string;
  sceneBackgroundColor: string;
  sceneBackgroundPattern: RoomScene["background_pattern"];
  sceneTabletopState: TabletopState;
  characters: ModuleCharacterDraft[];
};

type ModuleCharacterDraft = {
  id: string;
  key?: string;
  characterType: "npc" | "monster";
  name: string;
  role: string;
  avatarUrl: string;
  themeColor: string;
  job: string;
  notes: string;
  backstory: string;
  stats: {
    str: number;
    con: number;
    siz: number;
    dex: number;
    app: number;
    int: number;
    pow: number;
    edu: number;
    hp: number;
    mp: number;
  };
};

const STEPS = [
  { label: "标题" },
  { label: "基本信息" },
  { label: "详细信息" },
  { label: "预览" },
] as const;

const DEFAULT_STATS: ModuleCharacterDraft["stats"] = {
  str: 50,
  con: 50,
  siz: 50,
  dex: 50,
  app: 50,
  int: 50,
  pow: 50,
  edu: 50,
  hp: 10,
  mp: 10,
};

const INITIAL_FORM: UploadFormState = {
  title: "",
  system: "coc",
  coverImageUrl: "",
  tagsText: "",
  recommendedPlayersMin: 2,
  recommendedPlayersMax: 4,
  estimatedHoursMin: 2,
  estimatedHoursMax: 3,
  complexity: "standard",
  playerFacingPremise: "",
  keeperNotes: "",
  bgMusicUrl: "",
  sceneBackgroundColor: "#182033",
  sceneBackgroundPattern: "grid",
  sceneTabletopState: createModuleSceneTabletopState({
    title: "起始场景",
  }),
  characters: [],
};

function splitListText(value: string) {
  return value
    .split(/[,，、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function clampInteger(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function toMinutes(hours: number) {
  return clampInteger(hours, 1, 48) * 60;
}

function toHours(minutes: number) {
  return clampInteger(Math.round(minutes / 60), 1, 48);
}

function joinListText(value: string[] | null | undefined) {
  return (value || []).join("，");
}

function createDraftId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createCharacterKey(name: string, fallback: string) {
  const source = name.trim() || fallback;
  const key = source
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return key || fallback;
}

function createCharacterDraft(
  characterType: "npc" | "monster" = "npc"
): ModuleCharacterDraft {
  const id = createDraftId();
  return {
    id,
    key: id,
    characterType,
    name: "",
    role: characterType === "monster" ? "怪物" : "NPC",
    avatarUrl: "",
    themeColor: characterType === "monster" ? "#fb7185" : "#22d3ee",
    job: "",
    notes: "",
    backstory: "",
    stats: {
      ...DEFAULT_STATS,
      str: characterType === "monster" ? 70 : 50,
      pow: characterType === "monster" ? 70 : 50,
    },
  };
}

function moduleCharacterToDraft(
  character: ModuleTemplateCharacter
): ModuleCharacterDraft {
  const payload = character.payload || {};
  const info = payload.info || {};
  const stats = payload.stats || {};
  const characterType = character.character_type === "monster" ? "monster" : "npc";
  return {
    id: character.id || createDraftId(),
    key: character.template_character_key,
    characterType,
    name: String(payload.name || ""),
    role: String(payload.role || (characterType === "monster" ? "怪物" : "NPC")),
    avatarUrl: String(payload.avatar_url || ""),
    themeColor: String(
      payload.theme_color || (characterType === "monster" ? "#fb7185" : "#22d3ee")
    ),
    job: String(info.job || ""),
    notes: String(info.notes || ""),
    backstory: String(info.backstory || ""),
    stats: {
      str: clampInteger(Number(stats.str ?? DEFAULT_STATS.str), 0, 999),
      con: clampInteger(Number(stats.con ?? DEFAULT_STATS.con), 0, 999),
      siz: clampInteger(Number(stats.siz ?? DEFAULT_STATS.siz), 0, 999),
      dex: clampInteger(Number(stats.dex ?? DEFAULT_STATS.dex), 0, 999),
      app: clampInteger(Number(stats.app ?? DEFAULT_STATS.app), 0, 999),
      int: clampInteger(Number(stats.int ?? DEFAULT_STATS.int), 0, 999),
      pow: clampInteger(Number(stats.pow ?? DEFAULT_STATS.pow), 0, 999),
      edu: clampInteger(Number(stats.edu ?? DEFAULT_STATS.edu), 0, 999),
      hp: clampInteger(Number(stats.hp ?? DEFAULT_STATS.hp), 1, 999),
      mp: clampInteger(Number(stats.mp ?? DEFAULT_STATS.mp), 0, 999),
    },
  };
}

function characterDraftToInput(
  draft: ModuleCharacterDraft,
  index: number
): CreateUserModuleTemplateCharacterInput {
  const fallbackKey = `${draft.characterType}-${index + 1}`;
  return {
    key: draft.key || createCharacterKey(draft.name, fallbackKey),
    characterType: draft.characterType,
    displayOrder: index + 1,
    payload: {
      name:
        draft.name.trim() ||
        (draft.characterType === "monster" ? "未命名怪物" : "未命名 NPC"),
      role: draft.role.trim() || (draft.characterType === "monster" ? "怪物" : "NPC"),
      type: draft.characterType,
      theme_color: draft.themeColor,
      avatar_url: draft.avatarUrl.trim() || null,
      info: {
        job: draft.job.trim(),
        notes: draft.notes.trim(),
        backstory: draft.backstory.trim(),
      },
      stats: draft.stats,
    },
  };
}

function characterDraftToCharacter(
  draft: ModuleCharacterDraft,
  index: number
): Character {
  const fallbackKey = `${draft.characterType}-${index + 1}`;
  const key = draft.key || createCharacterKey(draft.name, fallbackKey);
  return {
    id: `module-character:${key}`,
    name:
      draft.name.trim() ||
      (draft.characterType === "monster" ? "未命名怪物" : "未命名 NPC"),
    role: draft.role.trim() || (draft.characterType === "monster" ? "怪物" : "NPC"),
    type: draft.characterType,
    theme_color: draft.themeColor,
    avatar_url: draft.avatarUrl.trim() || null,
    room_id: null,
    user_id: undefined,
    inventory: null,
    info: {
      job: draft.job.trim(),
      notes: draft.notes.trim(),
      backstory: draft.backstory.trim(),
    },
    stats: draft.stats,
    job: draft.job.trim(),
    age: "",
    sex: "",
    str: draft.stats.str,
    con: draft.stats.con,
    siz: draft.stats.siz,
    dex: draft.stats.dex,
    app: draft.stats.app,
    int: draft.stats.int,
    pow: draft.stats.pow,
    edu: draft.stats.edu,
    luck: 0,
    hp: draft.stats.hp,
    san: 0,
    mp: draft.stats.mp,
    notes: draft.notes.trim(),
    backstory: draft.backstory.trim(),
    skills: {},
  };
}

function getInitialForm(template?: ModuleTemplateDetail | null): UploadFormState {
  if (!template) return INITIAL_FORM;

  const defaultScene =
    template.module_template_scenes?.find((scene) => scene.is_default) ||
    template.module_template_scenes?.[0];
  const characters = (template.module_template_characters || [])
    .filter((character) => character.character_type !== "investigator")
    .sort((left, right) => left.display_order - right.display_order)
    .map(moduleCharacterToDraft);
  const characterIds = characters.map((character, index) => {
    const fallbackKey = `${character.characterType}-${index + 1}`;
    return `module-character:${character.key || createCharacterKey(character.name, fallbackKey)}`;
  });

  return {
    title: template.title,
    system: template.system,
    coverImageUrl: template.cover_image_url || "",
    tagsText: joinListText(template.tags),
    recommendedPlayersMin: template.recommended_players_min,
    recommendedPlayersMax: template.recommended_players_max,
    estimatedHoursMin: toHours(template.estimated_minutes_min),
    estimatedHoursMax: toHours(template.estimated_minutes_max),
    complexity: template.complexity,
    playerFacingPremise: template.player_facing_premise || template.summary,
    keeperNotes: template.keeper_notes || "",
    bgMusicUrl: template.bg_music_url || "",
    sceneBackgroundColor: defaultScene?.background_color || "#182033",
    sceneBackgroundPattern: defaultScene?.background_pattern || "grid",
    sceneTabletopState: createModuleSceneTabletopState({
      title: defaultScene?.title || "起始场景",
      description: defaultScene?.description || null,
      state: defaultScene?.tabletop_state || null,
      characterIds,
    }),
    characters,
  };
}

function validateStep(form: UploadFormState, step: UploadStep) {
  if (step === 0 && !form.title.trim()) return "请填写模组标题";
  if (step === 1) {
    if (!form.system.trim()) return "请填写规则系统";
    if (form.recommendedPlayersMin > form.recommendedPlayersMax) {
      return "推荐人数下限不能大于上限";
    }
    if (form.estimatedHoursMin > form.estimatedHoursMax) {
      return "预计时长下限不能大于上限";
    }
  }
  if (step === 2) {
    if (!form.playerFacingPremise.trim()) return "请填写玩家可见背景";
    if (!form.sceneTabletopState.scenes.length) return "请创建至少一个场景";
  }
  return null;
}

function validateForm(form: UploadFormState) {
  for (const step of [0, 1, 2] as UploadStep[]) {
    const error = validateStep(form, step);
    if (error) return error;
  }
  if (!/^#[0-9A-Fa-f]{6}$/.test(form.sceneBackgroundColor)) {
    return "场景底色需要使用 #RRGGBB 格式";
  }
  return null;
}

export const UserModuleUploadDialog: React.FC<UserModuleUploadDialogProps> = ({
  currentUserId,
  isPublishing,
  initialTemplate,
  onClose,
  onPublish,
  onDelete,
  isDeleting = false,
}) => {
  const isEditing = Boolean(initialTemplate);
  const isWorking = isPublishing || isDeleting;
  const [form, setForm] = React.useState<UploadFormState>(() =>
    getInitialForm(initialTemplate)
  );
  const [step, setStep] = React.useState<UploadStep>(0);
  const [error, setError] = React.useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = React.useState(false);
  const [showSceneEditor, setShowSceneEditor] = React.useState(false);
  const activeSceneSummary = getModuleSceneFormFromTabletopState(
    form.sceneTabletopState
  );
  const moduleSceneCharacters = React.useMemo(
    () => form.characters.map(characterDraftToCharacter),
    [form.characters]
  );

  const updateForm = <K extends keyof UploadFormState>(
    key: K,
    value: UploadFormState[K]
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateCharacter = (
    draftId: string,
    updater: (draft: ModuleCharacterDraft) => ModuleCharacterDraft
  ) => {
    setForm((current) => ({
      ...current,
      characters: current.characters.map((character) =>
        character.id === draftId ? updater(character) : character
      ),
    }));
  };

  const addCharacter = (characterType: "npc" | "monster") => {
    setForm((current) => ({
      ...current,
      characters: [...current.characters, createCharacterDraft(characterType)],
    }));
  };

  const removeCharacter = (draftId: string) => {
    setForm((current) => ({
      ...current,
      characters: current.characters.filter((character) => character.id !== draftId),
    }));
  };

  const goNext = () => {
    const validationError = validateStep(form, step);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setStep((current) => Math.min(3, current + 1) as UploadStep);
  };

  const goPrevious = () => {
    setError(null);
    setStep((current) => Math.max(0, current - 1) as UploadStep);
  };

  const submit = async () => {
    const validationError = validateForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    try {
      const sceneForm = getModuleSceneFormFromTabletopState(
        form.sceneTabletopState
      );
      await onPublish({
        title: form.title.trim(),
        summary: form.playerFacingPremise.trim(),
        system: form.system.trim().toLowerCase(),
        coverImageUrl: form.coverImageUrl.trim() || null,
        tags: splitListText(form.tagsText),
        recommendedPlayersMin: clampInteger(form.recommendedPlayersMin, 1, 12),
        recommendedPlayersMax: clampInteger(form.recommendedPlayersMax, 1, 12),
        estimatedMinutesMin: toMinutes(form.estimatedHoursMin),
        estimatedMinutesMax: toMinutes(form.estimatedHoursMax),
        complexity: form.complexity,
        tone: null,
        contentWarnings: [],
        playerFacingPremise: form.playerFacingPremise.trim(),
        keeperNotes: form.keeperNotes.trim() || null,
        defaultRoomType: "text",
        bgMusicUrl: form.bgMusicUrl.trim() || null,
        characters: form.characters.map(characterDraftToInput),
        scene: sceneForm.title.trim()
          ? {
              title: sceneForm.title.trim(),
              description: sceneForm.description.trim() || null,
              backgroundColor: form.sceneBackgroundColor,
              backgroundPattern: form.sceneBackgroundPattern,
              tabletopState: form.sceneTabletopState,
            }
          : null,
      });
      onClose();
    } catch (publishError: any) {
      setError(publishError?.message || "上传模组失败");
    }
  };

  const deleteTemplate = async () => {
    if (!onDelete) return;
    setError(null);
    try {
      await onDelete();
      onClose();
    } catch (deleteError: any) {
      setError(deleteError?.message || "删除模组失败");
      setDeleteConfirm(false);
    }
  };

  return (
    <>
      <Modal
        title={isEditing ? "编辑模组" : "上传自定义模组"}
        icon={BookPlus}
        onClose={onClose}
        className="max-w-5xl"
      >
        <div className="space-y-5 overflow-y-auto p-5 custom-scrollbar md:p-6">
          <UploadStepper step={step} />

          <div className="min-h-[25rem] rounded-lg border border-dicecho-border/30 bg-dicecho-card/55 p-5 md:p-8">
            {step === 0 && (
              <TitleStep
                title={form.title}
                disabled={isWorking}
                onChange={(value) => updateForm("title", value)}
              />
            )}
            {step === 1 && (
              <BasicInfoStep
                form={form}
                currentUserId={currentUserId}
                isWorking={isWorking}
                updateForm={updateForm}
              />
            )}
            {step === 2 && (
              <DetailInfoStep
                form={form}
                isWorking={isWorking}
                activeSceneTitle={activeSceneSummary.title || "未命名场景"}
                updateForm={updateForm}
                addCharacter={addCharacter}
                updateCharacter={updateCharacter}
                removeCharacter={removeCharacter}
                onOpenSceneEditor={() => setShowSceneEditor(true)}
              />
            )}
            {step === 3 && <PreviewStep form={form} />}
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-dicecho-border/40 bg-dicecho-card/50 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
          {isEditing && onDelete ? (
            <DeleteControls
              isWorking={isWorking}
              isDeleting={isDeleting}
              deleteConfirm={deleteConfirm}
              onStartDelete={() => setDeleteConfirm(true)}
              onCancelDelete={() => setDeleteConfirm(false)}
              onConfirmDelete={deleteTemplate}
            />
          ) : (
            <div />
          )}
          <div className="flex justify-end gap-3">
            {step > 0 && (
              <Button
                variant="secondary"
                icon={ChevronLeft}
                onClick={goPrevious}
                disabled={isWorking}
              >
                上一步
              </Button>
            )}
            <Button variant="ghost" onClick={onClose} disabled={isWorking}>
              取消
            </Button>
            {step < 3 ? (
              <Button
                icon={ChevronRight}
                onClick={goNext}
                disabled={isWorking}
              >
                下一步
              </Button>
            ) : (
              <Button
                icon={isPublishing ? Loader2 : BookPlus}
                onClick={submit}
                disabled={isWorking}
              >
                {isPublishing
                  ? isEditing
                    ? "保存中"
                    : "上传中"
                  : isEditing
                    ? "保存修改"
                    : "发布到模组市场"}
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {showSceneEditor && (
        <Modal
          title="编辑模组场景"
          icon={Map}
          onClose={() => setShowSceneEditor(false)}
          className="max-w-7xl"
        >
          <div className="max-h-[calc(90vh-5rem)] overflow-y-auto p-5 custom-scrollbar md:p-6">
            <ModuleSceneCanvasEditor
              value={form.sceneTabletopState}
              onChange={(state) => updateForm("sceneTabletopState", state)}
              characters={moduleSceneCharacters}
              disabled={isWorking}
            />
          </div>
        </Modal>
      )}
    </>
  );
};

const UploadStepper: React.FC<{ step: UploadStep }> = ({ step }) => (
  <div className="px-2">
    <div className="mx-auto grid max-w-3xl grid-cols-4">
      {STEPS.map((item, index) => {
        const isDone = index < step;
        const isActive = index === step;
        return (
          <div key={item.label} className="relative flex flex-col items-center">
            {index > 0 && (
              <div
                className={cn(
                  "absolute right-1/2 top-4 h-px w-full",
                  index <= step ? "bg-dicecho-primary" : "bg-dicecho-border/70"
                )}
              />
            )}
            <div
              className={cn(
                "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border text-sm font-bold",
                isDone
                  ? "border-dicecho-primary bg-dicecho-primary text-white"
                  : isActive
                    ? "border-dicecho-primary text-white ring-2 ring-dicecho-primary/25"
                    : "border-dicecho-border/70 text-dicecho-muted"
              )}
            >
              {isDone ? <Check size={16} /> : index + 1}
            </div>
            <div
              className={cn(
                "mt-2 text-xs font-semibold",
                isActive || isDone ? "text-dicecho-primary" : "text-dicecho-muted"
              )}
            >
              {item.label}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

const TitleStep: React.FC<{
  title: string;
  disabled: boolean;
  onChange: (value: string) => void;
}> = ({ title, disabled, onChange }) => (
  <div className="mx-auto flex max-w-2xl flex-col items-center pt-8 text-center">
    <h3 className="text-2xl font-black text-white">你的模组叫什么名字？</h3>
    <input
      value={title}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      placeholder="输入模组标题..."
      className="mt-7 h-12 w-full rounded-lg border border-dicecho-border/45 bg-dicecho-panel/80 px-4 text-base font-semibold text-white outline-none transition-colors placeholder:text-slate-400/70 focus:border-dicecho-primary/70 disabled:opacity-50"
      autoFocus
    />
  </div>
);

const BasicInfoStep: React.FC<{
  form: UploadFormState;
  currentUserId: string | null;
  isWorking: boolean;
  updateForm: <K extends keyof UploadFormState>(
    key: K,
    value: UploadFormState[K]
  ) => void;
}> = ({ form, currentUserId, isWorking, updateForm }) => (
  <div className="grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)]">
    <CoverImageUpload
      value={form.coverImageUrl}
      onChange={(url) => updateForm("coverImageUrl", url)}
      currentUserId={currentUserId}
      disabled={isWorking}
    />
    <div className="grid content-start gap-4 md:grid-cols-2">
      <Input
        label="规则系统"
        value={form.system}
        onChange={(event) => updateForm("system", event.target.value)}
        disabled={isWorking}
        placeholder="coc"
      />
      <Input
        label="标签"
        value={form.tagsText}
        onChange={(event) => updateForm("tagsText", event.target.value)}
        disabled={isWorking}
        placeholder="调查，悬疑，一夜短团"
      />
      <NumberField
        label="最少人数"
        value={form.recommendedPlayersMin}
        min={1}
        max={12}
        disabled={isWorking}
        onChange={(value) => updateForm("recommendedPlayersMin", value)}
      />
      <NumberField
        label="最多人数"
        value={form.recommendedPlayersMax}
        min={1}
        max={12}
        disabled={isWorking}
        onChange={(value) => updateForm("recommendedPlayersMax", value)}
      />
      <NumberField
        label="最短时长（小时）"
        value={form.estimatedHoursMin}
        min={1}
        max={48}
        disabled={isWorking}
        onChange={(value) => updateForm("estimatedHoursMin", value)}
      />
      <NumberField
        label="最长时长（小时）"
        value={form.estimatedHoursMax}
        min={1}
        max={48}
        disabled={isWorking}
        onChange={(value) => updateForm("estimatedHoursMax", value)}
      />
      <div className="space-y-2 md:col-span-2">
        <FieldLabel>难度</FieldLabel>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["intro", "入门"],
              ["standard", "标准"],
              ["advanced", "进阶"],
            ] as const
          ).map(([value, label]) => (
            <SegmentButton
              key={value}
              active={form.complexity === value}
              disabled={isWorking}
              onClick={() => updateForm("complexity", value)}
            >
              {label}
            </SegmentButton>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const DetailInfoStep: React.FC<{
  form: UploadFormState;
  isWorking: boolean;
  activeSceneTitle: string;
  updateForm: <K extends keyof UploadFormState>(
    key: K,
    value: UploadFormState[K]
  ) => void;
  addCharacter: (type: "npc" | "monster") => void;
  updateCharacter: (
    id: string,
    updater: (draft: ModuleCharacterDraft) => ModuleCharacterDraft
  ) => void;
  removeCharacter: (id: string) => void;
  onOpenSceneEditor: () => void;
}> = ({
  form,
  isWorking,
  activeSceneTitle,
  updateForm,
  addCharacter,
  updateCharacter,
  removeCharacter,
  onOpenSceneEditor,
}) => (
  <div className="space-y-5">
    <div className="grid gap-4 lg:grid-cols-2">
      <Textarea
        label="玩家可见背景"
        value={form.playerFacingPremise}
        onChange={(event) => updateForm("playerFacingPremise", event.target.value)}
        rows={5}
        disabled={isWorking}
        placeholder="这段会成为房间公开简介，请不要写入 KP 秘密"
      />
      <Textarea
        label="KP 私密准备（可选）"
        value={form.keeperNotes}
        onChange={(event) => updateForm("keeperNotes", event.target.value)}
        rows={5}
        disabled={isWorking}
        placeholder="真相、流程、关键线索、怪物动机等"
      />
    </div>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <NpcMonsterEditor
        characters={form.characters}
        disabled={isWorking}
        addCharacter={addCharacter}
        updateCharacter={updateCharacter}
        removeCharacter={removeCharacter}
      />
      <div className="space-y-4">
        <Input
          label="背景音乐 URL（可选）"
          value={form.bgMusicUrl}
          onChange={(event) => updateForm("bgMusicUrl", event.target.value)}
          disabled={isWorking}
          placeholder="https://..."
        />
        <div className="rounded-lg border border-dicecho-border/40 bg-dicecho-panel/55 p-4">
          <div className="text-sm font-semibold text-white">编辑场景</div>
          <div className="mt-2 text-xs text-dicecho-muted">
            已配置 {form.sceneTabletopState.scenes.length} 个场景
          </div>
          <div className="mt-1 truncate text-sm font-semibold text-slate-200">
            {activeSceneTitle}
          </div>
          <Button
            className="mt-4 w-full"
            variant="secondary"
            icon={Map}
            onClick={onOpenSceneEditor}
            disabled={isWorking}
          >
            编辑模组场景
          </Button>
        </div>
      </div>
    </div>
  </div>
);

const NpcMonsterEditor: React.FC<{
  characters: ModuleCharacterDraft[];
  disabled: boolean;
  addCharacter: (type: "npc" | "monster") => void;
  updateCharacter: (
    id: string,
    updater: (draft: ModuleCharacterDraft) => ModuleCharacterDraft
  ) => void;
  removeCharacter: (id: string) => void;
}> = ({ characters, disabled, addCharacter, updateCharacter, removeCharacter }) => (
  <div className="rounded-lg border border-dicecho-border/40 bg-dicecho-panel/45 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <Users size={16} className="text-dicecho-primary" />
        NPC / 怪物
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          icon={Plus}
          onClick={() => addCharacter("npc")}
          disabled={disabled}
        >
          NPC
        </Button>
        <Button
          size="sm"
          variant="secondary"
          icon={Plus}
          onClick={() => addCharacter("monster")}
          disabled={disabled}
        >
          怪物
        </Button>
      </div>
    </div>

    {characters.length === 0 ? (
      <div className="mt-4 rounded-lg border border-dashed border-dicecho-border/45 bg-dicecho-card/45 px-4 py-8 text-center text-sm text-dicecho-muted">
        暂未添加 NPC 或怪物
      </div>
    ) : (
      <div className="mt-4 space-y-3">
        {characters.map((character) => (
          <CharacterDraftCard
            key={character.id}
            character={character}
            disabled={disabled}
            updateCharacter={updateCharacter}
            removeCharacter={removeCharacter}
          />
        ))}
      </div>
    )}
  </div>
);

const CharacterDraftCard: React.FC<{
  character: ModuleCharacterDraft;
  disabled: boolean;
  updateCharacter: (
    id: string,
    updater: (draft: ModuleCharacterDraft) => ModuleCharacterDraft
  ) => void;
  removeCharacter: (id: string) => void;
}> = ({ character, disabled, updateCharacter, removeCharacter }) => {
  const patch = (patchValue: Partial<ModuleCharacterDraft>) => {
    updateCharacter(character.id, (draft) => ({ ...draft, ...patchValue }));
  };
  const patchStats = (
    key: keyof ModuleCharacterDraft["stats"],
    value: number
  ) => {
    updateCharacter(character.id, (draft) => ({
      ...draft,
      stats: {
        ...draft.stats,
        [key]: clampInteger(value, key === "hp" ? 1 : 0, 999),
      },
    }));
  };
  const Icon = character.characterType === "monster" ? Skull : User;

  return (
    <div className="rounded-lg border border-dicecho-border/35 bg-dicecho-card/55 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `${character.themeColor}33`, color: character.themeColor }}
          >
            <Icon size={16} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">
              {character.name || (character.characterType === "monster" ? "未命名怪物" : "未命名 NPC")}
            </div>
            <div className="text-xs text-dicecho-muted">
              {character.characterType === "monster" ? "怪物" : "NPC"}
            </div>
          </div>
        </div>
        <Button
          size="icon"
          variant="danger"
          icon={Trash2}
          onClick={() => removeCharacter(character.id)}
          disabled={disabled}
          aria-label="删除角色"
        />
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Input
          label="名称"
          value={character.name}
          disabled={disabled}
          onChange={(event) => patch({ name: event.target.value })}
          placeholder="梁站长"
        />
        <div className="space-y-1.5">
          <FieldLabel>类型</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            <SegmentButton
              active={character.characterType === "npc"}
              disabled={disabled}
              onClick={() =>
                patch({
                  characterType: "npc",
                  role: character.role === "怪物" ? "NPC" : character.role,
                })
              }
            >
              NPC
            </SegmentButton>
            <SegmentButton
              active={character.characterType === "monster"}
              disabled={disabled}
              onClick={() =>
                patch({
                  characterType: "monster",
                  role: character.role === "NPC" ? "怪物" : character.role,
                })
              }
            >
              怪物
            </SegmentButton>
          </div>
        </div>
        <Input
          label="身份 / 职业"
          value={character.job}
          disabled={disabled}
          onChange={(event) => patch({ job: event.target.value })}
          placeholder="旧车站站长"
        />
        <Input
          label="头像 URL（可选）"
          value={character.avatarUrl}
          disabled={disabled}
          onChange={(event) => patch({ avatarUrl: event.target.value })}
          placeholder="https://..."
        />
        <Textarea
          className="md:col-span-2"
          label="备注"
          value={character.notes}
          disabled={disabled}
          rows={2}
          onChange={(event) => patch({ notes: event.target.value })}
          placeholder="玩家可能观察到的特征、说话方式或行为线索"
        />
        <Textarea
          className="md:col-span-2"
          label="背景"
          value={character.backstory}
          disabled={disabled}
          rows={2}
          onChange={(event) => patch({ backstory: event.target.value })}
          placeholder="KP 可见的真实动机、秘密或战斗行为"
        />
      </div>
      <div className="mt-3 grid grid-cols-5 gap-2">
        {(
          [
            ["str", "STR"],
            ["con", "CON"],
            ["siz", "SIZ"],
            ["dex", "DEX"],
            ["pow", "POW"],
            ["int", "INT"],
            ["edu", "EDU"],
            ["hp", "HP"],
            ["mp", "MP"],
          ] as const
        ).map(([key, label]) => (
          <Input
            key={key}
            label={label}
            type="number"
            value={character.stats[key]}
            disabled={disabled}
            onChange={(event) => patchStats(key, Number(event.target.value))}
          />
        ))}
      </div>
    </div>
  );
};

const PreviewStep: React.FC<{ form: UploadFormState }> = ({ form }) => {
  const tags = splitListText(form.tagsText);
  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <div className="overflow-hidden rounded-lg border border-dicecho-border/40 bg-dicecho-panel/55">
        {form.coverImageUrl ? (
          <img
            src={form.coverImageUrl}
            alt=""
            className="aspect-[3/4] w-full object-cover"
          />
        ) : (
          <div className="flex aspect-[3/4] items-center justify-center bg-dicecho-card/70 text-sm text-dicecho-muted">
            未设置封面
          </div>
        )}
      </div>
      <div className="space-y-5">
        <div>
          <h3 className="text-2xl font-bold text-white">
            {form.title || "未命名模组"}
          </h3>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-dicecho-muted">
            <span>{form.system.toUpperCase()}</span>
            <span>{form.recommendedPlayersMin}-{form.recommendedPlayersMax} 人</span>
            <span>{form.estimatedHoursMin}-{form.estimatedHoursMax} h</span>
          </div>
          {tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-dicecho-border/35 bg-dicecho-panel/65 px-2 py-1 text-xs text-dicecho-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <PreviewBlock title="玩家可见背景">
          {form.playerFacingPremise || "未填写"}
        </PreviewBlock>
        <PreviewBlock title="KP 内容">
          {form.keeperNotes || "未填写私密准备"}
        </PreviewBlock>
        <div className="grid gap-3 md:grid-cols-2">
          <PreviewFact label="NPC / 怪物" value={`${form.characters.length} 个`} />
          <PreviewFact
            label="场景"
            value={`${form.sceneTabletopState.scenes.length} 个`}
          />
        </div>
      </div>
    </div>
  );
};

const PreviewBlock: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="rounded-lg border border-dicecho-border/35 bg-dicecho-panel/45 p-4">
    <div className="text-sm font-semibold text-dicecho-primary">{title}</div>
    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">
      {children}
    </p>
  </div>
);

const PreviewFact: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div className="rounded-lg border border-dicecho-border/35 bg-dicecho-panel/45 p-4">
    <div className="text-xs text-dicecho-muted">{label}</div>
    <div className="mt-1 text-lg font-bold text-white">{value}</div>
  </div>
);

const DeleteControls: React.FC<{
  isWorking: boolean;
  isDeleting: boolean;
  deleteConfirm: boolean;
  onStartDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}> = ({
  isWorking,
  isDeleting,
  deleteConfirm,
  onStartDelete,
  onCancelDelete,
  onConfirmDelete,
}) => (
  <div className="flex flex-col gap-2 md:flex-row md:items-center">
    {deleteConfirm ? (
      <>
        <span className="text-xs font-bold text-red-400">
          再次点击确认删除，删除后不可恢复
        </span>
        <Button
          variant="dangerActive"
          icon={isDeleting ? Loader2 : AlertTriangle}
          onClick={onConfirmDelete}
          disabled={isWorking}
        >
          {isDeleting ? "删除中" : "确认删除"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancelDelete}
          disabled={isWorking}
        >
          取消删除
        </Button>
      </>
    ) : (
      <Button
        variant="danger"
        icon={Trash2}
        onClick={onStartDelete}
        disabled={isWorking}
      >
        删除模组
      </Button>
    )}
  </div>
);

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="mb-1.5 ml-1 block text-xs font-medium text-dicecho-muted">
    {children}
  </label>
);

const NumberField: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  onChange: (value: number) => void;
}> = ({ label, value, min, max, disabled, onChange }) => (
  <Input
    label={label}
    type="number"
    min={min}
    max={max}
    value={value}
    disabled={disabled}
    onChange={(event) => onChange(Number(event.target.value))}
  />
);

const SegmentButton: React.FC<{
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, disabled, onClick, children }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={cn(
      "flex h-10 items-center justify-center rounded-lg border text-sm font-semibold transition-colors disabled:opacity-40",
      active
        ? "border-dicecho-primary/55 bg-dicecho-primary/20 text-white"
        : "border-dicecho-border/45 bg-dicecho-panel/65 text-dicecho-muted hover:text-white"
    )}
  >
    {children}
  </button>
);
