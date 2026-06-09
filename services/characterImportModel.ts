import type { Character } from "../types";

export const CHARACTER_IMPORT_ATTRIBUTES = [
  { key: "str", label: "力量 STR" },
  { key: "con", label: "体质 CON" },
  { key: "siz", label: "体型 SIZ" },
  { key: "dex", label: "敏捷 DEX" },
  { key: "app", label: "外貌 APP" },
  { key: "int", label: "智力 INT" },
  { key: "pow", label: "意志 POW" },
  { key: "edu", label: "教育 EDU" },
  { key: "luck", label: "幸运 LUCK" },
] as const;

export const CHARACTER_STAT_ALIASES: Record<string, keyof Character> = {
  力量: "str",
  str: "str",
  体质: "con",
  con: "con",
  体型: "siz",
  siz: "siz",
  敏捷: "dex",
  dex: "dex",
  外貌: "app",
  app: "app",
  智力: "int",
  int: "int",
  灵感: "int",
  意志: "pow",
  pow: "pow",
  教育: "edu",
  edu: "edu",
  幸运: "luck",
  luck: "luck",
  运气: "luck",
  hp: "hp",
  体力: "hp",
  san: "san",
  理智: "san",
  san值: "san",
  理智值: "san",
  mp: "mp",
  魔法: "mp",
};

export const CHARACTER_SKILL_ALIASES: Record<string, string> = {
  计算机: "计算机使用",
  电脑: "计算机使用",
  图书馆: "图书馆使用",
  驾驶: "汽车驾驶",
  汽车: "汽车驾驶",
  信用: "信用评级",
  信誉: "信用评级",
  领航: "导航",
  博物学: "自然学",
  取悦: "魅惑",
  克苏鲁: "克苏鲁神话",
  cm: "克苏鲁神话",
  开锁: "锁匠",
  撬锁: "锁匠",
  重型操作: "重型机械",
  操作重型机械: "重型机械",
  重型: "重型机械",
  侦查: "侦察",
};

export interface ImportedCharacterStats {
  updates: Partial<Character>;
  skills: Record<string, number>;
}

export function parseCharacterImportText(input: {
  text: string;
  currentSkills?: Record<string, number>;
}): ImportedCharacterStats | null {
  if (!input.text.trim()) return null;

  const regex = /([\u4e00-\u9fa5a-zA-Z]+)(\d+)/g;
  let match: RegExpExecArray | null;
  const updates: Partial<Character> = {};
  const skills: Record<string, number> = { ...(input.currentSkills || {}) };

  while ((match = regex.exec(input.text)) !== null) {
    const rawName = match[1];
    const statKey = CHARACTER_STAT_ALIASES[rawName.toLowerCase()];
    const value = Number.parseInt(match[2], 10);

    if (statKey) {
      (updates as Record<string, number>)[statKey] = value;
    } else {
      const skillName = CHARACTER_SKILL_ALIASES[rawName] || rawName;
      skills[skillName] = value;
    }
  }

  return { updates, skills };
}

export function applyCharacterImport(input: {
  character: Character;
  text: string;
}) {
  const parsed = parseCharacterImportText({
    text: input.text,
    currentSkills: input.character.skills,
  });
  if (!parsed) return input.character;

  return {
    ...input.character,
    ...parsed.updates,
    skills: parsed.skills,
  };
}
