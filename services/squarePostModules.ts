import type {
  Character,
  CreateSquarePostModuleInput,
  Log,
  SquareCharacterSummaryPayload,
  SquarePostModule,
  SquareRoomLogExcerptEntry,
  SquareRoomLogExcerptPayload,
} from "../types";

const CORE_STAT_KEYS = [
  "str",
  "con",
  "siz",
  "dex",
  "app",
  "int",
  "pow",
  "edu",
  "luck",
  "hp",
  "san",
  "mp",
] as const;

const MAX_TOP_SKILLS = 8;
const MAX_LOG_TEXT_LENGTH = 480;

const toNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const clipText = (value: string, maxLength = MAX_LOG_TEXT_LENGTH) => {
  const text = value.trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
};

export function buildCharacterSummaryPayload(
  character: Character
): SquareCharacterSummaryPayload {
  const stats = CORE_STAT_KEYS.reduce(
    (result, key) => ({
      ...result,
      [key]: toNumber(character[key]),
    }),
    {} as SquareCharacterSummaryPayload["stats"]
  );

  const top_skills = Object.entries(character.skills || {})
    .filter((entry): entry is [string, number] => typeof entry[1] === "number")
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, MAX_TOP_SKILLS)
    .map(([name, value]) => ({ name, value }));

  return {
    title: character.name || "未命名调查员",
    avatar_url: character.avatar_url || null,
    name: character.name || "未命名调查员",
    role: character.role || "调查员",
    type: character.type || "investigator",
    theme_color: character.theme_color || null,
    job: character.job || null,
    age: character.age || null,
    sex: character.sex || null,
    stats,
    top_skills,
  };
}

export function createCharacterSummaryModule(
  character: Character
): CreateSquarePostModuleInput {
  return {
    module_type: "character_summary",
    payload: buildCharacterSummaryPayload(character),
    source_character_id: character.id,
    source_room_id: null,
    source_message_ids: [],
  };
}

export function isPublicRoomLog(log: Log) {
  return !log.recipientId && log.type !== "dice_secret";
}

function toRoomLogExcerptEntry(log: Log): SquareRoomLogExcerptEntry {
  const isImage = log.type === "image";

  return {
    id: log.id,
    at: log.createdAt,
    actor: log.charName || "未知角色",
    role: log.charRole || "",
    type: log.type,
    text: isImage ? "展示图片" : clipText(log.content || ""),
    image_url: isImage ? log.content : null,
  };
}

export function buildRoomLogExcerptPayload(input: {
  roomId: string;
  roomTitle?: string | null;
  logs: Log[];
  title?: string;
}): SquareRoomLogExcerptPayload {
  const entries = input.logs
    .filter(isPublicRoomLog)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .map(toRoomLogExcerptEntry);

  return {
    title: input.title?.trim() || input.roomTitle || "跑团片段",
    room_title: input.roomTitle || null,
    entries,
  };
}

export function createRoomLogExcerptModule(input: {
  roomId: string;
  roomTitle?: string | null;
  logs: Log[];
  title?: string;
}): CreateSquarePostModuleInput | null {
  const payload = buildRoomLogExcerptPayload(input);
  if (payload.entries.length === 0) return null;

  return {
    module_type: "room_log_excerpt",
    payload,
    source_character_id: null,
    source_room_id: input.roomId,
    source_message_ids: payload.entries.map((entry) => entry.id),
  };
}

export function normalizeSquarePostModules(post: {
  square_post_modules?: SquarePostModule[] | null;
  modules?: SquarePostModule[] | null;
}) {
  return [...(post.square_post_modules || post.modules || [])].sort(
    (left, right) =>
      (left.display_order || 0) - (right.display_order || 0) ||
      (left.created_at || "").localeCompare(right.created_at || "")
  );
}

export function getSquareModuleSearchText(module: SquarePostModule) {
  if (module.module_type === "character_summary") {
    const payload = module.payload as SquareCharacterSummaryPayload;
    return [
      payload.title,
      payload.name,
      payload.role,
      payload.job,
      payload.age,
      payload.sex,
      ...payload.top_skills.map((skill) => skill.name),
    ]
      .filter(Boolean)
      .join(" ");
  }

  const payload = module.payload as SquareRoomLogExcerptPayload;
  return [
    payload.title,
    payload.room_title,
    ...payload.entries.flatMap((entry) => [entry.actor, entry.role, entry.text]),
  ]
    .filter(Boolean)
    .join(" ");
}
