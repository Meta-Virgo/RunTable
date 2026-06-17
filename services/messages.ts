import { supabase } from "../supabase";
import { Character, Log } from "../types";

const MESSAGE_WITH_CHARACTER_SELECT = `
  *,
  characters ( id, name, type, role, info, theme_color, avatar_url )
`;

type ProfileRow = {
  id: string;
  nickname: string | null;
  avatar_url?: string | null;
};

type MessageRow = {
  id: string;
  created_at: string;
  room_id: string;
  user_id: string;
  character_id: string | null;
  recipient_id?: string | null;
  type: Log["type"];
  content: string;
  meta?: Record<string, any> | null;
  characters?: {
    id: string;
    name: string;
    type: Character["type"];
    role?: string | null;
    avatar_url?: string | null;
  } | null;
};

interface AddMessageOptions {
  roomId: string;
  userId: string;
  characterId?: string | null;
  type: Log["type"] | "system";
  content: string;
  recipientId?: string | null;
  meta?: Record<string, any>;
}

export async function addMessage({
  roomId,
  userId,
  characterId = null,
  type,
  content,
  recipientId = null,
  meta = {},
}: AddMessageOptions) {
  return supabase.from("messages").insert({
    room_id: roomId,
    user_id: userId,
    character_id: characterId,
    type,
    content,
    recipient_id: recipientId,
    meta,
  });
}

export async function deleteMessage(messageId: string) {
  return supabase.from("messages").delete().eq("id", messageId);
}

export async function deleteRoomMessages(roomId: string) {
  return supabase.from("messages").delete().eq("room_id", roomId);
}

export async function fetchLatestMessages(roomId: string, limit: number) {
  return supabase
    .from("messages")
    .select(MESSAGE_WITH_CHARACTER_SELECT)
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(limit);
}

export async function fetchMessagesBefore(
  roomId: string,
  before: string,
  limit: number
) {
  return supabase
    .from("messages")
    .select(MESSAGE_WITH_CHARACTER_SELECT)
    .eq("room_id", roomId)
    .lt("created_at", before)
    .order("created_at", { ascending: false })
    .limit(limit);
}

export async function fetchMessagesPage(
  roomId: string,
  page: number,
  batchSize: number
) {
  return supabase
    .from("messages")
    .select(MESSAGE_WITH_CHARACTER_SELECT)
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .range(page * batchSize, (page + 1) * batchSize - 1);
}

export async function fetchProfilesForMessages(messages: MessageRow[]) {
  const userIds = Array.from(new Set(messages.map((message) => message.user_id)));

  if (userIds.length === 0) {
    return new Map<string, ProfileRow>();
  }

  const { data } = await supabase
    .from("profiles")
    .select("id, nickname, avatar_url")
    .in("id", userIds);

  return new Map((data || []).map((profile) => [profile.id, profile]));
}

const fallbackRoleForType = (type?: Character["type"]) => {
  if (type === "investigator") return "调查员";
  if (type === "monster") return "怪物";
  return "NPC";
};

export function formatMessageTimestamp(createdAt: string) {
  return new Date(createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function mapMessageToLog(
  message: MessageRow,
  profileMap: Map<string, ProfileRow>,
  currentUserId?: string
): Log {
  const profile = profileMap.get(message.user_id);
  const character = message.characters;
  const charName = character
    ? character.name
    : profile?.nickname || "守秘人";
  const charAvatar = character ? character.avatar_url : profile?.avatar_url;
  const charRole = character
    ? character.role || fallbackRoleForType(character.type)
    : "Keeper";

  return {
    id: message.id,
    timestamp: formatMessageTimestamp(message.created_at),
    createdAt: message.created_at,
    userId: message.user_id,
    charId: message.character_id || "pc",
    charName,
    charRole,
    charAvatar,
    type: message.type,
    content: message.content,
    isMine: message.user_id === currentUserId,
    recipientId: message.recipient_id,
    quote: message.meta?.quote,
  };
}

export async function mapMessagesToLogs(
  messages: MessageRow[],
  currentUserId?: string
) {
  const profileMap = await fetchProfilesForMessages(messages);
  return messages.map((message) =>
    mapMessageToLog(message, profileMap, currentUserId)
  );
}

export async function mapRealtimeMessageToLog(
  message: MessageRow,
  currentUserId: string,
  characters: Character[]
) {
  const localCharacter = characters.find((c) => c.id === message.character_id);

  if (localCharacter) {
    return mapMessageToLog(
      {
        ...message,
        characters: {
          id: localCharacter.id,
          name: localCharacter.name,
          type: localCharacter.type,
          role: localCharacter.role,
          avatar_url: localCharacter.avatar_url,
        },
      },
      new Map(),
      currentUserId
    );
  }

  if (message.character_id) {
    const { data: character } = await supabase
      .from("characters")
      .select("id, name, type, role, avatar_url")
      .eq("id", message.character_id)
      .single();

    return mapMessageToLog(
      { ...message, characters: character },
      new Map(),
      currentUserId
    );
  }

  const profileMap = await fetchProfilesForMessages([message]);
  return mapMessageToLog(message, profileMap, currentUserId);
}
