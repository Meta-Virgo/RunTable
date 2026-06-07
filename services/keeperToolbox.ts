export type KeeperPersonaKind = "npc" | "monster";

export interface KeeperPersonaTemplate {
  id: string;
  roomId: string;
  kind: KeeperPersonaKind;
  name: string;
  description: string;
}

export function createKeeperPersonaTemplate(input: KeeperPersonaTemplate) {
  return { ...input };
}

export function createPersonaMessage(
  template: KeeperPersonaTemplate,
  content: string
) {
  return {
    charId: `persona:${template.id}`,
    charName: template.name,
    charRole: template.kind === "monster" ? "Monster" : "NPC",
    content,
  };
}

export function createSecretBatchRolls(input: {
  reason: string;
  targets: string[];
  rolls: number[];
}) {
  return {
    publicSummary: `Keeper made ${input.targets.length} secret rolls for ${input.reason}.`,
    keeperResults: input.targets.map((target, index) => ({
      target,
      total: input.rolls[index],
    })),
  };
}
