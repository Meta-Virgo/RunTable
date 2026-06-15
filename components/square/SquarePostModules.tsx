import React from "react";
import { Badge, BookOpen, Clock, Eye, ScrollText } from "lucide-react";
import type {
  Character,
  SquareCharacterSummaryPayload,
  SquarePostModule,
  SquareRoomLogExcerptPayload,
} from "../../types";
import { cn } from "../UI";
import { CharacterModal } from "../modals/CharacterModal";
import { formatSquareTime } from "./squareTime";

const VITAL_STATS: Array<keyof SquareCharacterSummaryPayload["stats"]> = [
  "hp",
  "san",
  "mp",
  "luck",
];

const statLabels: Record<keyof SquareCharacterSummaryPayload["stats"], string> =
  {
    str: "STR",
    con: "CON",
    siz: "SIZ",
    dex: "DEX",
    app: "APP",
    int: "INT",
    pow: "POW",
    edu: "EDU",
    luck: "LUCK",
    hp: "HP",
    san: "SAN",
    mp: "MP",
  };

interface SquarePostModulesProps {
  modules?: SquarePostModule[];
  compact?: boolean;
}

export const SquarePostModules: React.FC<SquarePostModulesProps> = ({
  modules = [],
  compact = false,
}) => {
  if (modules.length === 0) return null;

  return (
    <div className="space-y-3">
      {modules.map((module, index) =>
        module.module_type === "character_summary" ? (
          <CharacterSummaryCard
            key={module.id || `${module.module_type}-${index}`}
            payload={module.payload as SquareCharacterSummaryPayload}
            compact={compact}
          />
        ) : (
          <RoomLogExcerptCard
            key={module.id || `${module.module_type}-${index}`}
            payload={module.payload as SquareRoomLogExcerptPayload}
            compact={compact}
          />
        )
      )}
    </div>
  );
};

const toNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const toSkillRecord = (
  skills: Array<{ name: string; value: number }> = []
): Record<string, number> =>
  skills.reduce<Record<string, number>>((result, skill) => {
    if (skill.name.trim()) {
      result[skill.name] = toNumber(skill.value);
    }
    return result;
  }, {});

const buildReadonlyCharacter = (
  payload: SquareCharacterSummaryPayload
): Character => {
  const skills = payload.skills?.length ? payload.skills : payload.top_skills;

  return {
    id: `square-${payload.name || payload.title}`,
    name: payload.name || payload.title || "未命名角色",
    role: payload.role || "调查员",
    type: payload.type || "investigator",
    theme_color: payload.theme_color || undefined,
    avatar_url: payload.avatar_url || null,
    inventory: payload.inventory_text || null,
    job: payload.job || "",
    age: payload.age || "",
    sex: payload.sex || "",
    str: toNumber(payload.stats.str),
    con: toNumber(payload.stats.con),
    siz: toNumber(payload.stats.siz),
    dex: toNumber(payload.stats.dex),
    app: toNumber(payload.stats.app),
    int: toNumber(payload.stats.int),
    pow: toNumber(payload.stats.pow),
    edu: toNumber(payload.stats.edu),
    luck: toNumber(payload.stats.luck),
    hp: toNumber(payload.stats.hp),
    san: toNumber(payload.stats.san),
    mp: toNumber(payload.stats.mp),
    db: payload.db || undefined,
    build:
      typeof payload.build === "number" && Number.isFinite(payload.build)
        ? payload.build
        : undefined,
    notes: payload.notes || "",
    backstory: payload.backstory || "",
    skills: toSkillRecord(skills),
    items: payload.items || [],
    spells: payload.spells || [],
  };
};

