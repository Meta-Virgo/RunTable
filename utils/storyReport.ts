import { Log } from "../types";

export function buildStoryReport(sourceLogs: Log[]) {
  if (sourceLogs.length === 0) return "暂无记录。";

  return sourceLogs
    .filter((log) => {
      if (log.type !== "system") return true;

      return (
        !log.content.includes("已清空聊天记录") &&
        !log.content.includes("进入了房间") &&
        !log.content.includes("离开了房间")
      );
    })
    .map((log) => {
      const displayName = log.charRole === "Keeper" ? "守秘人" : log.charName;

      if (log.type === "dice" || log.type === "dice_secret") {
        try {
          const dice = JSON.parse(log.content);
          const prefix = log.type === "dice_secret" ? "(暗骰) " : "";
          return `> [${displayName}] ${prefix}投掷了 ${dice.count}D${
            dice.type || 6
          }: ${dice.total} [${dice.details.join(", ")}]`;
        } catch {
          return `> [${displayName}] ${log.content}`;
        }
      }

      if (["system", "status"].includes(log.type)) {
        return `> [${displayName}] ${log.content}`;
      }

      if (log.type === "image") {
        return `${displayName}: [图片]`;
      }

      const cleanContent = log.content.replace(/\*\*/g, "");
      return `${displayName}: ${cleanContent}`;
    })
    .join("\n\n");
}
