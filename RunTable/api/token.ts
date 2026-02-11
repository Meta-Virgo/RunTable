import { AccessToken } from "livekit-server-sdk";

interface VercelRequest {
  method: string;
  body: any;
}

interface VercelResponse {
  setHeader(name: string, value: string): void;
  status(code: number): {
    json: (body: any) => void;
    end: () => void;
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. 设置跨域 (CORS) - 允许您的前端访问
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // 如果是预检请求 (Options)，直接返回成功
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // 2. 从请求体获取参数
    const { roomName, participantName } = req.body || {};

    if (!roomName || !participantName) {
      return res
        .status(400)
        .json({ error: "Missing roomName or participantName" });
    }

    // 3. 从 Vercel 环境变量获取密钥
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return res.status(500).json({ error: "Server misconfigured" });
    }

    // 4. 生成 Token
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantName,
    });

    at.addGrant({ roomJoin: true, room: roomName });
    const token = await at.toJwt();

    return res.status(200).json({ token });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Could not generate token" });
  }
}
