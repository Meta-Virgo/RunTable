import { describe, expect, it } from "vitest";
import type { ModuleTemplateDetail, TabletopState } from "../../types";
import {
  buildModuleCharacterPreview,
  buildUserModuleTemplateInput,
  createModuleCharacterDraft,
  getInitialUserModuleUploadForm,
  patchModuleCharacterStat,
  setModuleCharacterType,
  splitModuleListText,
  validateUserModuleUploadForm,
  validateUserModuleUploadStep,
} from "./userModuleUploadModel";

function createTabletopState(): TabletopState {
  return {
    roomId: "template-source",
    activeSceneId: "scene-1",
    scenes: [
      {
        id: "scene-1",
        title: "候车大厅",
        description: "旧木椅和闪烁的时刻表。",
        map: {
          config: {
            seed: "station",
            width: 2,
            height: 2,
            gridSize: 48,
            roomCount: 1,
            corridorDensity: 0,
            theme: "stone",
          },
          tiles: [],
        },
        createdAt: "2026-06-16T00:00:00.000Z",
        updatedAt: "2026-06-16T00:00:00.000Z",
      },
    ],
    tokens: [
      {
        id: "token-1",
        roomId: "template-source",
        sceneId: "scene-1",
        characterId: "module-character:station-master",
        x: 48,
        y: 96,
        size: 42,
        rotation: 0,
        zIndex: 1,
        isHidden: false,
        isLocked: false,
        label: null,
      },
      {
        id: "token-orphan",
        roomId: "template-source",
        sceneId: "scene-1",
        characterId: "module-character:deleted",
        x: 0,
        y: 0,
        size: 42,
        rotation: 0,
        zIndex: 2,
        isHidden: false,
        isLocked: false,
        label: null,
      },
    ],
    shapes: [],
    fogRegions: [],
    updatedAt: "2026-06-16T00:00:00.000Z",
  };
}

function createTemplate(): ModuleTemplateDetail {
  return {
    id: "template-1",
    slug: "blackwater",
    title: "黑水车站失踪案",
    summary: "旧车站里的失踪事件",
    system: "coc",
    cover_image_url: "https://example.test/cover.png",
    tags: ["调查", "短团"],
    recommended_players_min: 2,
    recommended_players_max: 4,
    estimated_minutes_min: 120,
    estimated_minutes_max: 180,
    complexity: "intro",
    tone: "雨夜悬疑",
    content_warnings: ["失踪"],
    player_facing_premise: "暴雨封锁了车站。",
    keeper_notes: "站长隐藏了秘密。",
    default_room_type: "text",
    bg_music_url: "https://example.test/music.mp3",
    status: "published",
    published_at: "2026-06-16T00:00:00.000Z",
    created_at: "2026-06-16T00:00:00.000Z",
    updated_at: "2026-06-16T00:00:00.000Z",
    module_template_characters: [
      {
        id: "character-1",
        template_id: "template-1",
        template_character_key: "station-master",
        character_type: "npc",
        payload: {
          name: "梁站长",
          role: "NPC",
          type: "npc",
          avatar_url: "https://example.test/avatar.png",
          theme_color: "#22d3ee",
          info: {
            job: "旧车站站长",
            notes: "总是避开时刻表。",
            backstory: "知道最后一班车的真相。",
          },
          stats: {
            str: 45,
            con: 55,
            hp: -3,
            mp: 12,
          },
        },
        display_order: 2,
        created_at: "2026-06-16T00:00:00.000Z",
      },
      {
        id: "character-investigator",
        template_id: "template-1",
        template_character_key: "pc",
        character_type: "investigator",
        payload: {
          name: "玩家角色",
          type: "investigator",
        },
        display_order: 1,
        created_at: "2026-06-16T00:00:00.000Z",
      },
    ],
    module_template_scenes: [
      {
        id: "scene-template-1",
        template_id: "template-1",
        template_scene_key: "station",
        title: "候车大厅",
        description: "旧木椅和闪烁的时刻表。",
        background_color: "#111827",
        background_pattern: "grid",
        tabletop_state: createTabletopState(),
        is_default: true,
        marker_payload: [],
        display_order: 1,
        created_at: "2026-06-16T00:00:00.000Z",
        updated_at: "2026-06-16T00:00:00.000Z",
      },
    ],
  };
}

