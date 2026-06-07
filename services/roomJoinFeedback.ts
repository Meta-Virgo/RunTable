import type { RoomMembership } from "./roomAuthority";

const JOIN_FAILURE_MESSAGES: Array<[RegExp, string]> = [
  [/invalid room password/i, "房间密码不正确，请检查后重试。"],
  [/room is not joinable/i, "房间已经结束或归档，无法继续加入。"],
  [/character is required/i, "请选择一名调查员后再加入房间。"],
  [/character not found/i, "找不到所选调查员，请重新选择。"],
  [
    /character does not belong to current user/i,
    "只能使用你自己的调查员加入房间。",
  ],
  [
    /only investigator characters can join rooms/i,
    "请选择调查员角色加入房间。",
  ],
  [/room not found/i, "房间不存在或已被删除。"],
];

export function getJoinRoomFailureMessage(message?: string | null) {
  const rawMessage = message || "";
  const match = JOIN_FAILURE_MESSAGES.find(([pattern]) =>
    pattern.test(rawMessage)
  );

  return match?.[1] || `加入房间失败：${rawMessage || "请稍后重试。"}`;
}

export function getJoinRoomBlockMessage(
  membership?: RoomMembership | null
): string | null {
  if (membership?.status === "kicked") {
    return "你已被移出该房间，无法重新加入。";
  }

  return null;
}
