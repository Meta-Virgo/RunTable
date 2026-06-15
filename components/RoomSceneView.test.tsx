import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RoomSceneView } from "./RoomSceneView";
import type { Character, TabletopScene, TabletopState } from "../types";

vi.mock("react-konva", () => ({
  Stage: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Layer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Rect: () => null,
  Line: () => null,
  Group: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Circle: () => null,
  Text: () => null,
}));

const activeScene = {
  id: "scene-1",
  title: "旧宅大厅",
  description: null,
  map: {
    config: {
      seed: "test",
      width: 10,
      height: 10,
      gridSize: 48,
      roomCount: 2,
      corridorDensity: 0.2,
      theme: "stone",
    },
    tiles: [],
  },
  createdAt: "2026-06-14T00:00:00.000Z",
  updatedAt: "2026-06-14T00:00:00.000Z",
} satisfies TabletopScene;

const state = {
  roomId: "room-1",
  activeSceneId: activeScene.id,
  scenes: [
    activeScene,
    { ...activeScene, id: "scene-2", title: "地下室" },
  ],
  tokens: [],
  shapes: [],
  fogRegions: [],
  updatedAt: "2026-06-14T00:00:00.000Z",
} satisfies TabletopState;

const investigator = {
  id: "char-1",
  name: "林",
  role: "Investigator",
  type: "investigator",
  user_id: "player-1",
  room_id: "room-1",
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
} satisfies Character;

let connectionStatus = "connected";
let connectionDetail: string | null = null;

vi.mock("../hooks/useTabletopRoom", () => ({
  useTabletopRoom: (input: { isKeeper: boolean }) => ({
    state,
    activeScene,
    scope: input.isKeeper ? "keeper" : "public",
    connectionStatus,
    connectionDetail,
    isLoading: false,
    selectedTokenId: null,
    setSelectedTokenId: vi.fn(),
    canMoveToken: vi.fn(() => false),
    createScene: vi.fn(),
    regenerateActiveMap: vi.fn(),
    setActiveScene: vi.fn(),
    renameActiveScene: vi.fn(),
    addToken: vi.fn(),
    createShape: vi.fn(),
    updateShape: vi.fn(),
    deleteShape: vi.fn(),
    updateMapTile: vi.fn(),
    moveToken: vi.fn(),
    toggleTokenHidden: vi.fn(),
    toggleTokenLocked: vi.fn(),
    deleteToken: vi.fn(),
    revealRect: vi.fn(),
    hideRect: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("RoomSceneView tabletop workspace", () => {
  it("renders a compact keeper toolbar without the old side panel tools", () => {
    connectionStatus = "connected";
    connectionDetail = null;
    const html = renderToStaticMarkup(
      <RoomSceneView
        roomId="room-1"
        isKP
        currentUserId="keeper-1"
        characters={[investigator]}
        roomMemberItems={[]}
      />
    );

    expect(html).toContain("新场景");
    expect(html).toContain("删除当前场景");
    expect(html).toContain("调查员和 NPC 操作");
    expect(html).toContain("选择 林");
    expect(html).toContain("放入点位");
    expect(html).toContain("拖拽画矩形");
    expect(html).toContain("拖拽画圆形");
    expect(html).toContain("揭示可见范围");
    expect(html).toContain("遮蔽可见范围");
    expect(html).toContain("编辑地图");
    expect(html).toContain("修改场景名");
    expect(html).toContain("切换");
    expect(html).toContain("实时同步");
    expect(html).not.toContain("<select");
    expect(html).not.toContain("生成地图");
    expect(html).not.toContain("在线");
  });

  it("shows local mode instead of sync error when tabletop backend is unavailable", () => {
    connectionStatus = "local";
    connectionDetail = "桌面同步 RPC 未部署或 Supabase schema cache 未刷新。";
    const html = renderToStaticMarkup(
      <RoomSceneView
        roomId="room-1"
        isKP
        currentUserId="keeper-1"
        characters={[investigator]}
        roomMemberItems={[]}
      />
    );

    expect(html).toContain("本地模式");
    expect(html).toContain("桌面同步 RPC 未部署");
    expect(html).not.toContain("同步异常");
  });

  it("hides keeper-only tabletop actions from players", () => {
    connectionStatus = "connected";
    connectionDetail = null;
    const html = renderToStaticMarkup(
      <RoomSceneView
        roomId="room-1"
        isKP={false}
        currentUserId="player-1"
        characters={[investigator]}
        roomMemberItems={[]}
      />
    );

    expect(html).toContain("实时同步");
    expect(html).not.toContain("新场景");
    expect(html).not.toContain("删除当前场景");
    expect(html).not.toContain("调查员和 NPC 操作");
    expect(html).not.toContain("放入点位");
    expect(html).not.toContain("拖拽画矩形");
    expect(html).not.toContain("拖拽画圆形");
    expect(html).not.toContain("揭示可见范围");
    expect(html).not.toContain("遮蔽可见范围");
    expect(html).not.toContain("编辑地图");
    expect(html).not.toContain("修改场景名");
  });
});
