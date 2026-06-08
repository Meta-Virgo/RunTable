import type { RoomMembership } from "../services/roomAuthority";
import { getRestoredRoomEntry } from "../services/roomAuthority";
import {
  shouldClearRestoredRoomUrl,
  type JoinRoomSessionResult,
} from "./roomSessionModel";

type GetCurrentUser = () => Promise<{
  data: { user?: { id: string } | null };
}>;

type FetchCurrentRoomMembership = (
  roomId: string,
  userId: string
) => Promise<{ data?: RoomMembership | null }>;

export type RestoredRoomJoin = (input: {
  roomId: string;
  charId: string;
  isRestoring: true;
}) => Promise<JoinRoomSessionResult>;

export type RestoreRoomFromUrlResult =
  | { action: "noop" }
  | { action: "clear-url" }
  | { action: "restored"; result: JoinRoomSessionResult };

export async function restoreRoomSessionFromUrl(input: {
  roomId: string | null;
  adapters: {
    getCurrentUser: GetCurrentUser;
    fetchCurrentRoomMembership: FetchCurrentRoomMembership;
    joinRoomSession: RestoredRoomJoin;
  };
}): Promise<RestoreRoomFromUrlResult> {
  if (!input.roomId) return { action: "noop" };

  const {
    data: { user },
  } = await input.adapters.getCurrentUser();

  if (!user) return { action: "clear-url" };

  const { data: membership } =
    await input.adapters.fetchCurrentRoomMembership(input.roomId, user.id);
  const restoredEntry = getRestoredRoomEntry(membership);

  if (!restoredEntry) return { action: "clear-url" };

  const result = await input.adapters.joinRoomSession({
    roomId: restoredEntry.roomId,
    charId: restoredEntry.characterId,
    isRestoring: true,
  });

  if (shouldClearRestoredRoomUrl(result)) return { action: "clear-url" };
  if (!result.ok) return { action: "noop" };

  return { action: "restored", result };
}
