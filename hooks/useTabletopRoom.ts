import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { IndexeddbPersistence, clearDocument } from "y-indexeddb";
import { supabase } from "../supabase";
import type {
  Character,
  FogRegion,
  RoomScene,
  RoomSceneMarker,
  TabletopDocumentScope,
  TabletopMapTile,
  TabletopShape,
  TabletopState,
  TabletopToken,
} from "../types";
import {
  applyRevealedRect,
  canMoveTabletopToken,
  clampTabletopCoordinate,
  createEmptyTabletopState,
  createInitialTabletopScene,
  createTabletopShape,
  createTokenFromCharacter,
  generateTabletopMap,
  getActiveTabletopScene,
  getDefaultTokenPositionForScene,
  importLegacySceneState,
  mergeTabletopTokensFromBootstrap,
  normalizeTabletopState,
  projectTabletopStateForViewer,
  removeTabletopShapeLocally,
  upsertTabletopShapeLocally,
  updateTabletopMapTileLocally,
  removeTabletopSceneLocally,
  removeTabletopTokenLocally,
  upsertTabletopTokenLocally,
} from "../services/tabletopModel";
import {
  applyTabletopUpdateBase64,
  createTabletopDoc,
  encodeTabletopDoc,
  encodeTabletopUpdate,
  getTabletopDocState,
  restoreTabletopDoc,
  setTabletopDocState,
} from "../services/tabletopYjs";
import {
  deleteTabletopToken,
  fetchTabletopBootstrap,
  getTabletopRealtimeConnection,
  isMissingTabletopBatchPersistError,
  mapTabletopTokenRow,
  moveTabletopToken,
  persistTabletopUpdateBatch,
  persistTabletopUpdate,
  setActiveTabletopScene,
  SupabaseYBridge,
  upsertTabletopToken,
} from "../services/tabletopSupabase";
import { fetchRoomSceneMarkers, fetchRoomScenes } from "../services/roomScenes";

type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "local"
  | "error";

interface UseTabletopRoomInput {
  roomId: string;
  isKeeper: boolean;
  currentUserId: string;
  characters: Character[];
}

export interface UseTabletopRoomResult {
  state: TabletopState;
  activeScene: ReturnType<typeof getActiveTabletopScene>;
  scope: TabletopDocumentScope;
  connectionStatus: ConnectionStatus;
  connectionDetail: string | null;
  isLoading: boolean;
  selectedTokenId: string | null;
  setSelectedTokenId: (tokenId: string | null) => void;
  canMoveToken: (token: TabletopToken) => boolean;
  createScene: () => Promise<void>;
  deleteActiveScene: () => Promise<void>;
  regenerateActiveMap: () => Promise<void>;
  setActiveScene: (sceneId: string) => Promise<void>;
  renameActiveScene: (title: string) => Promise<void>;
  addToken: (characterId: string) => Promise<void>;
  createShape: (shape: {
    kind: TabletopShape["kind"];
    x: number;
    y: number;
    width: number;
    height: number;
    text?: string;
  }) => Promise<void>;
  updateShape: (shape: TabletopShape) => Promise<void>;
  deleteShape: (shapeId: string) => Promise<void>;
  updateMapTile: (tile: Pick<TabletopMapTile, "x" | "y" | "kind">) => Promise<void>;
  moveToken: (token: TabletopToken, position: { x: number; y: number }) => Promise<void>;
  toggleTokenHidden: (token: TabletopToken) => Promise<void>;
  toggleTokenLocked: (token: TabletopToken) => Promise<void>;
  deleteToken: (tokenId: string) => Promise<void>;
  revealRect: (rect: { x: number; y: number; width: number; height: number }) => Promise<void>;
  hideRect: (rect: { x: number; y: number; width: number; height: number }) => Promise<void>;
  refresh: () => Promise<void>;
}

function createClientId() {
  return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
}

function getErrorMessage(error: unknown, fallback: string) {
  const maybeError = error as { message?: string } | null;
  return maybeError?.message ? `${fallback}: ${maybeError.message}` : fallback;
}

