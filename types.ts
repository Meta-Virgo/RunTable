export type Role = 'Investigator' | 'Keeper' | 'NPC' | 'Monster';

export interface Character {
  id: string;
  name: string;
  role: string; // Stored as string to allow flexible roles, but typically maps to Role types
  job: string;
  ageSex: string;
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
}

export interface Log {
  id: number;
  timestamp: string;
  charId: string;
  charName: string;
  charRole: string;
  type: 'normal' | 'system' | 'status' | 'dice';
  content: string;
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
}

export interface AppData {
  version: string;
  timestamp: number;
  moduleInfo: ModuleInfo;
  characters: Character[];
  logs: Log[];
}
