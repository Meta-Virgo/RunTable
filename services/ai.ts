import { supabase } from "../supabase";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

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

export function buildContext(moduleInfo: any, logs: any[], characters: any[]) {
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
    .map((c) => `${c.name} (${c.role})`)
    .join(", ");
  const charContext = `
[当前在线角色]
${activeChars || "无"}
`;

  // Get last 20 logs
  const recentLogs = logs
    .slice(-20)
    .map((l) => {
      let content = l.content;
      if (l.type === "dice") {
        try {
          const d = JSON.parse(l.content);
          content = `[投骰] ${d.count}D${d.type}: ${d.total}`;
        } catch (e) {}
      }
      return `${l.charName}: ${content}`;
    })
    .join("\n");

  const logContext = `
[最近聊天记录]
${recentLogs}
`;

  return {
    system: systemPrompt,
    context: `${moduleContext}\n${charContext}\n${logContext}`,
  };
}
