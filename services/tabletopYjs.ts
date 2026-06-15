import * as Y from "yjs";
import type { TabletopState } from "../types";
import { createEmptyTabletopState, normalizeTabletopState } from "./tabletopModel";

const TABLETOP_STATE_KEY = "state";
const BYTE_CHUNK = 0x8000;

function encodeBinary(binary: string) {
  if (typeof btoa === "function") return btoa(binary);
  return Buffer.from(binary, "binary").toString("base64");
}

function decodeBinary(base64: string) {
  if (typeof atob === "function") return atob(base64);
  return Buffer.from(base64, "base64").toString("binary");
}

export function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += BYTE_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(index, index + BYTE_CHUNK));
  }
  return encodeBinary(binary);
}

export function base64ToBytes(base64: string) {
  const binary = decodeBinary(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function createTabletopDoc(initialState?: TabletopState) {
  const doc = new Y.Doc();
  if (initialState) setTabletopDocState(doc, initialState);
  return doc;
}

export function getTabletopDocMap(doc: Y.Doc) {
  return doc.getMap<TabletopState>(TABLETOP_STATE_KEY);
}

export function getTabletopDocState(doc: Y.Doc, roomId: string): TabletopState {
  const state = getTabletopDocMap(doc).get(TABLETOP_STATE_KEY);
  return normalizeTabletopState(state || createEmptyTabletopState(roomId));
}

export function setTabletopDocState(doc: Y.Doc, state: TabletopState) {
  getTabletopDocMap(doc).set(TABLETOP_STATE_KEY, normalizeTabletopState(state));
}

export function encodeTabletopDoc(doc: Y.Doc) {
  return bytesToBase64(Y.encodeStateAsUpdate(doc));
}

export function applyTabletopUpdateBase64(doc: Y.Doc, updateBase64: string) {
  Y.applyUpdate(doc, base64ToBytes(updateBase64), "remote");
}

export function encodeTabletopUpdate(update: Uint8Array) {
  return bytesToBase64(update);
}

export function decodeTabletopUpdate(updateBase64: string) {
  return base64ToBytes(updateBase64);
}

export function restoreTabletopDoc(input: {
  roomId: string;
  snapshotBase64?: string | null;
  state?: TabletopState | null;
}) {
  if (input.snapshotBase64) {
    const doc = createTabletopDoc();
    Y.applyUpdate(doc, base64ToBytes(input.snapshotBase64), "bootstrap");
    return doc;
  }
  const doc = createTabletopDoc(input.state || createEmptyTabletopState(input.roomId));
  return doc;
}
