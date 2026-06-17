import { supabase } from "../supabase";
import type {
  CreateRoomFromModuleTemplateInput,
  CreateUserModuleTemplateInput,
  ModuleTemplate,
  ModuleTemplateDetail,
  UpdateUserModuleTemplateInput,
} from "../types";

export const MODULE_TEMPLATE_LIST_SELECT =
  "id, slug, title, summary, system, cover_image_url, tags, recommended_players_min, recommended_players_max, estimated_minutes_min, estimated_minutes_max, complexity, tone, content_warnings, player_facing_premise, keeper_notes, default_room_type, bg_music_url, status, created_by_user_id, author:created_by_user_id (nickname, avatar_url), published_at, created_at, updated_at";

export const MODULE_TEMPLATE_DETAIL_SELECT = `${MODULE_TEMPLATE_LIST_SELECT}, module_template_characters (*), module_template_scenes (*)`;

export type ModuleTemplateFilter = {
  query?: string;
  system?: string;
  tag?: string;
};

const complexityLabels: Record<ModuleTemplate["complexity"], string> = {
  intro: "入门",
  standard: "标准",
  advanced: "进阶",
};

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase();
}

export function getModuleTemplateDurationLabel(template: ModuleTemplate) {
  const min = Math.round(template.estimated_minutes_min / 60);
  const max = Math.round(template.estimated_minutes_max / 60);
  if (min === max) return `${min}h`;
  return `${min}-${max}h`;
}

export function getModuleTemplatePlayersLabel(template: ModuleTemplate) {
  if (template.recommended_players_min === template.recommended_players_max) {
    return `${template.recommended_players_min}人`;
  }
  return `${template.recommended_players_min}-${template.recommended_players_max}人`;
}

export function getModuleTemplateComplexityLabel(
  complexity: ModuleTemplate["complexity"]
) {
  return complexityLabels[complexity] || "标准";
}

export function filterModuleTemplates(
  templates: ModuleTemplate[],
  filter: ModuleTemplateFilter
) {
  const query = normalizeSearchText(filter.query || "");
  return templates.filter((template) => {
    if (filter.system && template.system !== filter.system) return false;
    if (filter.tag && !template.tags.includes(filter.tag)) return false;
    if (!query) return true;

    return [
      template.title,
      template.summary,
      template.player_facing_premise,
      template.system,
      ...template.tags,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
}

export function getModuleTemplateTags(templates: ModuleTemplate[]) {
  return Array.from(new Set(templates.flatMap((template) => template.tags))).sort(
    (left, right) => left.localeCompare(right)
  );
}

export async function fetchModuleTemplates() {
  return supabase
    .from("module_templates")
    .select(MODULE_TEMPLATE_LIST_SELECT)
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .returns<ModuleTemplate[]>();
}

export async function fetchModuleTemplateDetail(templateId: string) {
  return supabase
    .from("module_templates")
    .select(MODULE_TEMPLATE_DETAIL_SELECT)
    .eq("id", templateId)
    .eq("status", "published")
    .single<ModuleTemplateDetail>();
}

export async function createRoomFromModuleTemplate(
  input: CreateRoomFromModuleTemplateInput
) {
  return supabase.rpc("create_room_from_module_template", {
    p_template_id: input.templateId,
    p_title: null,
    p_room_type: input.roomType,
    p_password: input.password || null,
    p_cover_image_url: input.coverImageUrl || null,
  });
}

export async function createUserModuleTemplate(
  input: CreateUserModuleTemplateInput
) {
  return supabase.rpc("create_user_module_template", mapModuleTemplateRpcInput(input));
}

export async function updateUserModuleTemplate(
  input: UpdateUserModuleTemplateInput
) {
  return supabase.rpc("update_user_module_template", {
    p_template_id: input.templateId,
    ...mapModuleTemplateRpcInput(input),
  });
}

export async function deleteUserModuleTemplate(templateId: string) {
  return supabase.rpc("delete_user_module_template", {
    p_template_id: templateId,
  });
}

function mapModuleTemplateRpcInput(input: CreateUserModuleTemplateInput) {
  return {
    p_title: input.title,
    p_summary: input.summary,
    p_system: input.system,
    p_cover_image_url: input.coverImageUrl || null,
    p_tags: input.tags,
    p_recommended_players_min: input.recommendedPlayersMin,
    p_recommended_players_max: input.recommendedPlayersMax,
    p_estimated_minutes_min: input.estimatedMinutesMin,
    p_estimated_minutes_max: input.estimatedMinutesMax,
    p_complexity: input.complexity,
    p_tone: input.tone || null,
    p_content_warnings: input.contentWarnings,
    p_player_facing_premise: input.playerFacingPremise,
    p_keeper_notes: input.keeperNotes || null,
    p_default_room_type: input.defaultRoomType,
    p_bg_music_url: input.bgMusicUrl || null,
    p_characters: (input.characters || []).map((character, index) => ({
      key: character.key || null,
      character_type: character.characterType,
      payload: character.payload,
      display_order: character.displayOrder ?? index + 1,
    })),
    p_scene:
      input.scene && input.scene.title.trim()
        ? {
            title: input.scene.title,
            description: input.scene.description || null,
            background_color: input.scene.backgroundColor || "#182033",
            background_pattern: input.scene.backgroundPattern || "grid",
            tabletop_state: input.scene.tabletopState || null,
        }
      : null,
  };
}
