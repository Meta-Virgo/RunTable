import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;

let genAI: GoogleGenerativeAI | null = null;

export const generateAIResponse = async (prompt: string): Promise<string> => {
    // Lazy initialization
    if (!genAI && apiKey) {
        try {
            genAI = new GoogleGenerativeAI(apiKey);
        } catch (e) {
            console.error("Failed to initialize Google AI:", e);
            return "初始化 AI 服务失败，请检查 API Key 格式。";
        }
    }

    if (!genAI) {
        return "错误：未配置 Google API Key，或初始化失败。请检查控制台日志。";
    }

    try {
        // Use gemini-1.5-flash for faster responses
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        const systemInstruction = `你是一个跑团（TRPG）的辅助AI助手，专门协助守秘人（KP）进行游戏。
你的任务是根据KP的输入，生成场景描述、NPC对话、规则建议或剧情灵感。
请保持回复风格符合克苏鲁神话（CoC）或其他TRPG的氛围。
如果是场景描述，要注重感官细节。
如果是NPC扮演，直接给出对话内容。
`;
        
        const result = await model.generateContent(systemInstruction + "\n用户输入：" + prompt);
        const response = await result.response;
        return response.text();
    } catch (error: any) {
        console.error("AI Generation Error:", error);
        return `AI 生成失败: ${error.message || "未知错误"}.`;
    }
};
