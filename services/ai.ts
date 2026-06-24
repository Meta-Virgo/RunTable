import { supabase } from "../supabase";
import type { Character, Log, ModuleInfo } from "../types";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const MAX_RECENT_LOGS = 20;
const MAX_LOG_CONTEXT_CHARS = 6000;
const MAX_LOG_CONTENT_CHARS = 600;

export async function callDeepSeekAI(messages: AIMessage[]) {
  try {
    const { data, error } = await supabase.functions.invoke("ask-ai", {
      body: { messages },
    });

    if (error) {
      // Supabase Edge Function error (e.g. 500, 404, or network)
      throw new Error(error.message || "Call to AI function failed");
    }

    if (data?.error) {
      // Business logic error returned by the function
      throw new Error(data.error);
    }

    return data.content;
  } catch (error: any) {
    console.error("AI Service Error:", error);
    throw error;
  }
}

function clipText(value: unknown, maxLength: number) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function formatCharacterForAI(character: Character) {
  return [
    `${character.name} (${character.role}, ${character.type})`,
    `HP ${character.hp}`,
    `SAN ${character.san}`,
    `MP ${character.mp}`,
  ].join(" / ");
}

function formatLogForAI(log: Log) {
  const labels = [
    log.recipientId ? "私聊" : "公开",
    log.type === "dice_secret" ? "暗骰" : null,
    log.type === "dice" ? "投骰" : null,
    log.type === "system" ? "系统" : null,
    log.type === "status" ? "状态" : null,
  ].filter(Boolean);

  if (log.type === "image") {
    return `[${labels.join("/") || "公开"}] ${log.charName}: [图片]`;
  }

  let content = log.content;
  if (log.type === "dice" || log.type === "dice_secret") {
    try {
      const dice = JSON.parse(log.content);
      content = `[投骰] ${dice.count}D${dice.type}: ${dice.total}`;
    } catch {
      content = log.content;
    }
  }

  return `[${labels.join("/") || "公开"}] ${log.charName}: ${clipText(
    content,
    MAX_LOG_CONTENT_CHARS
  )}`;
}

function takeRecentLogLines(logs: Log[]) {
  const lines: string[] = [];
  let totalLength = 0;

  for (const log of logs.slice(-MAX_RECENT_LOGS).reverse()) {
    const line = formatLogForAI(log);
    if (totalLength + line.length > MAX_LOG_CONTEXT_CHARS) continue;
    lines.push(line);
    totalLength += line.length + 1;
  }

  return lines.reverse();
}

export function buildContext(
  moduleInfo: ModuleInfo,
  logs: Log[],
  characters: Character[]
) {
  const systemPrompt = `你是一个专业的TRPG（克苏鲁的呼唤 CoC）跑团辅助AI。
你的任务是根据当前的模组信息、角色信息和聊天记录，协助守秘人（KP）生成剧情描述、NPC对话或环境描写。
请保持神秘、恐怖或悬疑的氛围，符合CoC的风格。
回答应简洁有力，直接给出建议的内容，不要包含过多的解释。
`;

  const moduleContext = `
[模组信息]
标题: ${moduleInfo.title || "未知"}
描述: ${moduleInfo.description || "无"}
备注: ${moduleInfo.notes || "无"}
`;

  const activeChars = characters
    .filter((c) => c.isOnline)
    .map(formatCharacterForAI)
    .join("\n");
  const charContext = `
[当前在线角色]
${activeChars || "无"}
`;

  const recentLogs = takeRecentLogLines(logs).join("\n");

  const logContext = `
[最近聊天记录]
${recentLogs}
`;

  return {
    system: systemPrompt,
    context: `${moduleContext}\n${charContext}\n${logContext}`,
  };
}
