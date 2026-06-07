export type CheckLevel =
  | "critical"
  | "extreme"
  | "hard"
  | "regular"
  | "failure";

export function getCheckLevel(roll: number, target: number): CheckLevel {
  if (roll <= 5) return "critical";
  if (roll <= Math.floor(target / 5)) return "extreme";
  if (roll <= Math.floor(target / 2)) return "hard";
  if (roll <= target) return "regular";
  return "failure";
}

export function buildGrowthCheck(input: {
  skill: string;
  currentValue: number;
  roll: number;
}) {
  const improved = input.roll > input.currentValue;
  return {
    ...input,
    improved,
    message: `${input.skill} growth check rolled ${input.roll}; ${
      improved ? "eligible for improvement" : "no improvement"
    }.`,
  };
}

export function buildSanChange(input: {
  characterName: string;
  currentSan: number;
  delta: number;
}) {
  const newSan = Math.max(0, input.currentSan + input.delta);
  return {
    ...input,
    newSan,
    message: `${input.characterName} SAN ${input.currentSan} -> ${newSan}.`,
  };
}

export function buildBonusPenaltyRoll(input: {
  tensRolls: number[];
  onesRoll: number;
  mode: "bonus" | "penalty";
}) {
  const selectedTens =
    input.mode === "bonus"
      ? Math.min(...input.tensRolls)
      : Math.max(...input.tensRolls);
  const total = selectedTens * 10 + input.onesRoll;

  return {
    ...input,
    selectedTens,
    total: total === 0 ? 100 : total,
  };
}

export function buildOpposedCheck(input: {
  challenger: { name: string; target: number; roll: number };
  defender: { name: string; target: number; roll: number };
}) {
  const challengerLevel = getCheckLevel(
    input.challenger.roll,
    input.challenger.target
  );
  const defenderLevel = getCheckLevel(input.defender.roll, input.defender.target);
  const rank: Record<CheckLevel, number> = {
    critical: 4,
    extreme: 3,
    hard: 2,
    regular: 1,
    failure: 0,
  };
  const challengerRank = rank[challengerLevel];
  const defenderRank = rank[defenderLevel];
  const winner =
    challengerRank > defenderRank
      ? input.challenger.name
      : defenderRank > challengerRank
        ? input.defender.name
        : input.challenger.target > input.defender.target
          ? input.challenger.name
          : input.defender.target > input.challenger.target
            ? input.defender.name
            : input.challenger.roll < input.defender.roll
              ? input.challenger.name
              : input.defender.roll < input.challenger.roll
                ? input.defender.name
                : null;

  return {
    challengerLevel,
    defenderLevel,
    winner,
  };
}