describe("user module upload model", () => {
  it("builds an empty upload draft with a starter scene", () => {
    const form = getInitialUserModuleUploadForm();

    expect(form.title).toBe("");
    expect(form.system).toBe("coc");
    expect(form.sceneTabletopState.roomId).toBe("module-template");
    expect(form.sceneTabletopState.scenes).toHaveLength(1);
  });

  it("loads an existing template into a draft and prunes stale scene tokens", () => {
    const form = getInitialUserModuleUploadForm(createTemplate());

    expect(form.title).toBe("黑水车站失踪案");
    expect(form.tagsText).toBe("调查，短团");
    expect(form.estimatedHoursMin).toBe(2);
    expect(form.estimatedHoursMax).toBe(3);
    expect(form.characters).toHaveLength(1);
    expect(form.characters[0]).toMatchObject({
      key: "station-master",
      name: "梁站长",
      job: "旧车站站长",
      stats: {
        str: 45,
        con: 55,
        hp: 1,
        mp: 12,
      },
    });
    expect(form.sceneTabletopState.roomId).toBe("template-source");
    expect(form.sceneTabletopState.tokens.map((token) => token.id)).toEqual([
      "token-1",
    ]);
  });

  it("validates the wizard step rules through one interface", () => {
    const form = getInitialUserModuleUploadForm();

    expect(validateUserModuleUploadStep(form, 0)).toBe("请填写模组标题");
    expect(
      validateUserModuleUploadStep(
        { ...form, title: "车站", recommendedPlayersMin: 5, recommendedPlayersMax: 2 },
        1
      )
    ).toBe("推荐人数下限不能大于上限");
    expect(
      validateUserModuleUploadForm({
        ...form,
        title: "车站",
        system: "coc",
        playerFacingPremise: "玩家背景",
        sceneBackgroundColor: "blue",
      })
    ).toBe("场景底色需要使用 #RRGGBB 格式");
  });

  it("normalizes character drafts for previews and publish input", () => {
    const npc = {
      ...createModuleCharacterDraft("npc", "draft-npc"),
      name: "  梁站长  ",
      role: " NPC ",
      avatarUrl: " https://example.test/avatar.png ",
      job: "  站长 ",
      notes: "  避开问题 ",
      backstory: "  知道真相 ",
    };
    const monster = setModuleCharacterType(
      patchModuleCharacterStat(createModuleCharacterDraft("npc", "draft-monster"), "hp", -8),
      "monster"
    );

    expect(monster.role).toBe("怪物");
    expect(monster.stats.hp).toBe(1);
    expect(buildModuleCharacterPreview(npc, 0)).toMatchObject({
      id: "module-character:draft-npc",
      name: "梁站长",
      avatar_url: "https://example.test/avatar.png",
      job: "站长",
      notes: "避开问题",
    });
  });

  it("builds the publish input from a complete draft", () => {
    const form = {
      ...getInitialUserModuleUploadForm(createTemplate()),
      title: "  黑水车站失踪案  ",
      system: " CoC ",
      coverImageUrl: " ",
      tagsText: "调查，短团\n雨夜",
      recommendedPlayersMin: 0,
      recommendedPlayersMax: 99,
      playerFacingPremise: "  暴雨封锁了车站。 ",
      keeperNotes: " ",
      bgMusicUrl: " https://example.test/music.mp3 ",
    };

    expect(splitModuleListText(form.tagsText)).toEqual(["调查", "短团", "雨夜"]);
    expect(buildUserModuleTemplateInput(form)).toMatchObject({
      title: "黑水车站失踪案",
      summary: "暴雨封锁了车站。",
      system: "coc",
      coverImageUrl: null,
      tags: ["调查", "短团", "雨夜"],
      recommendedPlayersMin: 1,
      recommendedPlayersMax: 12,
      estimatedMinutesMin: 120,
      estimatedMinutesMax: 180,
      keeperNotes: null,
      bgMusicUrl: "https://example.test/music.mp3",
      characters: [
        expect.objectContaining({
          key: "station-master",
          characterType: "npc",
          displayOrder: 1,
          payload: expect.objectContaining({
            name: "梁站长",
            role: "NPC",
          }),
        }),
      ],
      scene: expect.objectContaining({
        title: "候车大厅",
        description: "旧木椅和闪烁的时刻表。",
        backgroundColor: "#111827",
        backgroundPattern: "grid",
      }),
    });
  });
});
