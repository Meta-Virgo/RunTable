import { Character, ModuleInfo } from "../types";

export const INITIAL_CHAR_STATE: Character = {
  id: "",
  name: "",
  role: "调查员",
  type: "investigator",
  avatar_url: null,
  job: "",
  age: "",
  sex: "",
  str: 50,
  con: 50,
  siz: 50,
  dex: 50,
  app: 50,
  int: 50,
  pow: 50,
  edu: 50,
  luck: 50,
  hp: 10,
  san: 50,
  mp: 10,
  notes: "",
  backstory: "",
  skills: {},
  items: [],
  spells: [],
};

export const EMPTY_MODULE_INFO: ModuleInfo = {
  title: "",
  description: "",
  coverImageUrl: null,
  notes: "",
};

export const PAGE_SIZE = 50;
