import {
  generateLiveKitToken,
  TokenRequestError,
} from "../server/livekitToken";
import type { TokenBody } from "../server/livekitToken";

interface VercelRequest {
  method: string;
  headers?: Record<string, string | string[] | undefined>;
  body: unknown;
}

interface VercelResponse {
  setHeader(name: string, value: string): void;
  status(code: number): {
    json: (body: unknown) => void;
    end: () => void;
  };
}

const getHeader = (
  headers: VercelRequest["headers"],
  name: string
): string | undefined => {
  const value = headers?.[name] ?? headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
};

const parseBody = (body: unknown): TokenBody => {
  if (typeof body === "string") {
    return JSON.parse(body) as TokenBody;
  }
  return (body || {}) as TokenBody;
};

const getAllowedOrigins = () => {
  const configuredOrigins = (
    process.env.APP_ORIGIN ||
    process.env.VITE_APP_ORIGIN ||
    ""
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const vercelOrigin = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "";

  return new Set([
    ...configuredOrigins,
    vercelOrigin,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
  ]);
};

const applyCors = (req: VercelRequest, res: VercelResponse) => {
  const origin = getHeader(req.headers, "origin");
  if (!origin) return true;

  if (!getAllowedOrigins().has(origin)) {
    return false;
  }

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  return true;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const isAllowedOrigin = applyCors(req, res);
  res.setHeader("Access-Control-Allow-Methods", "OPTIONS,POST");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(isAllowedOrigin ? 200 : 403).end();
  }

  if (!isAllowedOrigin) {
    return res.status(403).json({ error: "Origin not allowed" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const token = await generateLiveKitToken({
      body: parseBody(req.body),
      authHeader: getHeader(req.headers, "authorization"),
      env: process.env,
    });

    return res.status(200).json({ token });
  } catch (error) {
    console.error(error);
    if (error instanceof TokenRequestError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: "Could not generate token" });
  }
}
