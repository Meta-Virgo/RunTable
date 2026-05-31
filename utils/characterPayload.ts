import { Character } from "../types";

export interface CharacterPayloadOptions {
  userId: string;
  roomId?: string | null;
  name?: string;
  typeFallback?: Character["type"];
}

export interface CharacterMutationPayload {
  room_id?: string | null;
  user_id: string;
  name: string;
  role: string;
  avatar_url?: string | null;
  type: Character["type"];
  info: {
    job: string;
    age: string;
    sex: string;
    notes: string;
    backstory: string;
    skills: Record<string, number>;
    items: Character["items"];
    spells: Character["spells"];
  };
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
    skills: Record<string, number>;
  };
}

export function buildCharacterMutationPayload(
  char: Character,
  options: CharacterPayloadOptions
): CharacterMutationPayload {
  const payload: CharacterMutationPayload = {
    user_id: options.userId,
    name: options.name ?? char.name,
    role: char.role,
    avatar_url: char.avatar_url,
    type: (char.type || options.typeFallback || "investigator") as Character["type"],
    info: {
      job: char.job,
      age: char.age,
      sex: char.sex,
      notes: char.notes,
      backstory: char.backstory,
      skills: char.skills || {},
      items: char.items || [],
      spells: char.spells || [],
    },
    stats: {
      str: char.str,
      con: char.con,
      siz: char.siz,
      dex: char.dex,
      app: char.app,
      int: char.int,
      pow: char.pow,
      edu: char.edu,
      luck: char.luck,
      hp: char.hp,
      san: char.san,
      mp: char.mp,
      skills: char.skills || {},
    },
  };

  if (options.roomId !== undefined) {
    payload.room_id = options.roomId;
  }

  return payload;
}
