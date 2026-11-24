import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface TokenBody {
  roomName?: string;
  participantName?: string;
  characterId?: string;
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

const DEFAULT_ALLOWED_ORIGINS = [
  "https://trpgtool.monocanto.com",
  "https://trpgtool.maoyiwei.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
];

const getAllowedOrigins = () => {
  const configured = (Deno.env.get("APP_ORIGIN") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured]);
};

const buildCorsHeaders = (origin: string | null) => {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "OPTIONS,POST",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    Vary: "Origin",
  };

  if (origin && getAllowedOrigins().has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
};

const isOriginAllowed = (origin: string | null) =>
  !origin || getAllowedOrigins().has(origin);

const base64UrlEncode = (bytes: Uint8Array) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
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
  const encoder = new TextEncoder();
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(
    encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" }))
  );
  const payload = base64UrlEncode(
    encoder.encode(
      JSON.stringify({
        iss: apiKey,
        sub: identity,
        nbf: 0,
        exp: now + 6 * 60 * 60,
        name: participantName,
        video: {
          roomJoin: true,
          room: roomName,
        },
      })
    )
  );

  const data = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(apiSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(data))
  );

  return `${data}.${base64UrlEncode(signature)}`;
};

async function generateToken({
  body,
  authHeader,
}: {
  body: TokenBody;
  authHeader: string | null;
}) {
  const { roomName, participantName, characterId } = body;

  if (!roomName || !participantName || !characterId) {
    throw new TokenRequestError(
      400,
      "missing_fields",
      "Missing roomName, participantName, or characterId"
    );
  }

  const apiKey = Deno.env.get("LIVEKIT_API_KEY");
  const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!apiKey || !apiSecret || !supabaseUrl || !supabaseAnonKey) {
    throw new TokenRequestError(
      500,
      "server_misconfigured",
      "Server misconfigured"
    );
  }

  if (!authHeader) {
    throw new TokenRequestError(
      401,
      "missing_authorization",
      "Missing authorization"
    );
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

serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const corsHeaders = buildCorsHeaders(origin);
  const allowedOrigin = isOriginAllowed(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: allowedOrigin ? 200 : 403,
      headers: corsHeaders,
    });
  }

  if (!allowedOrigin) {
    return new Response(
      JSON.stringify({
        code: "origin_not_allowed",
        error: "Origin not allowed",
      }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        code: "method_not_allowed",
        error: "Method not allowed",
      }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  let body: TokenBody = {};
  try {
    body = (await req.json()) as TokenBody;
  } catch {
    return new Response(
      JSON.stringify({ code: "invalid_json", error: "Invalid JSON body" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const token = await generateToken({
      body,
      authHeader: req.headers.get("authorization"),
    });

    return new Response(JSON.stringify({ token }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof TokenRequestError) {
      console.warn("voice-token rejected", {
        code: error.code,
        statusCode: error.statusCode,
        roomName: body.roomName,
        characterId: body.characterId,
      });
      return new Response(
        JSON.stringify({ code: error.code, error: error.message }),
        {
          status: error.statusCode,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.error("voice-token failed", error);
    return new Response(
      JSON.stringify({
        code: "token_generation_failed",
        error: "Could not generate token",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
