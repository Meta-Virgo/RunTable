import React, { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Map as MapIcon,
  Mic,
  MessageSquare,
  Music,
  Shield,
  Swords,
  UserCog,
  Users,
} from "lucide-react";
import type {
  ModuleTemplateCharacter,
  ModuleTemplateDetail,
  ModuleTemplateScene,
  TabletopMapTile,
} from "../../types";
import { cn } from "../UI";
import { extractBlueprintContours } from "../tabletop/blueprintContourModel";
import { getLineCurveControlPoint } from "../tabletop/tabletopCanvasModel";

interface ModuleKeeperBriefingProps {
  template: ModuleTemplateDetail;
}

const CORE_STAT_KEYS = [
  { key: "str", label: "STR" },
  { key: "con", label: "CON" },
  { key: "siz", label: "SIZ" },
  { key: "dex", label: "DEX" },
  { key: "int", label: "INT" },
  { key: "pow", label: "POW" },
] as const;

function readNumericStat(
  payload: ModuleTemplateCharacter["payload"],
  key: string
): number | null {
  const raw =
    (payload as Record<string, unknown>)[key] ??
    payload.stats?.[key] ??
    payload.stats?.[key.toUpperCase()];
  if (raw === undefined || raw === null || raw === "") return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

function extractTopSkills(
  payload: ModuleTemplateCharacter["payload"]
): Array<{ name: string; value: number }> {
  const source =
    (payload.skills && typeof payload.skills === "object"
      ? payload.skills
      : null) ||
    (payload.stats?.skills && typeof payload.stats.skills === "object"
      ? (payload.stats.skills as Record<string, unknown>)
      : null);

  if (!source) return [];

  return Object.entries(source)
    .map(([name, val]) => ({ name, value: Number(val) }))
    .filter((item) => item.name.trim() && Number.isFinite(item.value) && item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

const SceneShowcaseCard: React.FC<{
  scene: ModuleTemplateScene;
  totalScenes: number;
  currentIndex: number;
  onPrev: () => void;
  onNext: () => void;
}> = ({ scene, totalScenes, currentIndex, onPrev, onNext }) => {
  const tabletop = scene.tabletop_state;
  const tabletopScene = tabletop?.scenes?.[0] as
    | {
        map?: {
          config?: { gridSize?: number; tileSize?: number };
          tiles?: Array<{ x: number; y: number; kind: string }>;
        };
        generatedMap?: {
          config?: { gridSize?: number; tileSize?: number };
          tiles?: Array<{ x: number; y: number; kind: string }>;
        };
      }
    | undefined;
  const activeMap = tabletopScene?.map || tabletopScene?.generatedMap;
  const tiles = activeMap?.tiles || [];
  const tileSize =
    activeMap?.config?.gridSize || activeMap?.config?.tileSize || 42;
  const shapes = tabletop?.shapes || [];
  const tokens = tabletop?.tokens || [];
  const markers = scene.marker_payload || [];

  // Compute bounding box so any scene layout fits generously into 920x440
  const pointsX: number[] = [];
  const pointsY: number[] = [];

  for (const tile of tiles) {
    if (tile.kind !== "floor" && tile.kind !== "door") continue;
    pointsX.push(tile.x * tileSize, (tile.x + 1) * tileSize);
    pointsY.push(tile.y * tileSize, (tile.y + 1) * tileSize);
  }
  for (const shape of shapes) {
    if (shape.kind === "line" && shape.points && shape.points.length >= 4) {
      pointsX.push(shape.x + shape.points[0], shape.x + shape.points[2]);
      pointsY.push(shape.y + shape.points[1], shape.y + shape.points[3]);
    } else {
      pointsX.push(shape.x, shape.x + (shape.width || 40));
      pointsY.push(shape.y, shape.y + (shape.height || 40));
    }
  }
  for (const token of tokens) {
    pointsX.push(token.x - 36, token.x + 36);
    pointsY.push(token.y - 36, token.y + 46);
  }

  const W = 920;
  const H = 440;
  const hasWorldContent = pointsX.length > 0 && pointsY.length > 0;
  const minX = hasWorldContent ? Math.min(...pointsX) - 48 : 0;
  const maxX = hasWorldContent ? Math.max(...pointsX) + 48 : W;
  const minY = hasWorldContent ? Math.min(...pointsY) - 48 : 0;
  const maxY = hasWorldContent ? Math.max(...pointsY) + 48 : H;
  const spanX = Math.max(240, maxX - minX);
  const spanY = Math.max(160, maxY - minY);

  const scale = Math.min((W - 48) / spanX, (H - 48) / spanY);
  const offsetX = (W - spanX * scale) / 2 - minX * scale;
  const offsetY = (H - spanY * scale) / 2 - minY * scale;

  const projectX = (x: number) => x * scale + offsetX;
  const projectY = (y: number) => y * scale + offsetY;

  const patternId = `kp-scene-grid-${scene.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const blueprintContours = extractBlueprintContours(
    tiles as TabletopMapTile[],
    tileSize,
    true
  );

  return (
    <div className="overflow-hidden rounded-xl border border-[#9396f7]/25 bg-[#242a38] shadow-md flex flex-col">
      <div className="relative w-full aspect-[16/8.2] min-h-[260px] sm:min-h-[340px] overflow-hidden border-b border-white/10 bg-[#242a38]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="relative h-full w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <pattern
              id={patternId}
              width="56"
              height="56"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 56 0 L 0 0 0 56"
                fill="none"
                stroke="rgba(176,188,204,0.065)"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width={W} height={H} fill={`url(#${patternId})`} />

          {/* Clean blueprint contours from legacy tile maps */}
          {blueprintContours.rooms.map((room) => {
            const rw = Math.max(14, room.width * scale);
            const rh = Math.max(14, room.height * scale);
            return (
              <rect
                key={room.id}
                x={projectX(room.x)}
                y={projectY(room.y)}
                width={rw}
                height={rh}
                rx={Math.min(22, Math.min(rw, rh) * 0.22)}
                fill="rgba(147,150,247,0.04)"
                stroke="rgba(147,150,247,0.52)"
                strokeWidth="1.6"
              />
            );
          })}
          {blueprintContours.irregularEdges.map((edge) => (
            <line
              key={edge.id}
              x1={projectX(edge.points[0])}
              y1={projectY(edge.points[1])}
              x2={projectX(edge.points[2])}
              y2={projectY(edge.points[3])}
              stroke="rgba(147,150,247,0.5)"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          ))}

          {/* Vector blueprint spaces & labels */}
          {shapes.map((shape) => {
            if (shape.kind === "line") {
              const pts = shape.points || [0, 0, shape.width || 60, shape.height || 0];
              const x1 = shape.x + (pts[0] ?? 0);
              const y1 = shape.y + (pts[1] ?? 0);
              const x2 = shape.x + (pts[2] ?? shape.width ?? 60);
              const y2 = shape.y + (pts[3] ?? shape.height ?? 0);
              const { cx, cy } = getLineCurveControlPoint(
                x1,
                y1,
                x2,
                y2,
                shape.curvature ?? 0
              );
              const pathD = `M ${projectX(x1)} ${projectY(y1)} Q ${projectX(cx)} ${projectY(cy)} ${projectX(x2)} ${projectY(y2)}`;
              return (
                <path
                  key={shape.id}
                  d={pathD}
                  fill="none"
                  stroke="rgba(147,150,247,0.62)"
                  strokeWidth="1.8"
                  strokeDasharray={shape.dashed ? "6 4" : undefined}
                  strokeLinecap="round"
                />
              );
            }
            if (shape.kind === "circle") {
              const rx = Math.max(8, ((shape.width || 32) / 2) * scale);
              const ry = Math.max(8, ((shape.height || 32) / 2) * scale);
              return (
                <ellipse
                  key={shape.id}
                  cx={projectX(shape.x) + rx}
                  cy={projectY(shape.y) + ry}
                  rx={rx}
                  ry={ry}
                  fill="rgba(147,150,247,0.04)"
                  stroke="rgba(147,150,247,0.55)"
                  strokeDasharray={shape.dashed ? "6 4" : undefined}
                  strokeWidth="1.6"
                />
              );
            }
            if (shape.kind === "text") {
              return (
                <text
                  key={shape.id}
                  x={projectX(shape.x)}
                  y={projectY(shape.y) + 14}
                  fill="#e4e5eb"
                  fontSize="14"
                  fontWeight="600"
                >
                  {shape.text || ""}
                </text>
              );
            }
            const sw = Math.max(14, (shape.width || 40) * scale);
            const sh = Math.max(14, (shape.height || 40) * scale);
            const rx =
              shape.cornerRadius !== undefined
                ? Math.min(Math.min(sw, sh) / 2, shape.cornerRadius * scale)
                : Math.min(22, Math.min(sw, sh) * 0.22);
            return (
              <rect
                key={shape.id}
                x={projectX(shape.x)}
                y={projectY(shape.y)}
                width={sw}
                height={sh}
                rx={rx}
                fill="rgba(147,150,247,0.04)"
                stroke="rgba(147,150,247,0.52)"
                strokeDasharray={shape.dashed ? "6 4" : undefined}
                strokeWidth="1.6"
              />
            );
          })}

          {/* Tokens (pure concentric blueprint beacons) */}
          {tokens.map((token) => (
            <g key={token.id}>
              <circle
                cx={projectX(token.x)}
                cy={projectY(token.y)}
                r="24"
                fill={
                  token.isHidden
                    ? "rgba(148,163,184,0.10)"
                    : "rgba(147,150,247,0.16)"
                }
                stroke={token.isHidden ? "rgba(148,163,184,0.38)" : undefined}
                strokeDasharray={token.isHidden ? "4 3" : undefined}
                strokeWidth={token.isHidden ? "1.1" : undefined}
              />
              <circle
                cx={projectX(token.x)}
                cy={projectY(token.y)}
                r="10"
                fill={
                  token.isHidden
                    ? "rgba(148,163,184,0.24)"
                    : "rgba(147,150,247,0.34)"
                }
              />
              <circle
                cx={projectX(token.x)}
                cy={projectY(token.y)}
                r="3.4"
                fill={token.isHidden ? "#cbd5e1" : "#ffffff"}
              />
              {token.label && (
                <text
                  x={projectX(token.x)}
                  y={projectY(token.y) + 36}
                  textAnchor="middle"
                  fill="rgba(228,229,235,0.92)"
                  fontSize="12"
                  fontWeight="600"
                >
                  {token.label.slice(0, 10)}
                </text>
              )}
            </g>
          ))}

          {/* Percentage marker_payload fallback when no tabletop tokens exist */}
          {tokens.length === 0 &&
            markers.map((marker, idx) => {
              const cx = (Math.min(100, Math.max(0, marker.x)) / 100) * W;
              const cy = (Math.min(100, Math.max(0, marker.y)) / 100) * H;
              return (
                <g key={`m-${idx}`}>
                  <circle
                    cx={cx}
                    cy={cy}
                    r="22"
                    fill={
                      marker.is_hidden
                        ? "rgba(148,163,184,0.10)"
                        : "rgba(147,150,247,0.16)"
                    }
                  />
                  <circle
                    cx={cx}
                    cy={cy}
                    r="9.5"
                    fill={
                      marker.is_hidden
                        ? "rgba(148,163,184,0.24)"
                        : "rgba(147,150,247,0.34)"
                    }
                  />
                  <circle
                    cx={cx}
                    cy={cy}
                    r="3.2"
                    fill={marker.is_hidden ? "#cbd5e1" : "#ffffff"}
                  />
                  {marker.label && (
                    <text
                      x={cx}
                      y={cy + 34}
                      textAnchor="middle"
                      fill="#e4e5eb"
                      fontSize="12"
                      fontWeight="600"
                    >
                      {marker.label.slice(0, 10)}
                    </text>
                  )}
                </g>
              );
            })}

          {!hasWorldContent && markers.length === 0 && (
            <g opacity="0.65">
              <rect
                x={W / 2 - 110}
                y={H / 2 - 54}
                width="220"
                height="108"
                rx="24"
                fill="rgba(147,150,247,0.04)"
                stroke="rgba(147,150,247,0.45)"
                strokeWidth="1.5"
                strokeDasharray="6 4"
              />
              <text
                x={W / 2}
                y={H / 2 + 5}
                textAnchor="middle"
                fill="#b0bccc"
                fontSize="14"
              >
                自由探索空白蓝图场景
              </text>
            </g>
          )}
        </svg>

        {/* Left / Right Scene Switch Arrows when multiple scenes exist */}
        {totalScenes > 1 && (
          <>
            <button
              type="button"
              onClick={onPrev}
              aria-label="上一张场景"
              className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-[#1c2230]/80 text-white shadow-lg backdrop-blur-md transition-all hover:border-[#9396f7]/60 hover:bg-[#9396f7]/25"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={onNext}
              aria-label="下一张场景"
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-[#1c2230]/80 text-white shadow-lg backdrop-blur-md transition-all hover:border-[#9396f7]/60 hover:bg-[#9396f7]/25"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>

      {/* Clean Scene Footer Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-dicecho-card/80 px-4 py-3">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-white truncate">
              {scene.title}
            </span>
            {scene.is_default && (
              <span className="shrink-0 rounded bg-[#9396f7]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[#c7d2fe]">
                默认场景
              </span>
            )}
          </div>
          {scene.description && (
            <p className="text-xs leading-5 text-dicecho-muted line-clamp-2">
              {scene.description}
            </p>
          )}
        </div>

        {totalScenes > 1 && (
          <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] text-[#c7d2fe] tabular-nums">
            {currentIndex + 1} / {totalScenes}
          </span>
        )}
      </div>
    </div>
  );
};

const CharacterStatCard: React.FC<{ character: ModuleTemplateCharacter }> = ({
  character,
}) => {
  const payload = character.payload || {};
  const isMonster = character.character_type === "monster";
  const name = String(
    payload.name || payload.info?.name || character.template_character_key
  );
  const job = String(payload.job || payload.info?.job || payload.role || "");
  const notes = String(
    payload.notes ||
      payload.info?.notes ||
      payload.backstory ||
      payload.info?.backstory ||
      ""
  );
  const avatarUrl =
    typeof payload.avatar_url === "string" && payload.avatar_url.trim()
      ? payload.avatar_url
      : null;

  const hp = readNumericStat(payload, "hp");
  const san = readNumericStat(payload, "san");
  const mp = readNumericStat(payload, "mp");
  const coreStats: Array<{ key: string; label: string; value: number }> = [];
  for (const s of CORE_STAT_KEYS) {
    const val = readNumericStat(payload, s.key);
    if (val !== null) {
      coreStats.push({ key: s.key, label: s.label, value: val });
    }
  }
  const topSkills = extractTopSkills(payload);

  return (
    <div
      className={cn(
        "rounded-xl border bg-dicecho-card/75 p-4 space-y-3 shadow-sm",
        isMonster
          ? "border-rose-500/35"
          : "border-dicecho-border/55"
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border",
            isMonster
              ? "border-rose-500/45 bg-rose-500/15 text-rose-300"
              : "border-cyan-500/40 bg-cyan-500/15 text-cyan-300"
          )}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              className="h-full w-full object-cover"
            />
          ) : isMonster ? (
            <Swords size={18} />
          ) : (
            <UserCog size={18} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h6 className="truncate text-sm font-bold text-white">{name}</h6>
            <span
              className={cn(
                "shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold",
                isMonster
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                  : "bg-cyan-500/20 text-cyan-200 border border-cyan-500/30"
              )}
            >
              {isMonster ? "怪物" : "NPC"}
            </span>
          </div>
          {job && (
            <p className="mt-0.5 truncate text-xs text-dicecho-muted">{job}</p>
          )}
        </div>
      </div>

      {/* Vital Bars (HP / SAN / MP) */}
      {(hp !== null || san !== null || mp !== null) && (
        <div className="grid grid-cols-3 gap-2 rounded-lg border border-dicecho-border/40 bg-dicecho-panel/65 p-2.5 text-xs tabular-nums">
          <div>
            <div className="flex justify-between text-[10px]">
              <span className="text-rose-300 font-semibold">HP</span>
              <span className="font-mono text-white">{hp ?? "—"}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-dicecho-raised/55 overflow-hidden">
              <div
                className="h-full rounded-full bg-rose-400"
                style={{
                  width: hp !== null ? `${Math.min(100, Math.max(12, (hp / 20) * 100))}%` : "0%",
                }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[10px]">
              <span className="text-dicecho-accent font-semibold">SAN</span>
              <span className="font-mono text-white">{san ?? "—"}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-dicecho-raised/55 overflow-hidden">
              <div
                className="h-full rounded-full bg-dicecho-accent"
                style={{
                  width: san !== null ? `${Math.min(100, Math.max(10, san))}%` : "0%",
                }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[10px]">
              <span className="text-dicecho-primary font-semibold">MP</span>
              <span className="font-mono text-white">{mp ?? "—"}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-dicecho-raised/55 overflow-hidden">
              <div
                className="h-full rounded-full bg-dicecho-primary"
                style={{
                  width: mp !== null ? `${Math.min(100, Math.max(12, (mp / 20) * 100))}%` : "0%",
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 6-Attribute Mini Visual Bars */}
      {coreStats.length > 0 && (
        <div className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-[11px] font-mono tabular-nums">
          {coreStats.map((stat) => (
            <div key={stat.key} className="space-y-0.5">
              <div className="flex justify-between text-[10px]">
                <span className="text-dicecho-muted">{stat.label}</span>
                <span className="text-slate-100 font-semibold">{stat.value}</span>
              </div>
              <div className="h-1 rounded-full bg-dicecho-raised/50 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    isMonster ? "bg-rose-400/80" : "bg-dicecho-primary/85"
                  )}
                  style={{ width: `${Math.min(100, Math.max(8, stat.value))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Top Skills */}
      {topSkills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {topSkills.map((skill) => (
            <span
              key={skill.name}
              className="rounded border border-dicecho-border/55 bg-dicecho-panel/80 px-2 py-0.5 text-[10px] font-mono text-slate-200 tabular-nums"
            >
              {skill.name} <span className="text-dicecho-primary">{skill.value}</span>
            </span>
          ))}
        </div>
      )}

      {/* Concise Notes */}
      {notes && (
        <p className="border-t border-dicecho-border/40 pt-2 text-xs leading-5 text-dicecho-muted whitespace-pre-wrap line-clamp-3">
          {notes}
        </p>
      )}
    </div>
  );
};

export const ModuleKeeperBriefing: React.FC<ModuleKeeperBriefingProps> = ({
  template,
}) => {
  const scenes = template.module_template_scenes || [];
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);

  useEffect(() => {
    setActiveSceneIndex(0);
  }, [template.id]);

  const safeSceneIndex =
    scenes.length > 0 ? Math.min(activeSceneIndex, scenes.length - 1) : 0;
  const activeScene = scenes[safeSceneIndex] || null;
  const handlePrevScene = () => {
    if (scenes.length <= 1) return;
    setActiveSceneIndex((prev) => (prev - 1 + scenes.length) % scenes.length);
  };
  const handleNextScene = () => {
    if (scenes.length <= 1) return;
    setActiveSceneIndex((prev) => (prev + 1) % scenes.length);
  };
  const rosterCharacters = (template.module_template_characters || []).filter(
    (character) => character.character_type !== "investigator"
  );
  const npcCount = rosterCharacters.filter(
    (c) => c.character_type !== "monster"
  ).length;
  const monsterCount = rosterCharacters.filter(
    (c) => c.character_type === "monster"
  ).length;

  const keeperBlocks = (template.keeper_notes || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const isHeadingLine = (line: string) =>
    line.length <= 28 &&
    (/^(#{1,3}\s+|【.+】|\[.+\]|[一二三四五六七八九十]+[、.．]|\d+[、.．]\s*)/.test(
      line
    ) ||
      /[：:]$/.test(line));

  return (
    <div className="space-y-7 pt-2">
      {/* 1. At-a-Glance Visual Summary Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-dicecho-border/50 bg-dicecho-card/75 px-3.5 py-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-dicecho-muted">
            <MapIcon size={13} className="text-dicecho-primary" />
            预设场景
          </div>
          <div className="mt-1.5 text-lg font-bold font-mono text-white tabular-nums leading-none">
            {scenes.length} <span className="text-xs font-normal text-dicecho-muted">张</span>
          </div>
        </div>
        <div className="rounded-xl border border-dicecho-border/50 bg-dicecho-card/75 px-3.5 py-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-dicecho-muted">
            <UserCog size={13} className="text-cyan-300" />
            NPC 档案
          </div>
          <div className="mt-1.5 text-lg font-bold font-mono text-white tabular-nums leading-none">
            {npcCount} <span className="text-xs font-normal text-dicecho-muted">名</span>
          </div>
        </div>
        <div className="rounded-xl border border-dicecho-border/50 bg-dicecho-card/75 px-3.5 py-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-dicecho-muted">
            <Swords size={13} className="text-rose-300" />
            怪物 / 敌对
          </div>
          <div className="mt-1.5 text-lg font-bold font-mono text-white tabular-nums leading-none">
            {monsterCount} <span className="text-xs font-normal text-dicecho-muted">种</span>
          </div>
        </div>
        <div className="rounded-xl border border-dicecho-border/50 bg-dicecho-card/75 px-3.5 py-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-dicecho-muted">
            {template.default_room_type === "voice" ? (
              <Mic size={13} className="text-dicecho-accent" />
            ) : (
              <MessageSquare size={13} className="text-dicecho-primary" />
            )}
            推荐形式
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-sm font-bold text-white leading-none">
            <span>{template.default_room_type === "voice" ? "语音团" : "文字团"}</span>
            {template.bg_music_url && (
              <span
                title="已配置预设 BGM"
                className="inline-flex items-center gap-0.5 rounded bg-dicecho-primary/20 px-1.5 py-0.5 text-[10px] text-dicecho-primary"
              >
                <Music size={10} />
                BGM
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Scene Map Previews First */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <h5 className="flex items-center gap-2 text-sm font-bold text-white shrink-0">
            <span className="font-mono text-xs text-dicecho-primary">01</span>
            <MapIcon size={15} className="text-dicecho-primary" />
            场景图示总览
          </h5>
          <div className="h-px flex-1 bg-dicecho-border/40" />
          <span className="text-[11px] text-dicecho-muted shrink-0">
            {scenes.length > 0 ? "开房自动载入战术桌布" : "未配置场景"}
          </span>
        </div>
        {activeScene ? (
          <div className="space-y-2.5">
            <SceneShowcaseCard
              scene={activeScene}
              totalScenes={scenes.length}
              currentIndex={safeSceneIndex}
              onPrev={handlePrevScene}
              onNext={handleNextScene}
            />
            {scenes.length > 1 && (
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {scenes.map((scene, index) => (
                  <button
                    key={scene.id}
                    type="button"
                    onClick={() => setActiveSceneIndex(index)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                      index === safeSceneIndex
                        ? "border-[#9396f7]/60 bg-[#9396f7]/18 text-white"
                        : "border-dicecho-border/45 bg-dicecho-card/60 text-dicecho-muted hover:text-white"
                    )}
                  >
                    {scene.title || `场景 ${index + 1}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-dicecho-border/45 bg-dicecho-card/40 px-4 py-6 text-center text-xs text-dicecho-muted">
            这个模组暂未配置预设场景图，开房后可在跑团工作台自由绘制。
          </div>
        )}
      </section>

      {/* 3. NPC / Monster Stat Cards Second */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <h5 className="flex items-center gap-2 text-sm font-bold text-white shrink-0">
            <span className="font-mono text-xs text-cyan-300">02</span>
            <Users size={15} className="text-cyan-300" />
            NPC 与怪物属性卡
          </h5>
          <div className="h-px flex-1 bg-dicecho-border/40" />
          <span className="text-[11px] text-dicecho-muted shrink-0">
            {rosterCharacters.length > 0
              ? "开房自动导入 KP 面板"
              : "未配置角色"}
          </span>
        </div>
        {rosterCharacters.length > 0 ? (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            {rosterCharacters.map((character) => (
              <CharacterStatCard key={character.id} character={character} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-dicecho-border/45 bg-dicecho-card/40 px-4 py-6 text-center text-xs text-dicecho-muted">
            这个模组暂未配置 NPC 或怪物属性卡。
          </div>
        )}
      </section>

      {/* 4. Detailed Keeper Background & Notes Last */}
      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <h5 className="flex items-center gap-2 text-sm font-bold text-amber-200 shrink-0">
            <span className="font-mono text-xs text-amber-300">03</span>
            <FileText size={15} className="text-amber-300" />
            详细背景与 KP 带团笔记
          </h5>
          <div className="h-px flex-1 bg-amber-500/20" />
          <span className="inline-flex items-center gap-1 text-[11px] text-amber-300/80 shrink-0">
            <Shield size={11} />
            剧透区域
          </span>
        </div>
        {keeperBlocks.length > 0 ? (
          <div className="rounded-xl border border-amber-500/25 bg-dicecho-panel/80 p-5 md:p-6 space-y-3 shadow-inner">
            {keeperBlocks.map((line, index) =>
              isHeadingLine(line) ? (
                <h6
                  key={index}
                  className={cn(
                    "text-sm font-bold text-amber-200 tracking-wide",
                    index > 0 && "pt-3 border-t border-amber-500/15"
                  )}
                >
                  {line.replace(/^#{1,3}\s+/, "")}
                </h6>
              ) : (
                <p
                  key={index}
                  className="whitespace-pre-wrap text-[14px] leading-[1.85] text-slate-200/95"
                >
                  {line}
                </p>
              )
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-amber-500/25 bg-amber-500/[0.04] px-4 py-6 text-center text-xs text-amber-200/70">
            这个模板暂未填写详细 KP 背景笔记。
          </div>
        )}
      </section>
    </div>
  );
};
