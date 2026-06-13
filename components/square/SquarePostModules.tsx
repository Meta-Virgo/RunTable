import React from "react";
import { Badge, Clock, ScrollText } from "lucide-react";
import type {
  SquareCharacterSummaryPayload,
  SquarePostModule,
  SquareRoomLogExcerptPayload,
} from "../../types";
import { cn } from "../UI";
import { formatSquareTime } from "./squareTime";

const CORE_STATS: Array<keyof SquareCharacterSummaryPayload["stats"]> = [
  "str",
  "con",
  "siz",
  "dex",
  "app",
  "int",
  "pow",
  "edu",
  "luck",
  "hp",
  "san",
  "mp",
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

const CharacterSummaryCard: React.FC<{
  payload: SquareCharacterSummaryPayload;
  compact: boolean;
}> = ({ payload, compact }) => (
  <article className="rounded-lg border border-dicecho-primary/25 bg-dicecho-primary/10 p-3 text-sm">
    <div className="flex items-start gap-3">
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dicecho-border/40 bg-dicecho-panel text-lg font-bold text-slate-200"
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
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-dicecho-primary">
            <Badge size={13} />
            车卡分享
          </span>
          <h3 className="truncate text-base font-bold text-white">
            {payload.name}
          </h3>
        </div>
        <p className="mt-1 text-xs text-dicecho-muted">
          {[payload.role, payload.job, payload.age, payload.sex]
            .filter(Boolean)
            .join(" · ") || "公开调查员摘要"}
        </p>
      </div>
    </div>

    <div
      className={cn(
        "mt-3 grid gap-1.5",
        compact ? "grid-cols-4" : "grid-cols-6"
      )}
    >
      {CORE_STATS.map((key) => (
        <div
          key={key}
          className="rounded-md border border-dicecho-border/30 bg-dicecho-panel/45 px-2 py-1 text-center"
        >
          <div className="text-[10px] text-dicecho-muted">{statLabels[key]}</div>
          <div className="font-mono text-xs font-bold text-slate-100">
            {payload.stats[key]}
          </div>
        </div>
      ))}
    </div>

    {payload.top_skills.length > 0 && (
      <div className="mt-3 flex flex-wrap gap-1.5">
        {payload.top_skills.map((skill) => (
          <span
            key={skill.name}
            className="rounded-full border border-dicecho-border/30 bg-dicecho-panel/55 px-2 py-1 text-[11px] text-slate-200"
          >
            {skill.name} {skill.value}
          </span>
        ))}
      </div>
    )}
  </article>
);

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
