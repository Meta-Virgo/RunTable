import { useCallback } from "react";
import { Character, Log } from "../types";
import { updateCharacterStats as saveCharacterStats } from "../services/characters";
import { parseDiceCommand } from "../utils/commandParser";
import {
  buildBonusPenaltyRoll,
  buildGrowthCheck,
  buildOpposedCheck,
} from "../utils/cocAutomation";
import { evaluateDiceExpression, resolveStatAlias } from "../utils/diceExpression";

type AddLog = (
  type: Log["type"],
  content: string,
  customCharId?: string,
  recipientId?: string | null,
  meta?: Record<string, any>
) => Promise<void>;

type StatChange = {
  stat: string;
  value: number;
  type: "=" | "+" | "-";
};

interface UseTabletopCommandsOptions {
  characters: Character[];
  activeCharId: string;
  isKP: boolean;
  addLog: AddLog;
  random?: () => number;
}

const HELP_TEXT = `🎲 指令帮助
────────────────
.r  [表达式] [原因]
    投掷骰子 (例: .r 1d100 侦查)

.rh [表达式] [原因]
    暗骰 (仅KP可用)

.ra [技能] [修正]
    技能检定 (例: .ra 侦查 +20)

.sc [成功]/[失败] [当前San]
    理智检定 (例: .sc 1/1d4)

.st [属性][操作符][值]
    修改属性 (例: .st hp-1)`;

const getCurrentStats = (character: Character) =>
  character.stats || {
    str: character.str,
    con: character.con,
    siz: character.siz,
    dex: character.dex,
    app: character.app,
    int: character.int,
    pow: character.pow,
    edu: character.edu,
    luck: character.luck,
    hp: character.hp,
    san: character.san,
    mp: character.mp,
  };

const getRollResult = (
  total: number,
  count: number,
  sides: number,
  target?: number
) => {
  if (target === undefined || count !== 1 || sides !== 100) return undefined;
  if (total <= 5) return "critical_success";
  if (total >= 96) return "critical_failure";
  if (total <= target) return "success";
  return "failure";
};

