import { createClient } from "@supabase/supabase-js";
import { SignJWT } from "jose";

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
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "TokenRequestError";
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
  const secret = new TextEncoder().encode(apiSecret);

  return new SignJWT({
    name: participantName,
    video: {
      roomJoin: true,
      room: roomName,
    },
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(apiKey)
    .setSubject(identity)
    .setNotBefore(0)
    .setExpirationTime("6h")
    .sign(secret);
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
      "Missing roomName, participantName, or characterId"
    );
  }

  const apiKey = env.LIVEKIT_API_KEY;
  const apiSecret = env.LIVEKIT_API_SECRET;
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

  if (!apiKey || !apiSecret || !supabaseUrl || !supabaseAnonKey) {
    throw new TokenRequestError(500, "Server misconfigured");
  }

  if (!authHeader) {
    throw new TokenRequestError(401, "Missing authorization");
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
    throw new TokenRequestError(401, "Unauthorized");
  }

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, kp_id, type")
    .eq("id", roomName)
    .single();

  if (roomError || !room || room.type !== "voice") {
    throw new TokenRequestError(403, "Voice room not available");
  }

  const isKeeper = room.kp_id === user.id;
  if (characterId === "pc") {
    if (!isKeeper) {
      throw new TokenRequestError(403, "Only the keeper can join as KP");
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
      throw new TokenRequestError(403, "Character is not in this room");
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
    const token = await generateToken({
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