const CharacterSummaryCard: React.FC<{
  payload: SquareCharacterSummaryPayload;
  compact: boolean;
}> = ({ payload, compact }) => {
  const [showDetail, setShowDetail] = React.useState(false);
  const skills = payload.skills?.length ? payload.skills : payload.top_skills;
  const topSkills = skills.slice(0, compact ? 3 : 5);
  const summary =
    payload.backstory ||
    payload.notes ||
    payload.inventory_text ||
    topSkills.map((skill) => skill.name).join(" / ");

  const openDetail = (event: React.MouseEvent) => {
    event.stopPropagation();
    setShowDetail(true);
  };
  const metaText =
    [payload.role, payload.job, payload.age, payload.sex]
      .filter(Boolean)
      .join(" · ") || "公开角色卡";
  const detailModal = showDetail ? (
    <CharacterModal
      initialData={buildReadonlyCharacter(payload)}
      isEditing
      readOnly
      onSave={() => undefined}
      onClose={() => setShowDetail(false)}
    />
  ) : null;

  if (compact) {
    return (
      <>
        <button
          type="button"
          onClick={openDetail}
          className="group w-full max-w-[26rem] overflow-hidden rounded-lg border border-dicecho-border/45 bg-dicecho-card/75 p-2 text-left shadow-sm transition-colors hover:border-dicecho-primary/55 hover:bg-dicecho-raised/70 focus:outline-none focus:ring-2 focus:ring-dicecho-primary/40"
          style={
            payload.theme_color
              ? { boxShadow: `inset 2px 0 0 ${payload.theme_color}` }
              : undefined
          }
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-dicecho-border/45 bg-dicecho-panel text-sm font-bold text-slate-200"
              style={
                payload.theme_color
                  ? { boxShadow: `inset 0 0 0 1.5px ${payload.theme_color}` }
                  : undefined
              }
            >
              {payload.avatar_url ? (
                <img
                  src={payload.avatar_url}
                  alt={payload.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                payload.name?.[0] || "?"
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold text-dicecho-primary">
                <Badge size={10} className="shrink-0" />
                <span className="shrink-0">车卡</span>
                <span className="h-1 w-1 shrink-0 rounded-full bg-dicecho-border/70" />
                <span className="shrink-0 text-dicecho-muted">只读</span>
              </div>
              <h3 className="truncate text-sm font-bold leading-5 text-white">
                {payload.name}
              </h3>
              <p className="truncate text-[11px] leading-4 text-dicecho-muted">
                {metaText}
              </p>
            </div>

            <div className="grid shrink-0 grid-cols-2 gap-1">
              {VITAL_STATS.slice(0, 2).map((key) => (
                <span
                  key={key}
                  className="rounded border border-dicecho-border/30 bg-dicecho-panel/55 px-1.5 py-1 text-center text-[10px] leading-none text-slate-200"
                >
                  <span className="block font-semibold text-dicecho-muted">
                    {statLabels[key]}
                  </span>
                  <span className="mt-0.5 block font-mono font-bold">
                    {payload.stats[key]}
                  </span>
                </span>
              ))}
            </div>

            <span
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-dicecho-border/35 bg-dicecho-panel/55 text-dicecho-muted transition-colors group-hover:border-dicecho-primary/45 group-hover:text-white"
              title="查看档案"
            >
              <Eye size={13} />
              <span className="sr-only">查看档案</span>
            </span>
          </div>
        </button>

        {detailModal}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={openDetail}
        className={cn(
          "group w-full overflow-hidden rounded-lg border border-dicecho-border/45 bg-dicecho-card/75 text-left shadow-sm transition-colors hover:border-dicecho-primary/55 hover:bg-dicecho-raised/70 focus:outline-none focus:ring-2 focus:ring-dicecho-primary/40",
          compact ? "p-3" : "p-4"
        )}
        style={
          payload.theme_color
            ? { boxShadow: `inset 3px 0 0 ${payload.theme_color}` }
            : undefined
        }
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dicecho-border/45 bg-dicecho-panel text-lg font-bold text-slate-200",
              compact ? "h-12 w-12" : "h-14 w-14"
            )}
            style={
              payload.theme_color
                ? { boxShadow: `inset 0 0 0 2px ${payload.theme_color}` }
                : undefined
            }
          >
            {payload.avatar_url ? (
              <img
                src={payload.avatar_url}
                alt={payload.name}
                className="h-full w-full object-cover"
              />
            ) : (
              payload.name?.[0] || "?"
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-dicecho-primary">
                <Badge size={13} />
                车卡分享
              </span>
              <span className="rounded-full border border-dicecho-border/35 bg-dicecho-panel/65 px-2 py-0.5 text-[10px] text-dicecho-muted">
                只读快照
              </span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold text-white">
                  {payload.name}
                </h3>
                <p className="mt-1 truncate text-xs text-dicecho-muted">
                  {metaText}
                </p>
              </div>
              <span className="hidden shrink-0 items-center gap-1 rounded-md border border-dicecho-border/35 bg-dicecho-panel/55 px-2 py-1 text-[11px] font-semibold text-slate-200 transition-colors group-hover:border-dicecho-primary/45 group-hover:text-white sm:inline-flex">
                <Eye size={12} />
                查看档案
              </span>
            </div>
          </div>
        </div>

        {summary && (
          <p
            className={cn(
              "mt-3 text-xs leading-5 text-slate-300",
              compact ? "line-clamp-2" : "line-clamp-3"
            )}
          >
            {summary}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {VITAL_STATS.map((key) => (
            <span
              key={key}
              className="rounded-md border border-dicecho-border/30 bg-dicecho-panel/55 px-2 py-1 text-[11px] font-mono text-slate-200"
            >
              {statLabels[key]} {payload.stats[key]}
            </span>
          ))}
        </div>

        {topSkills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {topSkills.map((skill) => (
              <span
                key={skill.name}
                className="inline-flex items-center gap-1 rounded-full border border-dicecho-border/30 bg-dicecho-panel/45 px-2 py-1 text-[11px] text-slate-200"
              >
                <BookOpen size={10} className="text-dicecho-primary" />
                {skill.name}
                <span className="font-mono text-dicecho-muted">
                  {skill.value}
                </span>
              </span>
            ))}
          </div>
        )}
      </button>

      {detailModal}
    </>
  );
};

const RoomLogExcerptCard: React.FC<{
  payload: SquareRoomLogExcerptPayload;
  compact: boolean;
}> = ({ payload, compact }) => (
  <article className="rounded-lg border border-dicecho-border/45 bg-dicecho-panel/55 p-3 text-sm">
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-dicecho-primary">
        <ScrollText size={13} />
        跑团片段
      </span>
      <h3 className="font-bold text-white">{payload.title}</h3>
      {payload.room_title && (
        <span className="text-xs text-dicecho-muted">· {payload.room_title}</span>
      )}
    </div>

    <div className={cn("mt-3 space-y-2", compact && "max-h-64 overflow-hidden")}>
      {payload.entries.map((entry) => (
        <div
          key={entry.id}
          className="rounded-md border border-dicecho-border/30 bg-dicecho-card/55 p-2"
        >
          <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-dicecho-muted">
            <span className="inline-flex items-center gap-1">
              <Clock size={11} />
              {formatSquareTime(entry.at)}
            </span>
            <span className="font-semibold text-slate-300">{entry.actor}</span>
            {entry.role && <span>{entry.role}</span>}
          </div>
          {entry.image_url ? (
            <img
              src={entry.image_url}
              alt={entry.text}
              className="max-h-48 rounded-md border border-dicecho-border/30"
            />
          ) : (
            <p className="whitespace-pre-wrap break-words text-xs leading-5 text-slate-200">
              {entry.text}
            </p>
          )}
        </div>
      ))}
    </div>
  </article>
);
