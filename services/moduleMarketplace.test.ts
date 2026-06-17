import { describe, expect, it, vi } from "vitest";
import { supabase } from "../supabase";
import type { ModuleTemplate } from "../types";
import {
  createUserModuleTemplate,
  createRoomFromModuleTemplate,
  deleteUserModuleTemplate,
  fetchModuleTemplateDetail,
  fetchModuleTemplates,
  filterModuleTemplates,
  getModuleTemplateComplexityLabel,
  getModuleTemplateDurationLabel,
  getModuleTemplatePlayersLabel,
  getModuleTemplateTags,
  updateUserModuleTemplate,
} from "./moduleMarketplace";

vi.mock("../supabase", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

const template = {
  id: "template-1",
  slug: "blackwater",
  title: "黑水车站失踪案",
  summary: "旧车站里的失踪事件",
  system: "coc",
  cover_image_url: null,
  tags: ["CoC", "调查", "短团"],
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
  bg_music_url: null,
  status: "published",
  published_at: "2026-06-16T00:00:00.000Z",
  created_at: "2026-06-16T00:00:00.000Z",
  updated_at: "2026-06-16T00:00:00.000Z",
} satisfies ModuleTemplate;

describe("module marketplace model helpers", () => {
  it("formats module card metadata", () => {
    expect(getModuleTemplatePlayersLabel(template)).toBe("2-4人");
    expect(getModuleTemplateDurationLabel(template)).toBe("2-3h");
    expect(getModuleTemplateComplexityLabel("intro")).toBe("入门");
  });

  it("filters templates by query and tag", () => {
    const other = {
      ...template,
      id: "template-2",
      title: "群星图书馆",
      summary: "一座收藏禁书的午夜图书馆",
      player_facing_premise: "管理员邀请调查员修复星图。",
      tags: ["长团"],
    };

    expect(
      filterModuleTemplates([template, other], { query: "车站" }).map(
        (item) => item.id
      )
    ).toEqual(["template-1"]);
    expect(
      filterModuleTemplates([template, other], { tag: "长团" }).map(
        (item) => item.id
      )
    ).toEqual(["template-2"]);
    expect(getModuleTemplateTags([template, other])).toEqual([
      "调查",
      "短团",
      "长团",
      "CoC",
    ]);
  });
});

describe("module marketplace repository calls", () => {
  it("fetches published template cards", async () => {
    const returns = vi.fn();
    const order = vi.fn(() => ({ returns }));
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    vi.mocked(supabase.from).mockReturnValue({ select } as any);

    await fetchModuleTemplates();

    expect(supabase.from).toHaveBeenCalledWith("module_templates");
    expect(eq).toHaveBeenCalledWith("status", "published");
    expect(order).toHaveBeenCalledWith("published_at", {
      ascending: false,
      nullsFirst: false,
    });
    expect(returns).toHaveBeenCalled();
  });

  it("fetches template details with characters and scenes", async () => {
    const single = vi.fn();
    const eqStatus = vi.fn(() => ({ single }));
    const eqId = vi.fn(() => ({ eq: eqStatus }));
    const select = vi.fn(() => ({ eq: eqId }));
    vi.mocked(supabase.from).mockReturnValue({ select } as any);

    await fetchModuleTemplateDetail("template-1");

    expect(supabase.from).toHaveBeenCalledWith("module_templates");
    expect(eqId).toHaveBeenCalledWith("id", "template-1");
    expect(eqStatus).toHaveBeenCalledWith("status", "published");
    expect(single).toHaveBeenCalled();
  });

  it("creates rooms through the authoritative instantiation rpc", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: "room-1",
      error: null,
    } as any);

    await createRoomFromModuleTemplate({
      templateId: "template-1",
      roomType: "voice",
      password: "secret",
      coverImageUrl: "https://example.test/cover.png",
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      "create_room_from_module_template",
      {
        p_template_id: "template-1",
        p_title: null,
        p_room_type: "voice",
        p_password: "secret",
        p_cover_image_url: "https://example.test/cover.png",
      }
    );
  });

  it("publishes user module templates through the authoritative upload rpc", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: "template-2",
      error: null,
    } as any);

    await createUserModuleTemplate({
      title: "自定义雨夜短团",
      summary: "玩家上传的调查模组",
      system: "coc",
      coverImageUrl: "https://example.test/custom.png",
      tags: ["调查", "自定义"],
      recommendedPlayersMin: 2,
      recommendedPlayersMax: 5,
      estimatedMinutesMin: 120,
      estimatedMinutesMax: 240,
      complexity: "standard",
      tone: "雨夜悬疑",
      contentWarnings: ["失踪"],
      playerFacingPremise: "暴雨封锁了一座旧车站。",
      keeperNotes: "站长知道真相。",
      defaultRoomType: "text",
      bgMusicUrl: null,
      scene: {
        title: "候车大厅",
        description: "旧木椅和闪烁的时刻表。",
        backgroundColor: "#182033",
        backgroundPattern: "grid",
        tabletopState: {
          roomId: "module-template",
          activeSceneId: "scene-1",
          scenes: [],
          tokens: [],
          shapes: [],
          fogRegions: [],
          updatedAt: "2026-06-16T00:00:00.000Z",
        },
      },
    });

    expect(supabase.rpc).toHaveBeenCalledWith("create_user_module_template", {
      p_title: "自定义雨夜短团",
      p_summary: "玩家上传的调查模组",
      p_system: "coc",
      p_cover_image_url: "https://example.test/custom.png",
      p_tags: ["调查", "自定义"],
      p_recommended_players_min: 2,
      p_recommended_players_max: 5,
      p_estimated_minutes_min: 120,
      p_estimated_minutes_max: 240,
      p_complexity: "standard",
      p_tone: "雨夜悬疑",
      p_content_warnings: ["失踪"],
      p_player_facing_premise: "暴雨封锁了一座旧车站。",
      p_keeper_notes: "站长知道真相。",
      p_default_room_type: "text",
      p_bg_music_url: null,
      p_characters: [],
      p_scene: {
        title: "候车大厅",
        description: "旧木椅和闪烁的时刻表。",
        background_color: "#182033",
        background_pattern: "grid",
        tabletop_state: {
          roomId: "module-template",
          activeSceneId: "scene-1",
          scenes: [],
          tokens: [],
          shapes: [],
          fogRegions: [],
          updatedAt: "2026-06-16T00:00:00.000Z",
        },
      },
    });
  });

  it("updates owner module templates through the authoritative edit rpc", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: "template-1",
      error: null,
    } as any);

    await updateUserModuleTemplate({
      templateId: "template-1",
      title: "黑水车站失踪案 修订版",
      summary: "更新后的简介",
      system: "coc",
      coverImageUrl: null,
      tags: ["调查"],
      recommendedPlayersMin: 2,
      recommendedPlayersMax: 4,
      estimatedMinutesMin: 120,
      estimatedMinutesMax: 180,
      complexity: "intro",
      tone: null,
      contentWarnings: [],
      playerFacingPremise: "更新后的玩家背景。",
      keeperNotes: null,
      defaultRoomType: "voice",
      bgMusicUrl: "https://example.test/music.mp3",
      scene: null,
    });

    expect(supabase.rpc).toHaveBeenCalledWith("update_user_module_template", {
      p_template_id: "template-1",
      p_title: "黑水车站失踪案 修订版",
      p_summary: "更新后的简介",
      p_system: "coc",
      p_cover_image_url: null,
      p_tags: ["调查"],
      p_recommended_players_min: 2,
      p_recommended_players_max: 4,
      p_estimated_minutes_min: 120,
      p_estimated_minutes_max: 180,
      p_complexity: "intro",
      p_tone: null,
      p_content_warnings: [],
      p_player_facing_premise: "更新后的玩家背景。",
      p_keeper_notes: null,
      p_default_room_type: "voice",
      p_bg_music_url: "https://example.test/music.mp3",
      p_characters: [],
      p_scene: null,
    });
  });

  it("maps user module NPC and monster drafts into template character payloads", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: "template-3",
      error: null,
    } as any);

    await createUserModuleTemplate({
      title: "有角色的模组",
      summary: "包含 NPC 和怪物",
      system: "coc",
      coverImageUrl: null,
      tags: [],
      recommendedPlayersMin: 2,
      recommendedPlayersMax: 4,
      estimatedMinutesMin: 120,
      estimatedMinutesMax: 180,
      complexity: "standard",
      tone: null,
      contentWarnings: [],
      playerFacingPremise: "玩家可见背景。",
      keeperNotes: null,
      defaultRoomType: "text",
      bgMusicUrl: null,
      characters: [
        {
          key: "station-master",
          characterType: "npc",
          displayOrder: 1,
          payload: {
            name: "梁站长",
            type: "npc",
            role: "NPC",
            theme_color: "#22d3ee",
            info: { job: "站长", notes: "回避事故" },
            stats: { str: 45, hp: 11 },
          },
        },
        {
          key: "platform-shadow",
          characterType: "monster",
          displayOrder: 2,
          payload: {
            name: "站台下的影子",
            type: "monster",
            role: "怪物",
            theme_color: "#fb7185",
            info: { notes: "在广播噪音里出现" },
            stats: { str: 80, hp: 16 },
          },
        },
      ],
      scene: null,
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      "create_user_module_template",
      expect.objectContaining({
        p_characters: [
          {
            key: "station-master",
            character_type: "npc",
            display_order: 1,
            payload: expect.objectContaining({
              name: "梁站长",
              type: "npc",
              info: { job: "站长", notes: "回避事故" },
            }),
          },
          {
            key: "platform-shadow",
            character_type: "monster",
            display_order: 2,
            payload: expect.objectContaining({
              name: "站台下的影子",
              type: "monster",
              stats: { str: 80, hp: 16 },
            }),
          },
        ],
      })
    );
  });

  it("deletes owner module templates through the authoritative delete rpc", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: null,
    } as any);

    await deleteUserModuleTemplate("template-1");

    expect(supabase.rpc).toHaveBeenCalledWith("delete_user_module_template", {
      p_template_id: "template-1",
    });
  });
});
