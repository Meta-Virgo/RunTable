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
  return log.charRole === "Keeper" ? "Keeper" : log.charName;
}

function parseDiceText(log: Log, secret: boolean) {
  try {
    const dice = JSON.parse(log.content);
    const name = dice.checkName ? ` ${dice.checkName}` : "";
    const details = Array.isArray(dice.details)
      ? ` [${dice.details.join(", ")}]`
      : "";
    return `${secret ? "secret roll" : "public roll"}${name}: ${dice.total}${details}`;
  } catch {
    return `${secret ? "secret roll" : "public roll"}: ${log.content}`;
  }
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
      text: `image handout: ${log.content}`,
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
    .map((entry) => `- ${entry.at} [${entry.actor}] ${entry.text}`)
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
