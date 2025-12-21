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
}

export interface Room {
  id: string;
  created_at: string;
  kp_id: string;
  title: string;
  description: string | null;
  status: "open" | "closed" | "archived";
  room_number?: number;
  password?: string | null;
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
  inventory?: string | null;

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
  hp: number;
  san: number;
  mp: number;
  notes: string;
  backstory: string;
  skills: Record<string, number>;

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