function isTokenNotFoundError(error: unknown) {
  const maybeError = error as { message?: string } | null;
  return /Token not found/i.test(maybeError?.message || "");
}

function getTabletopPersistenceName(roomId: string, scope: TabletopDocumentScope) {
  return `tabletop:${roomId}:${scope}`;
}

function getConnectionDetail(error: unknown) {
  const maybeError = error as {
    code?: string;
    details?: string;
    hint?: string;
    message?: string;
    status?: number;
  } | null;
  const message = [
    maybeError?.code,
    maybeError?.message,
    maybeError?.details,
    maybeError?.hint,
  ]
    .filter(Boolean)
    .join(" ");

  if (maybeError?.status === 401 || /unauthorized/i.test(message)) {
    return "未登录或登录已过期，请重新登录后从房间链接进入。";
  }
  if (/PGRST202|schema cache|Could not find the function/i.test(message)) {
    return "桌面同步 RPC 未部署或 Supabase schema cache 未刷新。";
  }
  if (/Not allowed to load tabletop state/i.test(message)) {
    return "当前账号不是这个房间的有效成员，或没有访问该桌面的权限。";
  }
  if (/Failed to fetch/i.test(message)) {
    return "浏览器无法连接 Supabase，请检查网络、环境变量或浏览器拦截。";
  }

  return maybeError?.message
    ? `联机初始化失败：${maybeError.message}`
    : "联机初始化失败，已临时切换到本地模式。";
}

