import { createClient } from "@supabase/supabase-js";
import { AccessToken } from "livekit-server-sdk";

export interface TokenBody {
  roomName?: string;
  participantName?: string;
  characterId?: string;
}

interface GenerateLiveKitTokenOptions {
  body: TokenBody;
  authHeader?: string;
  env: Record<string, string | undefined>;
}

export class TokenRequestError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "TokenRequestError";
  }
}

export async function generateLiveKitToken({
  body,
  authHeader,
  env,
}: GenerateLiveKitTokenOptions) {
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

  const token = new AccessToken(apiKey, apiSecret, {
    identity: `${user.id}:${characterId}`,
    name: participantName,
  });
  token.addGrant({ roomJoin: true, room: roomName });

  return token.toJwt();
}
