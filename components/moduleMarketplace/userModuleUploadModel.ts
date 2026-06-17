import type {
  Character,
  CreateUserModuleTemplateCharacterInput,
  CreateUserModuleTemplateInput,
  ModuleTemplate,
  ModuleTemplateCharacter,
  ModuleTemplateDetail,
  RoomScene,
  TabletopState,
} from "../../types";
import {
  createModuleSceneTabletopState,
  getModuleSceneFormFromTabletopState,
} from "./moduleSceneModel";

export type UserModuleUploadStep = 0 | 1 | 2 | 3;

export type ModuleCharacterDraftStats = {
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

export type ModuleCharacterDraft = {
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
  stats: ModuleCharacterDraftStats;
};

export type UserModuleUploadForm = {
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

const DEFAULT_STATS: ModuleCharacterDraftStats = {
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

function createDraftId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function splitModuleListText(value: string) {
  return value
    .split(/[,，、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function clampInteger(value: number, min: number, max: number) {
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

export function createModuleCharacterKey(name: string, fallback: string) {
  const source = name.trim() || fallback;
  const key = source
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return key || fallback;
}

export function createModuleCharacterDraft(
  characterType: "npc" | "monster" = "npc",
  id = createDraftId()
): ModuleCharacterDraft {
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

export function createEmptyUserModuleUploadForm(): UserModuleUploadForm {
  return {
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
}

export function getInitialUserModuleUploadForm(
  template?: ModuleTemplateDetail | null
): UserModuleUploadForm {
  if (!template) return createEmptyUserModuleUploadForm();

  const defaultScene =
    template.module_template_scenes?.find((scene) => scene.is_default) ||
    template.module_template_scenes?.[0];
  const characters = (template.module_template_characters || [])
    .filter((character) => character.character_type !== "investigator")
    .sort((left, right) => left.display_order - right.display_order)
    .map(moduleCharacterToDraft);
  const characterIds = characters.map((character, index) => {
    const fallbackKey = `${character.characterType}-${index + 1}`;
    return `module-character:${
      character.key || createModuleCharacterKey(character.name, fallbackKey)
    }`;
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

export function validateUserModuleUploadStep(
  form: UserModuleUploadForm,
  step: UserModuleUploadStep
) {
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

export function validateUserModuleUploadForm(form: UserModuleUploadForm) {
  for (const step of [0, 1, 2] as UserModuleUploadStep[]) {
    const error = validateUserModuleUploadStep(form, step);
    if (error) return error;
  }
  if (!/^#[0-9A-Fa-f]{6}$/.test(form.sceneBackgroundColor)) {
    return "场景底色需要使用 #RRGGBB 格式";
  }
  return null;
}

export function setModuleCharacterType(
  draft: ModuleCharacterDraft,
  characterType: "npc" | "monster"
): ModuleCharacterDraft {
  return {
    ...draft,
    characterType,
    role:
      characterType === "monster" && draft.role === "NPC"
        ? "怪物"
        : characterType === "npc" && draft.role === "怪物"
          ? "NPC"
          : draft.role,
  };
}

export function patchModuleCharacterStat(
  draft: ModuleCharacterDraft,
  key: keyof ModuleCharacterDraftStats,
  value: number
): ModuleCharacterDraft {
  return {
    ...draft,
    stats: {
      ...draft.stats,
      [key]: clampInteger(value, key === "hp" ? 1 : 0, 999),
    },
  };
}

export function buildModuleCharacterTemplateInput(
  draft: ModuleCharacterDraft,
  index: number
): CreateUserModuleTemplateCharacterInput {
  const fallbackKey = `${draft.characterType}-${index + 1}`;
  return {
    key: draft.key || createModuleCharacterKey(draft.name, fallbackKey),
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

export function buildModuleCharacterPreview(
  draft: ModuleCharacterDraft,
  index: number
): Character {
  const fallbackKey = `${draft.characterType}-${index + 1}`;
  const key = draft.key || createModuleCharacterKey(draft.name, fallbackKey);
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

export function buildModuleSceneCharacters(characters: ModuleCharacterDraft[]) {
  return characters.map(buildModuleCharacterPreview);
}

export function buildUserModuleTemplateInput(
  form: UserModuleUploadForm
): CreateUserModuleTemplateInput {
  const sceneForm = getModuleSceneFormFromTabletopState(form.sceneTabletopState);
  return {
    title: form.title.trim(),
    summary: form.playerFacingPremise.trim(),
    system: form.system.trim().toLowerCase(),
    coverImageUrl: form.coverImageUrl.trim() || null,
    tags: splitModuleListText(form.tagsText),
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
    characters: form.characters.map(buildModuleCharacterTemplateInput),
    scene: sceneForm.title.trim()
      ? {
          title: sceneForm.title.trim(),
          description: sceneForm.description.trim() || null,
          backgroundColor: form.sceneBackgroundColor,
          backgroundPattern: form.sceneBackgroundPattern,
          tabletopState: form.sceneTabletopState,
        }
      : null,
  };
}
