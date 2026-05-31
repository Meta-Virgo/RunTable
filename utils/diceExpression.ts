import { Character } from "../types";

export const STAT_ALIAS_MAP: Record<string, string> = {
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
  意志: "pow",
  pow: "pow",
  教育: "edu",
  edu: "edu",
  幸运: "luck",
  luck: "luck",
  hp: "hp",
  HP: "hp",
  san: "san",
  SAN: "san",
  mp: "mp",
  MP: "mp",
  db: "db",
  DB: "db",
  伤害加值: "db",
  build: "build",
  Build: "build",
  体格: "build",
};

export function resolveStatAlias(stat: string) {
  return STAT_ALIAS_MAP[stat] || stat;
}

export function evaluateDiceExpression(
  expression: string,
  char: Character | undefined
): { total: number; details: string[] } {
  let evalString = expression.toLowerCase();
  const detailsParts: string[] = [];

  evalString = evalString.replace(/[a-z\u4e00-\u9fa5]+/g, (match) => {
    if (match === "d") return "d";

    const key = resolveStatAlias(match);
    if (char) {
      if ((char as any)[key] !== undefined) {
        return String((char as any)[key]).toLowerCase();
      }

      if (char.stats && char.stats[key] !== undefined) {
        return String(char.stats[key]);
      }

      if (char.skills && char.skills[match] !== undefined) {
        return String(char.skills[match]);
      }
    }

    return "0";
  });

  evalString = evalString.replace(/(\d*)d(\d+)/g, (_, p1, p2) => {
    const count = p1 ? parseInt(p1) : 1;
    const sides = parseInt(p2);
    let total = 0;
    const rolls = [];

    for (let i = 0; i < count; i++) {
      const roll = Math.floor(Math.random() * sides) + 1;
      total += roll;
      rolls.push(roll);
    }

    detailsParts.push(`${count}d${sides}[${rolls.join(",")}]`);
    return String(total);
  });

  evalString = evalString.replace(/\s+/g, "");
  evalString = evalString.replace(/\+\+/g, "+");
  evalString = evalString.replace(/\-\-/g, "+");
  evalString = evalString.replace(/\+\-/g, "-");
  evalString = evalString.replace(/\-\+/g, "-");

  if (!/^[\d\+\-\*\/\(\)\.]+$/.test(evalString)) {
    return { total: 0, details: ["表达式错误"] };
  }

  try {
    // eslint-disable-next-line no-new-func
    const result = new Function("return " + evalString)();
    const rounded = Math.round(result * 100) / 100;
    return { total: rounded, details: detailsParts };
  } catch {
    return { total: 0, details: ["计算错误"] };
  }
}
