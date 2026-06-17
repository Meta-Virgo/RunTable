import {
  Circle,
  Eye,
  EyeOff,
  Map as MapIcon,
  MousePointer2,
  Square,
  Type,
} from "lucide-react";
import type { TabletopMapTile, TabletopShape } from "../../types";

export type TabletopMapBrush = TabletopMapTile["kind"];
export type TabletopTool =
  | "select"
  | TabletopShape["kind"]
  | "reveal"
  | "hide"
  | "map";

export const tabletopShapeTools: Array<{
  id: TabletopTool;
  label: string;
  icon: typeof MousePointer2;
}> = [
  { id: "select", label: "选择 / 拖动", icon: MousePointer2 },
  { id: "rect", label: "拖拽画矩形", icon: Square },
  { id: "circle", label: "拖拽画圆形", icon: Circle },
  { id: "text", label: "添加文本", icon: Type },
  { id: "reveal", label: "揭示可见范围", icon: Eye },
  { id: "hide", label: "遮蔽可见范围", icon: EyeOff },
  { id: "map", label: "编辑地图", icon: MapIcon },
];

export const tabletopMapBrushes: Array<{
  id: TabletopMapBrush;
  label: string;
  className: string;
}> = [
  { id: "floor", label: "地板", className: "bg-slate-500/70" },
  { id: "wall", label: "墙", className: "bg-slate-950/90" },
  { id: "door", label: "门", className: "bg-amber-700/80" },
  { id: "void", label: "空白", className: "bg-black" },
];