export function useTabletopCommands({
  characters,
  activeCharId,
  isKP,
  addLog,
  random = Math.random,
}: UseTabletopCommandsOptions) {
  const rollInteger = useCallback(
    (sides: number) => Math.floor(random() * sides) + 1,
    [random]
  );

  const rollDice = useCallback(
    (
      count: number,
      sides: number,
      isSecret: boolean = false,
      checkInfo?: { name: string; target?: number }
    ) => {
      let total = 0;
      const details: number[] = [];

      for (let index = 0; index < count; index++) {
        const roll = rollInteger(sides);
        total += roll;
        details.push(roll);
      }

      const resultData: Record<string, any> = {
        count,
        type: sides,
        total,
        details,
      };

      if (checkInfo) {
        resultData.checkName = checkInfo.name;

        if (checkInfo.target !== undefined) {
          resultData.checkTarget = checkInfo.target;
          resultData.checkResult = getRollResult(
            total,
            count,
            sides,
            checkInfo.target
          );
        }
      }

      addLog(
        isSecret ? "dice_secret" : "dice",
        JSON.stringify(resultData),
        activeCharId === "pc" ? "pc" : activeCharId
      );

      return total;
    },
    [activeCharId, addLog, rollInteger]
  );

  const updateCharacterStats = useCallback(
    async (charId: string, changes: StatChange[]) => {
      const target = characters.find((character) => character.id === charId);
      if (!target) return;

      const newStats: Record<string, any> = { ...getCurrentStats(target) };
      const logChanges: string[] = [];

      changes.forEach((change) => {
        const key = resolveStatAlias(change.stat);
        if (newStats[key] === undefined) return;

        const current = newStats[key] || 0;
        let newValue = change.value;
        if (change.type === "+") newValue = current + change.value;
        if (change.type === "-") newValue = current - change.value;

        newStats[key] = newValue;
        logChanges.push(`${change.stat.toUpperCase()} ${current} -> ${newValue}`);
      });

      if (logChanges.length === 0) return;

      const { error } = await saveCharacterStats(charId, newStats);
      if (!error) {
        addLog("system", `[${target.name}] 属性变更: ${logChanges.join(", ")}`);
      }
    },
    [addLog, characters]
  );

  const handleSanityCheck = useCallback(
    async (
      successExpr: string,
      failureExpr: string,
      currentSanVal?: number
    ) => {
      if (activeCharId === "pc") {
        addLog("system", "守秘人无法进行理智检定");
        return;
      }

      const character = characters.find((item) => item.id === activeCharId);
      if (!character) return;

      const currentSan =
        currentSanVal !== undefined ? currentSanVal : character.san;
      const roll = rollInteger(100);
      const isSuccess = roll <= currentSan;
      const checkResult = getRollResult(roll, 1, 100, currentSan);
      const lossExpr = isSuccess ? successExpr : failureExpr;
      let loss = 0;
      let lossDetails = "";

      if (/^\d+$/.test(lossExpr)) {
        loss = parseInt(lossExpr);
        lossDetails = lossExpr;
      } else {
        const match = lossExpr.match(/^(\d+)d(\d+)$/i);
        if (match) {
          const count = parseInt(match[1]);
          const sides = parseInt(match[2]);
          const details: number[] = [];

          for (let index = 0; index < count; index++) {
            const rolled = rollInteger(sides);
            loss += rolled;
            details.push(rolled);
          }

          lossDetails = `${lossExpr}(${details.join("+")})=${loss}`;
        } else {
          lossDetails = "0";
        }
      }

      addLog(
        "dice",
        JSON.stringify({
          count: 1,
          type: 100,
          total: roll,
          details: [roll],
          checkName: "Sanity Check",
          checkTarget: currentSan,
          checkResult,
        }),
        activeCharId
      );

      setTimeout(() => {
        const resultMsg = isSuccess
          ? `SC成功! 减少 ${lossDetails} 点理智`
          : `SC失败! 减少 ${lossDetails} 点理智`;
        const newSan = currentSan - loss;

        addLog("system", `[${character.name}] ${resultMsg}，当前 SAN: ${newSan}`);

        if (loss > 0) {
          updateCharacterStats(character.id, [
            { stat: "san", value: loss, type: "-" },
          ]);
        }
      }, 500);
    },
    [activeCharId, addLog, characters, rollInteger, updateCharacterStats]
  );

  const handleCommand = useCallback(
    (cmd: any, recipientId?: string | null) => {
      switch (cmd.type) {
        case "help":
          addLog("system", HELP_TEXT, undefined, recipientId);
          break;
        case "roll":
        case "roll_hidden": {
          if (cmd.type === "roll_hidden" && !isKP) {
            addLog("system", "只有守秘人可以使用暗骰 (.rh)");
            return;
          }

          if (cmd.payload.expression) {
            const character = characters.find(
              (item) => item.id === activeCharId
            );
            const { total, details } = evaluateDiceExpression(
              cmd.payload.expression,
              character
            );
            const msgType =
              cmd.type === "roll_hidden" ? "dice_secret" : "dice";

            addLog(
              msgType,
              JSON.stringify({
                count: 0,
                type: 0,
                total,
                details,
                expression: `${cmd.payload.expression} = ${total}`,
                checkName: cmd.payload.reason,
              }),
              activeCharId === "pc" ? "pc" : activeCharId
            );
          } else {
            rollDice(
              cmd.payload.count,
              cmd.payload.sides,
              cmd.type === "roll_hidden",
              { name: cmd.payload.reason }
            );
          }
          break;
        }
        case "check": {
          const character = characters.find((item) => item.id === activeCharId);
          let checkTarget = 0;
          let checkName = "";

          if (cmd.payload.targetExpression) {
            const { total } = evaluateDiceExpression(
              cmd.payload.targetExpression,
              character
            );
            checkTarget = total;
            checkName = cmd.payload.targetExpression;
          } else if (cmd.payload.skill) {
            const skillName = cmd.payload.skill;
            let baseVal = 0;

            if (character) {
              if (
                character.skills &&
                character.skills[skillName] !== undefined
              ) {
                baseVal = character.skills[skillName];
              } else if (character.stats) {
                const key = resolveStatAlias(skillName);
                if (character.stats[key] !== undefined) {
                  baseVal = character.stats[key];
                }
              }
            }

            if (cmd.payload.modifier) {
              const modStr = cmd.payload.modifier;
              const { total: modVal } = evaluateDiceExpression(
                modStr,
                character
              );
              const isRelative = /^[+\-*/]/.test(modStr.trim());
              checkTarget = isRelative ? baseVal + modVal : modVal;
              checkName = `${skillName} ${modStr}`;
            } else {
              checkTarget = baseVal;
              checkName = skillName;
            }
          }

          rollDice(1, 100, false, {
            name: checkName,
            target: checkTarget,
          });
          break;
        }
        case "sanity":
          handleSanityCheck(
            cmd.payload.success,
            cmd.payload.failure,
            cmd.payload.value
          );
          break;
        case "set":
          if (activeCharId !== "pc") {
            updateCharacterStats(activeCharId, cmd.payload);
          } else {
            addLog("system", "守秘人没有属性可以修改");
          }
          break;
        case "coc_rule": {
          if (cmd.payload.rule === "growth") {
            const result = buildGrowthCheck(cmd.payload);
            addLog("system", result.message, undefined, recipientId);
            break;
          }

          if (cmd.payload.rule === "bonus_penalty") {
            const result = buildBonusPenaltyRoll(cmd.payload);
            addLog(
              "dice",
              JSON.stringify({
                count: 1,
                type: 100,
                total: result.total,
                details: [...result.tensRolls, result.onesRoll],
                checkName: `${result.mode} die`,
              }),
              activeCharId === "pc" ? "pc" : activeCharId
            );
            break;
          }

          if (cmd.payload.rule === "opposed") {
            const result = buildOpposedCheck(cmd.payload);
            addLog(
              "system",
              `Opposed check: ${cmd.payload.challenger.name} (${result.challengerLevel}) vs ${cmd.payload.defender.name} (${result.defenderLevel}); winner: ${result.winner || "tie"}.`,
              undefined,
              recipientId
            );
          }
          break;
        }
        case "error":
          addLog("system", `指令错误: ${cmd.payload}`);
          break;
      }
    },
    [
      activeCharId,
      addLog,
      characters,
      handleSanityCheck,
      isKP,
      rollDice,
      updateCharacterStats,
    ]
  );

  const handleSend = useCallback(
    (
      text: string,
      recipientId?: string | null,
      type?: Log["type"],
      quote?: { id: string; content: string; charName: string }
    ) => {
      const command = parseDiceCommand(text);
      if (command) {
        handleCommand(command, recipientId);
        return;
      }

      addLog(
        type || "normal",
        text,
        undefined,
        recipientId,
        quote ? { quote } : undefined
      );
    },
    [addLog, handleCommand]
  );

  return {
    rollDice,
    handleSend,
  };
}
