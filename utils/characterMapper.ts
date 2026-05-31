import { Character } from "../types";
import { calculateDBAndBuild } from "./cocRules";

type CharacterRow = Partial<Character> & {
  id: string;
  name: string;
  type: Character["type"];
  info?: Record<string, any> | string | null;
  stats?: Record<string, any> | string | null;
};

const parseJsonRecord = (
  value: Record<string, any> | string | null | undefined
) => {
  if (typeof value !== "string") {
    return value || {};
  }

  try {
    return JSON.parse(value) as Record<string, any>;
  } catch {
    return {};
  }
};

const defaultRoleForType = (type?: Character["type"]) => {
  if (type === "investigator") return "调查员";
  if (type === "monster") return "怪物";
  return "NPC";
};

export function mapCharacterRow(row: CharacterRow): Character {
  const info = parseJsonRecord(row.info);
  const stats = parseJsonRecord(row.stats);
  const str = stats.str || 50;
  const siz = stats.siz || 50;

  return {
    ...row,
    id: row.id,
    user_id: row.user_id,
    room_id: row.room_id,
    name: row.name,
    type: row.type,
    avatar_url: row.avatar_url,
    role: row.role || defaultRoleForType(row.type),
    info,
    stats,
    job: info.job || "",
    age: info.age || "",
    sex: info.sex || "",
    notes: info.notes || "",
    backstory: info.backstory || "",
    skills: info.skills || stats.skills || {},
    items: info.items || [],
    spells: info.spells || [],
    str,
    con: stats.con || 50,
    siz,
    dex: stats.dex || 50,
    app: stats.app || 50,
    int: stats.int || 50,
    pow: stats.pow || 50,
    edu: stats.edu || 50,
    luck: stats.luck || 50,
    hp: stats.hp || 10,
    san: stats.san || 50,
    mp: stats.mp || 10,
    ...calculateDBAndBuild(str, siz),
  };
}

export function mergeCharacterRow(
  current: Character,
  row: Partial<CharacterRow>
): Character {
  const info = parseJsonRecord(row.info) || current.info || {};
  const stats = parseJsonRecord(row.stats) || current.stats || {};
  const type = row.type !== undefined ? row.type : current.type;
  const str = stats.str !== undefined ? stats.str : current.str;
  const siz = stats.siz !== undefined ? stats.siz : current.siz;

  return {
    ...current,
    name: row.name !== undefined ? row.name : current.name,
    type,
    avatar_url:
      row.avatar_url !== undefined ? row.avatar_url : current.avatar_url,
    role:
      row.role !== undefined
        ? row.role
        : row.type !== undefined
        ? defaultRoleForType(row.type)
        : current.role,
    job: info.job !== undefined ? info.job : current.job,
    age: info.age !== undefined ? info.age : current.age,
    sex: info.sex !== undefined ? info.sex : current.sex,
    notes: info.notes !== undefined ? info.notes : current.notes,
    backstory:
      info.backstory !== undefined ? info.backstory : current.backstory,
    skills: info.skills || stats.skills || current.skills || {},
    items: info.items !== undefined ? info.items : current.items || [],
    spells: info.spells !== undefined ? info.spells : current.spells || [],
    str,
    con: stats.con !== undefined ? stats.con : current.con,
    siz,
    dex: stats.dex !== undefined ? stats.dex : current.dex,
    app: stats.app !== undefined ? stats.app : current.app,
    int: stats.int !== undefined ? stats.int : current.int,
    pow: stats.pow !== undefined ? stats.pow : current.pow,
    edu: stats.edu !== undefined ? stats.edu : current.edu,
    luck: stats.luck !== undefined ? stats.luck : current.luck,
    hp: stats.hp !== undefined ? stats.hp : current.hp,
    san: stats.san !== undefined ? stats.san : current.san,
    mp: stats.mp !== undefined ? stats.mp : current.mp,
    ...calculateDBAndBuild(str, siz),
    room_id: row.room_id !== undefined ? row.room_id : current.room_id,
    user_id: row.user_id !== undefined ? row.user_id : current.user_id,
    info,
    stats,
  };
}
