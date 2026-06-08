import { Log } from "../types";

export interface SessionReportEntry {
  logId: string;
  at: string;
  actor: string;
  kind: "chat" | "system" | "roll" | "image";
  text: string;
}

export interface SessionReport {
  publicTimeline: SessionReportEntry[];
  keeperOnlyTimeline: SessionReportEntry[];
  publicMarkdown: string;
  keeperOnlyMarkdown: string;
}

function getDisplayName(log: Log) {
  return log.charRole === "Keeper" ? "守秘人" : log.charName;
}

function parseDiceText(log: Log, secret: boolean) {
  try {
    const dice = JSON.parse(log.content);
    const total = dice.total ?? log.content;
    const expression = dice.expression || `${dice.count || 1}D${dice.type || 100}`;
    const target =
      dice.checkTarget !== undefined && dice.checkTarget !== null
        ? `/${dice.checkTarget}`
        : "";
    const result = dice.checkResult
      ? `，${formatCheckResult(dice.checkResult)}`
      : "";
    const prefix = dice.checkName
      ? `${secret ? "暗骰：" : ""}${dice.checkName}检定`
      : secret
      ? "暗骰"
      : "掷骰";
    return `${prefix}：${expression} = ${total}${target}${result}`;
  } catch {
    return `${secret ? "暗骰" : "掷骰"}：${log.content}`;
  }
}

function formatCheckResult(result: string) {
  switch (result) {
    case "critical_success":
      return "大成功";
    case "success":
      return "成功";
    case "failure":
      return "失败";
    case "critical_failure":
      return "大失败";
    default:
      return result;
  }
}

function formatReportTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function toReportEntry(log: Log, secret = false): SessionReportEntry {
  const actor = getDisplayName(log);

  if (log.type === "dice" || log.type === "dice_secret") {
    return {
      logId: log.id,
      at: log.createdAt,
      actor,
      kind: "roll",
      text: parseDiceText(log, secret),
    };
  }

  if (log.type === "image") {
    return {
      logId: log.id,
      at: log.createdAt,
      actor,
      kind: "image",
      text: `展示图片：${log.content}`,
    };
  }

  return {
    logId: log.id,
    at: log.createdAt,
    actor,
    kind: log.type === "system" || log.type === "status" ? "system" : "chat",
    text: log.content.replace(/\*\*/g, ""),
  };
}

function renderMarkdown(entries: SessionReportEntry[]) {
  if (entries.length === 0) return "No reportable entries.";

  return entries
    .map((entry) => `${formatReportTime(entry.at)} ${entry.actor} ${entry.text}`)
    .join("\n");
}

export function buildSessionReport(sourceLogs: Log[]): SessionReport {
  const sortedLogs = [...sourceLogs].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  );
  const publicTimeline: SessionReportEntry[] = [];
  const keeperOnlyTimeline: SessionReportEntry[] = [];

  sortedLogs.forEach((log) => {
    if (log.recipientId) return;

    if (log.type === "dice_secret") {
      keeperOnlyTimeline.push(toReportEntry(log, true));
      return;
    }

    publicTimeline.push(toReportEntry(log));
  });

  return {
    publicTimeline,
    keeperOnlyTimeline,
    publicMarkdown: renderMarkdown(publicTimeline),
    keeperOnlyMarkdown: renderMarkdown(keeperOnlyTimeline),
  };
}

export function buildStoryReport(sourceLogs: Log[]) {
  if (sourceLogs.length === 0) return "No reportable entries.";

  return buildSessionReport(sourceLogs).publicMarkdown;
}
