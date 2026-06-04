import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";

interface TokenBody {
  roomName?: string;
  participantName?: string;
  characterId?: string;
}

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

class TokenRequestError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = "TokenRequestError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

const getHeader = (
  headers: VercelRequest["headers"],
  name: string
): string | undefined => {
  const value = headers?.[name] ?? headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
};

const parseBody = (body: unknown): TokenBody => {
  try {
    if (typeof body === "string") {
      return JSON.parse(body) as TokenBody;
    }
    return (body || {}) as TokenBody;
  } catch {
    throw new TokenRequestError(400, "invalid_json", "Invalid JSON body");
  }
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

const base64UrlEncode = (value: string | Buffer) =>
  Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const createLiveKitJwt = async ({
  apiKey,
  apiSecret,
  identity,
  participantName,
  roomName,
}: {
  apiKey: string;
  apiSecret: string;
  identity: string;
  participantName: string;
  roomName: string;
}) => {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(JSON.stringify({
    iss: apiKey,
    sub: identity,
    nbf: 0,
    exp: now + 6 * 60 * 60,
    name: participantName,
    video: {
      roomJoin: true,
      room: roomName,
    },
  }));
  const data = `${header}.${payload}`;
  const signature = createHmac("sha256", apiSecret).update(data).digest();

  return `${data}.${base64UrlEncode(signature)}`;
};

async function generateToken({
  body,
  authHeader,
  env,
}: {
  body: TokenBody;
  authHeader?: string;
  env: Record<string, string | undefined>;
}) {
  const { roomName, participantName, characterId } = body;

  if (!roomName || !participantName || !characterId) {
    throw new TokenRequestError(
      400,
      "missing_fields",
      "Missing roomName, participantName, or characterId"
    );
  }

  const apiKey = env.LIVEKIT_API_KEY;
  const apiSecret = env.LIVEKIT_API_SECRET;
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

  if (!apiKey || !apiSecret || !supabaseUrl || !supabaseAnonKey) {
    throw new TokenRequestError(500, "server_misconfigured", "Server misconfigured");
  }

  if (!authHeader) {
    throw new TokenRequestError(401, "missing_authorization", "Missing authorization");
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new TokenRequestError(401, "unauthorized", "Unauthorized");
  }

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, kp_id, type")
    .eq("id", roomName)
    .single();

  if (roomError || !room || room.type !== "voice") {
    throw new TokenRequestError(
      403,
      "voice_room_not_available",
      "Voice room not available"
    );
  }

  const isKeeper = room.kp_id === user.id;
  if (characterId === "pc") {
    if (!isKeeper) {
      throw new TokenRequestError(
        403,
        "keeper_only",
        "Only the keeper can join as KP"
      );
    }
  } else {
    const { data: character, error: characterError } = await supabase
      .from("characters")
      .select("id, user_id, room_id")
      .eq("id", characterId)
      .single();

    if (
      characterError ||
      !character ||
      character.user_id !== user.id ||
      character.room_id !== roomName
    ) {
      throw new TokenRequestError(
        403,
        "character_not_in_room",
        "Character is not in this room"
      );
    }
  }

  return createLiveKitJwt({
    apiKey,
    apiSecret,
    identity: `${user.id}:${characterId}`,
    participantName,
    roomName,
  });
}

const applyCors = (req: VercelRequest, res: VercelResponse) => {
  const origin = getHeader(req.headers, "origin");
  if (!origin) return true;

  const host = getHeader(req.headers, "host");
  const isSameOrigin = (() => {
    if (!host) return false;

    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  })();

  if (!isSameOrigin && !getAllowedOrigins().has(origin)) {
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
    return res
      .status(403)
      .json({ code: "origin_not_allowed", error: "Origin not allowed" });
  }

  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ code: "method_not_allowed", error: "Method not allowed" });
  }

  try {
    const body = parseBody(req.body);
    const token = await generateToken({
      body,
      authHeader: getHeader(req.headers, "authorization"),
      env: process.env,
    });

    return res.status(200).json({ token });
  } catch (error) {
    if (error instanceof TokenRequestError) {
      const body = (() => {
        try {
          return parseBody(req.body);
        } catch {
          return {};
        }
      })();
      console.warn("voice-token rejected", {
        code: error.code,
        statusCode: error.statusCode,
        roomName: body.roomName,
        characterId: body.characterId,
      });
      return res
        .status(error.statusCode)
        .json({ code: error.code, error: error.message });
    }
    console.error("voice-token failed", error);
    return res
      .status(500)
      .json({ code: "token_generation_failed", error: "Could not generate token" });
  }
}
