import { describe, expect, it } from "vitest";
import {
  getJoinRoomBlockMessage,
  getJoinRoomFailureMessage,
} from "./roomJoinFeedback";

describe("room join feedback", () => {
  it("maps backend join failures to actionable room messages", () => {
    expect(getJoinRoomFailureMessage("Invalid room password")).toBe(
      "房间密码不正确，请检查后重试。"
    );
    expect(getJoinRoomFailureMessage("Room is not joinable")).toBe(
      "房间已经结束或归档，无法继续加入。"
    );
    expect(getJoinRoomFailureMessage("Character is required")).toBe(
      "请选择一名调查员后再加入房间。"
    );
  });

  it("blocks kicked memberships before retrying the join rpc", () => {
    expect(
      getJoinRoomBlockMessage({
        room_id: "room-1",
        user_id: "player-1",
        character_id: "char-1",
        role: "player",
        status: "kicked",
      })
    ).toBe("你已被移出该房间，无法重新加入。");
  });
});