export function useTabletopRoom({
  roomId,
  isKeeper,
  currentUserId,
  characters,
}: UseTabletopRoomInput): UseTabletopRoomResult {
  const scope: TabletopDocumentScope = isKeeper ? "keeper" : "public";
  const [doc, setDoc] = useState(() => createTabletopDoc(createEmptyTabletopState(roomId)));
  const [state, setState] = useState<TabletopState>(() =>
    createEmptyTabletopState(roomId)
  );
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("idle");
  const [connectionDetail, setConnectionDetail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const clientIdRef = useRef(createClientId());
  const bridgeRef = useRef<SupabaseYBridge | null>(null);
  const publicBridgeRef = useRef<SupabaseYBridge | null>(null);
  const persistTimerRef = useRef<number | null>(null);
  const latestPersistUpdateRef = useRef("");
  const suppressPersistRef = useRef(false);
  const backendAvailableRef = useRef(true);
  const batchPersistAvailableRef = useRef(true);
  const [backendAvailable, setBackendAvailable] = useState(true);
  const indexedPersistenceRef = useRef<IndexeddbPersistence | null>(null);

  const charactersById = useMemo(
    () => new Map(characters.map((character) => [character.id, character])),
    [characters]
  );

  const flushPersistedDoc = useCallback(
    async (targetDoc: Y.Doc, updateBase64 = "") => {
      if (!isKeeper || !backendAvailableRef.current) return;
      const keeperState = getTabletopDocState(targetDoc, roomId);
      const keeperSnapshotBase64 = encodeTabletopDoc(targetDoc);
      const publicState = projectTabletopStateForViewer({
        state: keeperState,
        isKeeper: false,
      });
      const publicDoc = createTabletopDoc(publicState);
      const snapshotBase64 = encodeTabletopDoc(publicDoc);

      if (batchPersistAvailableRef.current) {
        const { error } = await persistTabletopUpdateBatch({
          roomId,
          clientId: clientIdRef.current,
          updates: [
            {
              scope: "keeper",
              updateBase64: updateBase64 || keeperSnapshotBase64,
              snapshotBase64: keeperSnapshotBase64,
              state: keeperState,
            },
            {
              scope: "public",
              updateBase64: snapshotBase64,
              snapshotBase64,
              state: publicState,
            },
          ],
        });

        if (!error) {
          publicBridgeRef.current?.sendUpdate(snapshotBase64, publicState);
          return;
        }

        if (!isMissingTabletopBatchPersistError(error)) {
          throw error;
        }

        batchPersistAvailableRef.current = false;
      }

      await persistTabletopUpdate({
        roomId,
        scope: "keeper",
        clientId: clientIdRef.current,
        updateBase64: updateBase64 || keeperSnapshotBase64,
        snapshotBase64: keeperSnapshotBase64,
        state: keeperState,
      });

      await persistTabletopUpdate({
        roomId,
        scope: "public",
        clientId: clientIdRef.current,
        updateBase64: snapshotBase64,
        snapshotBase64,
        state: publicState,
      });
      publicBridgeRef.current?.sendUpdate(snapshotBase64, publicState);
    },
    [isKeeper, roomId]
  );

  const schedulePersistedDoc = useCallback(
    (targetDoc: Y.Doc, updateBase64 = "") => {
      if (!isKeeper || !backendAvailableRef.current) return;
      latestPersistUpdateRef.current = updateBase64 || latestPersistUpdateRef.current;
      if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = window.setTimeout(() => {
        persistTimerRef.current = null;
        const pendingUpdate = latestPersistUpdateRef.current;
        latestPersistUpdateRef.current = "";
        void flushPersistedDoc(targetDoc, pendingUpdate).catch((error) => {
          console.error(error);
          setConnectionDetail(getConnectionDetail(error));
          setConnectionStatus("error");
        });
      }, 1200);
    },
    [flushPersistedDoc, isKeeper]
  );

  const applyState = useCallback(
    async (updater: (current: TabletopState) => TabletopState) => {
      const current = getTabletopDocState(doc, roomId);
      const next = normalizeTabletopState(updater(current));
      setTabletopDocState(doc, next);
      setState(isKeeper ? next : projectTabletopStateForViewer({ state: next, isKeeper }));
      schedulePersistedDoc(doc);
    },
    [doc, isKeeper, roomId, schedulePersistedDoc]
  );

  const loadBootstrap = useCallback(async () => {
    setIsLoading(true);
    setConnectionStatus("connecting");
    setConnectionDetail(null);
    backendAvailableRef.current = true;
    setBackendAvailable(true);
    suppressPersistRef.current = true;
    try {
      const { data, error } = await fetchTabletopBootstrap({ roomId, scope });
      if (error) throw error;
      const hasRemoteDocument = Boolean(
        data?.snapshot_base64 || data?.state_json
      );
      const persistenceName = getTabletopPersistenceName(roomId, scope);

      let nextDoc = restoreTabletopDoc({
        roomId,
        snapshotBase64: data?.snapshot_base64,
        state: data?.state_json || null,
      });

      for (const update of data?.updates || []) {
        applyTabletopUpdateBase64(nextDoc, update.update_base64);
      }

      let nextState = getTabletopDocState(nextDoc, roomId);
      if (nextState.scenes.length === 0 && isKeeper) {
        const [{ data: legacyScenes }, { data: legacyMarkers }] = await Promise.all([
          fetchRoomScenes(roomId),
          fetchRoomSceneMarkers(roomId),
        ]);
        nextState = importLegacySceneState({
          roomId,
          scenes: (legacyScenes || []) as RoomScene[],
          markers: (legacyMarkers || []) as RoomSceneMarker[],
        });
        setTabletopDocState(nextDoc, nextState);
      }
      nextState = mergeTabletopTokensFromBootstrap(
        nextState,
        data?.tokens || []
      );
      setTabletopDocState(nextDoc, nextState);
      if (nextState.scenes.length === 0) {
        const fallback = createInitialTabletopScene("调查现场");
        nextState = normalizeTabletopState({
          ...createEmptyTabletopState(roomId),
          scenes: [fallback],
          activeSceneId: fallback.id,
        });
        setTabletopDocState(nextDoc, nextState);
      }

      indexedPersistenceRef.current?.destroy();
      if (hasRemoteDocument) {
        await clearDocument(persistenceName);
      }
      indexedPersistenceRef.current = new IndexeddbPersistence(
        persistenceName,
        nextDoc
      );

      setDoc(nextDoc);
      setState(
        isKeeper
          ? nextState
          : projectTabletopStateForViewer({ state: nextState, isKeeper })
      );
      setConnectionStatus("connected");
      setConnectionDetail(null);

      if (isKeeper) {
        await flushPersistedDoc(nextDoc);
      }
    } catch (error) {
      console.error(error);
      setConnectionDetail(getConnectionDetail(error));
      backendAvailableRef.current = false;
      setBackendAvailable(false);
      try {
        const [{ data: legacyScenes }, { data: legacyMarkers }] = await Promise.all([
          fetchRoomScenes(roomId),
          fetchRoomSceneMarkers(roomId),
        ]);
        let fallbackState = importLegacySceneState({
          roomId,
          scenes: (legacyScenes || []) as RoomScene[],
          markers: (legacyMarkers || []) as RoomSceneMarker[],
        });
        if (fallbackState.scenes.length === 0) {
          const fallback = createInitialTabletopScene("调查现场");
          fallbackState = normalizeTabletopState({
            ...createEmptyTabletopState(roomId),
            scenes: [fallback],
            activeSceneId: fallback.id,
          });
        }
        const fallbackDoc = createTabletopDoc(fallbackState);
        const persistenceName = getTabletopPersistenceName(roomId, scope);
        indexedPersistenceRef.current?.destroy();
        indexedPersistenceRef.current = new IndexeddbPersistence(
          persistenceName,
          fallbackDoc
        );
        setDoc(fallbackDoc);
        setState(
          isKeeper
            ? fallbackState
            : projectTabletopStateForViewer({ state: fallbackState, isKeeper })
        );
      } catch (fallbackError) {
        console.error(fallbackError);
        const fallback = createInitialTabletopScene("调查现场");
        const fallbackState = normalizeTabletopState({
          ...createEmptyTabletopState(roomId),
          scenes: [fallback],
          activeSceneId: fallback.id,
        });
        const fallbackDoc = createTabletopDoc(fallbackState);
        setDoc(fallbackDoc);
        setState(
          isKeeper
            ? fallbackState
            : projectTabletopStateForViewer({ state: fallbackState, isKeeper })
        );
      }
      setConnectionStatus("local");
    } finally {
      suppressPersistRef.current = false;
      setIsLoading(false);
    }
  }, [flushPersistedDoc, isKeeper, roomId, scope]);

  useEffect(() => {
    void loadBootstrap();
    return () => {
      indexedPersistenceRef.current?.destroy();
      indexedPersistenceRef.current = null;
    };
  }, [loadBootstrap]);

  useEffect(() => {
    const handleDocUpdate = (update: Uint8Array, origin: unknown) => {
      const next = getTabletopDocState(doc, roomId);
      setState(isKeeper ? next : projectTabletopStateForViewer({ state: next, isKeeper }));
      if (origin === "remote" || suppressPersistRef.current) return;
      const updateBase64 = encodeTabletopUpdate(update);
      bridgeRef.current?.sendUpdate(updateBase64);
      if (!isKeeper) return;
      schedulePersistedDoc(doc, updateBase64);
    };

    doc.on("update", handleDocUpdate);
    return () => {
      doc.off("update", handleDocUpdate);
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      latestPersistUpdateRef.current = "";
    };
  }, [doc, isKeeper, roomId, schedulePersistedDoc]);

  useEffect(() => {
    if (!backendAvailable) return;
    const bridge = new SupabaseYBridge({
      roomId,
      scope,
      clientId: clientIdRef.current,
      onRemoteUpdate: (payload) => {
        if (payload.roomId !== roomId || payload.scope !== scope) return;
        if (payload.state) {
          setTabletopDocState(doc, payload.state);
          return;
        }
        applyTabletopUpdateBase64(doc, payload.updateBase64);
      },
      onTokenCommit: (payload) => {
        if (payload.roomId !== roomId) return;
        setTabletopDocState(
          doc,
          upsertTabletopTokenLocally(getTabletopDocState(doc, roomId), payload.token)
        );
      },
      onStatusChange: (status, error) => {
        if (!backendAvailableRef.current) return;
        const nextConnection = getTabletopRealtimeConnection({ status, error });
        setConnectionStatus(nextConnection.status);
        setConnectionDetail(nextConnection.detail);
      },
    });
    bridge.connect();
    bridgeRef.current = bridge;

    if (isKeeper) {
      const publicBridge = new SupabaseYBridge({
        roomId,
        scope: "public",
        clientId: clientIdRef.current,
        onRemoteUpdate: () => undefined,
        onTokenCommit: () => undefined,
      });
      publicBridge.connect();
      publicBridgeRef.current = publicBridge;
    }

    return () => {
      bridge.disconnect();
      bridgeRef.current = null;
      publicBridgeRef.current?.disconnect();
      publicBridgeRef.current = null;
    };
  }, [backendAvailable, doc, isKeeper, roomId, scope]);

  useEffect(() => {
    if (!backendAvailable) return;
    const channel = supabase
      .channel(`tabletop-tokens:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_tabletop_tokens",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldToken = payload.old as { id?: string };
            setTabletopDocState(
              doc,
              removeTabletopTokenLocally(
                getTabletopDocState(doc, roomId),
                oldToken.id || ""
              )
            );
            return;
          }
          const token = mapTabletopTokenRow(payload.new);
          if (!token) return;
          setTabletopDocState(
            doc,
            upsertTabletopTokenLocally(getTabletopDocState(doc, roomId), token)
          );
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [backendAvailable, doc, roomId]);

  const activeScene = useMemo(() => getActiveTabletopScene(state), [state]);

  const canMoveToken = useCallback(
    (token: TabletopToken) =>
      canMoveTabletopToken({
        token,
        character: charactersById.get(token.characterId),
        isKeeper,
        currentUserId,
      }),
    [charactersById, currentUserId, isKeeper]
  );

  const createScene = useCallback(async () => {
    if (!isKeeper) return;
    await applyState((current) => {
      const scene = createInitialTabletopScene(`场景 ${current.scenes.length + 1}`);
      return {
        ...current,
        scenes: [...current.scenes, scene],
        activeSceneId: scene.id,
        updatedAt: new Date().toISOString(),
      };
    });
  }, [applyState, isKeeper]);

  const deleteActiveScene = useCallback(async () => {
    if (!isKeeper || !activeScene || state.scenes.length <= 1) return;
    if (backendAvailableRef.current) {
      const sceneTokens = state.tokens.filter(
        (token) => token.sceneId === activeScene.id
      );
      const results = await Promise.all(
        sceneTokens.map((token) => deleteTabletopToken(token.id))
      );
      const failed = results.find(
        (result) => result.error && !isTokenNotFoundError(result.error)
      );
      if (failed?.error) {
        alert(getErrorMessage(failed.error, "删除场景点位失败"));
        return;
      }
    }
    await applyState((current) =>
      removeTabletopSceneLocally(current, activeScene.id)
    );
    setSelectedTokenId(null);
  }, [activeScene, applyState, isKeeper, state.scenes.length, state.tokens]);

  const regenerateActiveMap = useCallback(async () => {
    if (!isKeeper || !activeScene) return;
    await applyState((current) => ({
      ...current,
      scenes: current.scenes.map((scene) =>
        scene.id === activeScene.id
          ? {
              ...scene,
              map: generateTabletopMap({
                ...scene.map.config,
                seed: `${scene.id}-${Date.now()}`,
              }),
              updatedAt: new Date().toISOString(),
            }
          : scene
      ),
      updatedAt: new Date().toISOString(),
    }));
  }, [activeScene, applyState, isKeeper]);

  const setActiveScene = useCallback(
    async (sceneId: string) => {
      if (!isKeeper) return;
      await applyState((current) => ({
        ...current,
        activeSceneId: sceneId,
        updatedAt: new Date().toISOString(),
      }));
      if (!backendAvailableRef.current) return;
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      const pendingUpdate = latestPersistUpdateRef.current;
      latestPersistUpdateRef.current = "";
      await flushPersistedDoc(doc, pendingUpdate);
      await setActiveTabletopScene({
        roomId,
        sceneId,
        state: getTabletopDocState(doc, roomId),
        snapshotBase64: encodeTabletopDoc(doc),
      });
    },
    [applyState, doc, flushPersistedDoc, isKeeper, roomId]
  );

  const renameActiveScene = useCallback(
    async (title: string) => {
      const safeTitle = title.trim().slice(0, 80);
      if (!isKeeper || !activeScene || !safeTitle) return;
      await applyState((current) => ({
        ...current,
        scenes: current.scenes.map((scene) =>
          scene.id === activeScene.id
            ? {
                ...scene,
                title: safeTitle,
                updatedAt: new Date().toISOString(),
              }
            : scene
        ),
        updatedAt: new Date().toISOString(),
      }));
    },
    [activeScene, applyState, isKeeper]
  );

  const addToken = useCallback(
    async (characterId: string) => {
      if (!isKeeper || !activeScene) return;
      const character = charactersById.get(characterId);
      if (!character) return;
      const position = getDefaultTokenPositionForScene(activeScene);
      const token = createTokenFromCharacter({
        roomId,
        sceneId: activeScene.id,
        character,
        x: position.x,
        y: position.y,
      });
      if (!backendAvailableRef.current) {
        await applyState((current) => upsertTabletopTokenLocally(current, token));
        return;
      }
      const { data, error } = await upsertTabletopToken(token);
      if (error) {
        alert(getErrorMessage(error, "添加 Token 失败"));
        return;
      }
      const nextToken = mapTabletopTokenRow(data) || token;
      await applyState((current) => upsertTabletopTokenLocally(current, nextToken));
    },
    [activeScene, applyState, charactersById, isKeeper, roomId]
  );

  const createShape = useCallback(
    async (shape: {
      kind: TabletopShape["kind"];
      x: number;
      y: number;
      width: number;
      height: number;
      text?: string;
    }) => {
      if (!isKeeper || !activeScene) return;
      const nextShape = createTabletopShape({
        sceneId: activeScene.id,
        ...shape,
      });
      await applyState((current) =>
        upsertTabletopShapeLocally(current, nextShape)
      );
    },
    [activeScene, applyState, isKeeper]
  );

  const updateShape = useCallback(
    async (shape: TabletopShape) => {
      if (!isKeeper || !activeScene || shape.sceneId !== activeScene.id) return;
      await applyState((current) =>
        upsertTabletopShapeLocally(current, {
          ...shape,
          x: clampTabletopCoordinate(shape.x),
          y: clampTabletopCoordinate(shape.y),
          width: clampTabletopCoordinate(shape.width, 1),
          height: clampTabletopCoordinate(shape.height, 1),
          updatedAt: new Date().toISOString(),
        })
      );
    },
    [activeScene, applyState, isKeeper]
  );

  const deleteShape = useCallback(
    async (shapeId: string) => {
      if (!isKeeper) return;
      await applyState((current) => removeTabletopShapeLocally(current, shapeId));
    },
    [applyState, isKeeper]
  );

  const updateMapTile = useCallback(
    async (tile: Pick<TabletopMapTile, "x" | "y" | "kind">) => {
      if (!isKeeper || !activeScene) return;
      await applyState((current) =>
        updateTabletopMapTileLocally(current, activeScene.id, tile)
      );
    },
    [activeScene, applyState, isKeeper]
  );

  const moveToken = useCallback(
    async (token: TabletopToken, position: { x: number; y: number }) => {
      if (!canMoveToken(token)) return;
      if (!backendAvailableRef.current) {
        await applyState((current) =>
          upsertTabletopTokenLocally(current, {
            ...token,
            ...position,
            updatedAt: new Date().toISOString(),
          })
        );
        return;
      }
      const { data, error } = await moveTabletopToken({
        tokenId: token.id,
        x: position.x,
        y: position.y,
      });
      if (error) {
        alert(getErrorMessage(error, "移动 Token 失败"));
        await loadBootstrap();
        return;
      }
      const nextToken =
        mapTabletopTokenRow(data) ||
        ({ ...token, ...position, updatedAt: new Date().toISOString() } satisfies TabletopToken);
      await applyState((current) => upsertTabletopTokenLocally(current, nextToken));
    },
    [applyState, canMoveToken, loadBootstrap]
  );

  const updateTokenFlags = useCallback(
    async (token: TabletopToken, patch: Partial<TabletopToken>) => {
      if (!isKeeper) return;
      const nextToken = { ...token, ...patch, updatedAt: new Date().toISOString() };
      if (!backendAvailableRef.current) {
        await applyState((current) => upsertTabletopTokenLocally(current, nextToken));
        return;
      }
      const { data, error } = await upsertTabletopToken(nextToken);
      if (error) {
        alert(getErrorMessage(error, "更新 Token 失败"));
        return;
      }
      const savedToken = mapTabletopTokenRow(data) || nextToken;
      await applyState((current) => upsertTabletopTokenLocally(current, savedToken));
    },
    [applyState, isKeeper]
  );

  const toggleTokenHidden = useCallback(
    (token: TabletopToken) => updateTokenFlags(token, { isHidden: !token.isHidden }),
    [updateTokenFlags]
  );

  const toggleTokenLocked = useCallback(
    (token: TabletopToken) => updateTokenFlags(token, { isLocked: !token.isLocked }),
    [updateTokenFlags]
  );

  const removeToken = useCallback(
    async (tokenId: string) => {
      if (!isKeeper) return;
      if (!backendAvailableRef.current) {
        await applyState((current) => removeTabletopTokenLocally(current, tokenId));
        setSelectedTokenId((previous) => (previous === tokenId ? null : previous));
        return;
      }
      const { error } = await deleteTabletopToken(tokenId);
      if (error && !isTokenNotFoundError(error)) {
        alert(getErrorMessage(error, "删除 Token 失败"));
        return;
      }
      await applyState((current) => removeTabletopTokenLocally(current, tokenId));
      setSelectedTokenId((previous) => (previous === tokenId ? null : previous));
    },
    [applyState, isKeeper]
  );
  const applyFogRect = useCallback(
    async (
      rect: { x: number; y: number; width: number; height: number },
      reveal: boolean
    ) => {
      if (!isKeeper || !activeScene) return;
      await applyState((current) => {
        const region: FogRegion = {
          id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `fog-${Date.now()}`,
          sceneId: activeScene.id,
          shape: "rect",
          points: [rect.x, rect.y, rect.width, rect.height],
          mode: reveal ? "revealed" : "hidden",
        };
        return {
          ...applyRevealedRect({
            state: current,
            sceneId: activeScene.id,
            rect,
            reveal,
          }),
          fogRegions: [...current.fogRegions, region],
        };
      });
    },
    [activeScene, applyState, isKeeper]
  );

  return {
    state,
    activeScene,
    scope,
    connectionStatus,
    connectionDetail,
    isLoading,
    selectedTokenId,
    setSelectedTokenId,
    canMoveToken,
    createScene,
    deleteActiveScene,
    regenerateActiveMap,
    setActiveScene,
    renameActiveScene,
    addToken,
    createShape,
    updateShape,
    deleteShape,
    updateMapTile,
    moveToken,
    toggleTokenHidden,
    toggleTokenLocked,
    deleteToken: removeToken,
    revealRect: (rect) => applyFogRect(rect, true),
    hideRect: (rect) => applyFogRect(rect, false),
    refresh: loadBootstrap,
  };
}
