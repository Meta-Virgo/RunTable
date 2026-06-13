export type Role = "Investigator" | "Keeper" | "NPC" | "Monster";

// Supabase Tables

export interface Profile {
  id: string;
  nickname: string | null;
  bio?: string | null;
  user_code?: number;
  created_at: string;
  is_vip?: boolean;
  avatar_url?: string | null;
  level?: number;
  experience?: number;
}

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: "pending" | "accepted";
  created_at: string;
  friend_profile?: Profile; // Joined data
}

export interface Room {
  id: string;
  created_at: string;
  kp_id: string;
  title: string;
  description: string | null;
  status: "open" | "closed" | "archived" | "completed";
  room_number?: number;
  password?: string | null;
  has_password?: boolean;
  last_active_at?: string;
  bg_music_url?: string | null;
  cover_image_url?: string | null;
  type: "text" | "voice";
}

export interface GameHistory {
  id: string;
  created_at: string;
  room_id: string | null;
  room_title: string;
  room_description: string | null;
  start_time: string | null;
  end_time: string | null;
  kp_id: string;
  kp_nickname: string | null;
}

export interface GameHistoryParticipant {
  id: string;
  game_history_id: string;
  user_id: string;
  user_nickname: string | null;
  character_snapshot: Character;
  outcome: "存活" | "死亡" | "失踪" | "疯狂";
}

export interface InventoryItem {
  name: string;
  quantity: number;
  description?: string;
}

export interface Character {
  id: string;
  created_at?: string;
  updated_at?: string;
  user_id?: string;
  room_id?: string | null;
  name: string;
  role: string; // Now a DB column
  type: "investigator" | "npc" | "monster";
  theme_color?: string;
  avatar_url?: string | null;
  inventory?: string | null; // Deprecated, use items instead

  info?: Record<string, any>; // For storing job, age, sex, notes, backstory, skills etc.
  stats?: Record<string, any>; // For storing str, con, siz, etc.

  // Frontend compatibility fields (mapped from info/stats)
  job: string;
  age: string;
  sex: string;
  // ageSex: string; // Deprecated
  str: number;
  con: number;
  siz: number;
  dex: number;
  app: number;
  int: number;
  pow: number;
  edu: number;
  luck: number;

  // Computed stats
  db?: string;
  build?: number;

  hp: number;
  san: number;
  mp: number;
  notes: string;
  backstory: string;
  skills: Record<string, number>;
  items?: InventoryItem[];
  spells?: InventoryItem[];

  // Frontend only
  isOnline?: boolean;
}

export interface Message {
  id: string;
  created_at: string;
  room_id: string;
  user_id: string;
  character_id: string | null;
  recipient_id?: string | null; // New field for private messages
  type: "text" | "dice" | "system" | "image";
  content: string | null;
  meta: Record<string, any>; // { "cmd": "1d100", "result": 50 }
}

// Frontend Legacy Types (kept for compatibility during migration)

export interface Log {
  id: string;
  timestamp: string;
  createdAt: string; // ISO String for sorting/pagination
  userId?: string;
  charId: string;
  charName: string;
  charRole: string;
  charAvatar?: string | null;
  type: "normal" | "system" | "status" | "dice" | "dice_secret" | "image";
  content: string;
  isMine?: boolean;
  recipientId?: string | null; // New field for private messages
  quote?: {
    id: string;
    content: string;
    charName: string;
  };
}

export interface ModuleInfo {
  title: string;
  description: string;
  coverImageUrl?: string | null;
  notes: string;
}

export interface DiceRollResult {
  count: number;
  type: number;
  total: number;
  details: number[];
  checkName?: string;
  checkTarget?: number;
  checkResult?: "critical_success" | "success" | "failure" | "critical_failure";
}

export interface AppData {
  version: string;
  timestamp: number;
  moduleInfo: ModuleInfo;
  characters: Character[];
  logs: Log[];
}

// Square System Types
export interface Channel {
  id: string;
  name: string;
  category: string;
  description?: string;
  created_at: string;
}

export interface Post {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  image_url?: string | null;
  tags?: string[];
  square_post_modules?: SquarePostModule[];
  modules?: SquarePostModule[];
  created_at: string;
  updated_at: string;

  // Joined Data
  profiles?: {
    nickname: string;
    avatar_url: string;
    is_vip: boolean;
  };
  post_likes?: { count: number }[]; // For count aggregation
  post_comments?: { count: number }[]; // For count aggregation
  latest_comments?: PostComment[]; // For list view preview

  // Frontend Helpers
  like_count?: number;
  comment_count?: number;
  is_liked?: boolean; // If current user liked it
  liked_by?: { nickname: string }[];
}

export type SquarePostModuleType = "character_summary" | "room_log_excerpt";

