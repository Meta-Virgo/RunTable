import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import type {
  TabletopBootstrap,
  TabletopDocumentScope,
  TabletopState,
  TabletopToken,
} from "../types";

export const TABLETOP_DOC_EVENT = "tabletop-y-update";
export const TABLETOP_INPUT_EVENT = "tabletop-input";

export interface TabletopYUpdatePayload {
  roomId: string;
  scope: TabletopDocumentScope;
  clientId: number;
  updateBase64: string;
  state?: TabletopState;
  sentAt: string;
}

export interface TabletopTokenCommitPayload {
  roomId: string;
  token: TabletopToken;
  sentAt: string;
}

export interface TabletopInputPayload {
  roomId: string;
  type: "pointer" | "selection";
  userId: string;
  sceneId: string | null;
  x?: number;
  y?: number;
  label?: string;
  sentAt: string;
}

export function getTabletopDocChannelName(
  roomId: string,
  scope: TabletopDocumentScope
) {
  return `tabletop-doc:${roomId}:${scope}`;
}

export function getTabletopInputChannelName(roomId: string) {
  return `tabletop-input:${roomId}`;
}

export async function fetchTabletopBootstrap(input: {
  roomId: string;
  scope: TabletopDocumentScope;
}) {
  return supabase
    .rpc("get_room_tabletop_bootstrap", {
      p_room_id: input.roomId,
      p_scope: input.scope,
    })
    .single<TabletopBootstrap>();
}

export async function persistTabletopUpdate(input: {
  roomId: string;
  scope: TabletopDocumentScope;
  clientId: number;
  updateBase64: string;
  snapshotBase64: string;
  state: TabletopState;
}) {
  return supabase.rpc("persist_room_tabletop_update", {
    p_room_id: input.roomId,
    p_scope: input.scope,
    p_client_id: String(input.clientId),
    p_update_base64: input.updateBase64,
    p_snapshot_base64: input.snapshotBase64,
    p_state_json: input.state,
  });
}

export function isMissingTabletopBatchPersistError(error: unknown) {
  const maybeError = error as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  } | null;
  const text = [
    maybeError?.message,
    maybeError?.details,
    maybeError?.hint,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    maybeError?.code === "42883" ||
    maybeError?.code === "PGRST202" ||
    text.includes("persist_room_tabletop_update_batch")
  );
}

export async function persistTabletopUpdateBatch(input: {
  roomId: string;
  clientId: number;
  updates: Array<{
    scope: TabletopDocumentScope;
    updateBase64: string;
    snapshotBase64: string;
    state: TabletopState;
  }>;
}) {
  return supabase.rpc("persist_room_tabletop_update_batch", {
    p_room_id: input.roomId,
    p_client_id: String(input.clientId),
    p_updates: input.updates.map((update) => ({
      scope: update.scope,
      update_base64: update.updateBase64,
      snapshot_base64: update.snapshotBase64,
      state_json: update.state,
    })),
  });
}

export async function moveTabletopToken(input: {
  tokenId: string;
  x: number;
  y: number;
}) {
  return supabase.rpc("move_tabletop_token", {
    p_token_id: input.tokenId,
    p_x: input.x,
    p_y: input.y,
  });
}

export async function upsertTabletopToken(input: {
  roomId: string;
  sceneId: string;
  characterId: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
  zIndex: number;
  isHidden: boolean;
  isLocked: boolean;
  label?: string | null;
}) {
  return supabase.rpc("upsert_tabletop_token", {
    p_room_id: input.roomId,
    p_scene_id: input.sceneId,
    p_character_id: input.characterId,
    p_x: input.x,
    p_y: input.y,
    p_size: input.size,
    p_rotation: input.rotation,
    p_z_index: input.zIndex,
    p_is_hidden: input.isHidden,
    p_is_locked: input.isLocked,
    p_label: input.label || null,
  });
}

export async function deleteTabletopToken(tokenId: string) {
  return supabase.rpc("delete_tabletop_token", { p_token_id: tokenId });
}

export async function setActiveTabletopScene(input: {
  roomId: string;
  sceneId: string;
  state: TabletopState;
  snapshotBase64: string;
}) {
  return supabase.rpc("set_active_tabletop_scene", {
    p_room_id: input.roomId,
    p_scene_id: input.sceneId,
    p_state_json: input.state,
    p_snapshot_base64: input.snapshotBase64,
  });
}

export function isTabletopYUpdatePayload(input: unknown) {
  const payload = input as Partial<TabletopYUpdatePayload> | null;
  return Boolean(
    payload &&
      typeof payload.roomId === "string" &&
      (payload.scope === "keeper" || payload.scope === "public") &&
      typeof payload.clientId === "number" &&
      typeof payload.updateBase64 === "string" &&
      typeof payload.sentAt === "string"
  );
}

export function isTabletopTokenCommitPayload(input: unknown) {
  const payload = input as Partial<TabletopTokenCommitPayload> | null;
  return Boolean(
    payload &&
      typeof payload.roomId === "string" &&
      payload.token &&
      typeof payload.token.id === "string" &&
      typeof payload.sentAt === "string"
  );
}

export class SupabaseYBridge {
  private channel: RealtimeChannel | null = null;

  constructor(
    private readonly input: {
      roomId: string;
      scope: TabletopDocumentScope;
      clientId: number;
      onRemoteUpdate: (payload: TabletopYUpdatePayload) => void;
      onTokenCommit: (payload: TabletopTokenCommitPayload) => void;
      onStatusChange?: (status: string) => void;
    }
  ) {}

  connect() {
    this.disconnect();
    const channel = supabase
      .channel(getTabletopDocChannelName(this.input.roomId, this.input.scope), {
        config: { private: true, broadcast: { ack: false, self: false } },
      })
      .on("broadcast", { event: TABLETOP_DOC_EVENT }, (message) => {
        if (!isTabletopYUpdatePayload(message.payload)) return;
        if (message.payload.clientId === this.input.clientId) return;
        this.input.onRemoteUpdate(message.payload);
      })
      .subscribe((status) => {
        this.input.onStatusChange?.(status);
      });
    this.channel = channel;
  }

  disconnect() {
    if (!this.channel) return;
    void supabase.removeChannel(this.channel);
    this.channel = null;
  }

  sendUpdate(updateBase64: string, state?: TabletopState) {
    const channel = this.channel;
    if (!channel) return;
    void channel.send({
      type: "broadcast",
      event: TABLETOP_DOC_EVENT,
      payload: {
        roomId: this.input.roomId,
        scope: this.input.scope,
        clientId: this.input.clientId,
        updateBase64,
        state,
        sentAt: new Date().toISOString(),
      } satisfies TabletopYUpdatePayload,
    });
  }

}
