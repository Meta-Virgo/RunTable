import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Character, CreateSquarePostModuleInput } from "../../types";
import { SquareComposer } from "./SquareComposer";

const character = {
  id: "char-1",
  name: "Lin",
  role: "调查员",
  type: "investigator",
  job: "侦探",
  age: "32",
  sex: "女",
  str: 50,
  con: 55,
  siz: 60,
  dex: 65,
  app: 70,
  int: 75,
  pow: 80,
  edu: 85,
  luck: 45,
  hp: 12,
  san: 60,
  mp: 16,
  notes: "",
  backstory: "",
  skills: {},
} satisfies Character;

const module = {
  module_type: "character_summary",
  payload: {
    title: "Lin",
    name: "Lin",
    role: "调查员",
    type: "investigator",
    stats: {
      str: 50,
      con: 55,
      siz: 60,
      dex: 65,
      app: 70,
      int: 75,
      pow: 80,
      edu: 85,
      luck: 45,
      hp: 12,
      san: 60,
      mp: 16,
    },
    top_skills: [],
  },
  source_character_id: "char-1",
  source_room_id: null,
  source_message_ids: [],
} satisfies CreateSquarePostModuleInput;

describe("Square composer modules", () => {
  it("renders character module controls and pending previews", () => {
    const html = renderToStaticMarkup(
      <SquareComposer
        activeChannelName="general"
        shareableCharacters={[character]}
        pendingModules={[module]}
        addCharacterModule={vi.fn()}
        removeModule={vi.fn()}
        newPostContent=""
        setNewPostContent={vi.fn()}
        posting={false}
        pendingImage={null}
        clearPendingImage={vi.fn()}
        processFile={vi.fn()}
        handlePaste={vi.fn()}
        handleDrop={vi.fn()}
        handlePost={vi.fn()}
      />
    );

    expect(html).toContain("分享模块");
    expect(html).toContain("添加车卡");
    expect(html).toContain("Lin");
    expect(html).toContain("车卡分享");
  });
});