export interface SquareCharacterSummaryPayload {
  title: string;
  avatar_url?: string | null;
  name: string;
  role: string;
  type: Character["type"];
  theme_color?: string | null;
  job?: string | null;
  age?: string | null;
  sex?: string | null;
  stats: {
    str: number;
    con: number;
    siz: number;
    dex: number;
    app: number;
    int: number;
    pow: number;
    edu: number;
    luck: number;
    hp: number;
    san: number;
    mp: number;
  };
  top_skills: Array<{ name: string; value: number }>;
}

export interface SquareRoomLogExcerptEntry {
  id: string;
  at: string;
  actor: string;
  role: string;
  type: Log["type"];
  text: string;
  image_url?: string | null;
}

export interface SquareRoomLogExcerptPayload {
  title: string;
  room_title?: string | null;
  entries: SquareRoomLogExcerptEntry[];
}

export interface SquarePostModule {
  id?: string;
  post_id?: string;
  module_type: SquarePostModuleType;
  payload: SquareCharacterSummaryPayload | SquareRoomLogExcerptPayload;
  source_character_id?: string | null;
  source_room_id?: string | null;
  source_message_ids?: string[];
  display_order?: number;
  created_at?: string;
}

export type CreateSquarePostModuleInput = Omit<
  SquarePostModule,
  "id" | "post_id" | "created_at"
>;

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  quote_id?: string | null;

  // Joined Data
  profiles?: {
    nickname: string;
    avatar_url: string;
    is_vip: boolean;
  };
  quote?: {
    id: string;
    content: string;
    user_id: string;
    profiles?: {
      nickname: string;
    };
  };

  // Frontend Helpers
  like_count?: number;
  is_liked?: boolean;
}

export interface Notification {
  id: string;
  user_id: string;
  actor_id: string;
  type: "like" | "comment";
  post_id: string;
  is_read: boolean;
  created_at: string;

  // Joined Data
  actor?: {
    nickname: string;
    avatar_url: string;
  };
  post?: {
    content: string;
  };
}

export interface DirectConversationSummary {
  conversation_id: string;
  friend_user_id: string;
  friend_nickname: string | null;
  friend_avatar_url: string | null;
  friend_user_code: number | null;
  last_message_id: string | null;
  last_message_content: string | null;
  last_message_sender_id: string | null;
  last_message_created_at: string | null;
  unread_count: number;
}

export interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: {
    nickname: string | null;
    avatar_url: string | null;
  } | null;
}

export interface SocialMessageBadgeCounts {
  unread_direct_count: number;
  pending_room_invitation_count: number;
}

export type RoomInvitationStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "revoked";

export interface RoomInvitationInboxItem {
  invitation_id: string;
  recipient_id: string | null;
  room_id: string;
  room_title: string;
  room_description: string | null;
  room_cover_image_url: string | null;
  room_type: Room["type"];
  room_has_password: boolean | null;
  keeper_user_id: string;
  keeper_nickname: string | null;
  keeper_avatar_url: string | null;
  invite_type: "friend" | "link";
  invitation_status: RoomInvitationStatus;
  recipient_status: RoomInvitationStatus;
  starts_at: string | null;
  note: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface RoomInvitationOutboxItem {
  invitation_id: string;
  room_id: string;
  room_title: string;
  invite_type: "friend" | "link";
  invitation_status: RoomInvitationStatus;
  recipient_user_id: string | null;
  recipient_nickname: string | null;
  recipient_avatar_url: string | null;
  recipient_status: RoomInvitationStatus | null;
  starts_at: string | null;
  note: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface RoomInviteLinkPreview {
  invitation_id: string;
  room_id: string;
  room_title: string;
  room_description: string | null;
  room_cover_image_url: string | null;
  room_type: Room["type"];
  room_has_password: boolean | null;
  keeper_user_id: string;
  keeper_nickname: string | null;
  keeper_avatar_url: string | null;
  starts_at: string | null;
  note: string | null;
  expires_at: string | null;
}

export interface RoomScene {
  id: string;
  room_id: string;
  title: string;
  description: string | null;
  background_color: string;
  background_pattern: "plain" | "grid" | "dots" | "mist";
  is_active: boolean;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface RoomSceneMarker {
  id: string;
  room_id: string;
  scene_id: string;
  character_id: string;
  x: number;
  y: number;
  is_hidden: boolean;
  label: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateRoomSceneInput {
  roomId: string;
  title: string;
  description?: string | null;
  backgroundColor?: string;
  backgroundPattern?: RoomScene["background_pattern"];
}

export interface UpdateRoomSceneInput {
  sceneId: string;
  title: string;
  description?: string | null;
  backgroundColor?: string;
  backgroundPattern?: RoomScene["background_pattern"];
}

export interface UpsertRoomSceneMarkerInput {
  sceneId: string;
  characterId: string;
  x: number;
  y: number;
  isHidden?: boolean;
  label?: string | null;
}

export interface MoveOwnSceneMarkerInput {
  markerId: string;
  x: number;
  y: number;
}
