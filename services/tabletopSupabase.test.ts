import { describe, expect, it } from "vitest";
import { getTabletopRealtimeConnection } from "./tabletopSupabase";

describe("tabletop Supabase realtime helpers", () => {
  it("does not report terminal subscription failures as reconnecting", () => {
    expect(getTabletopRealtimeConnection({ status: "SUBSCRIBED" })).toEqual({
      status: "connected",
      detail: null,
    });
    expect(getTabletopRealtimeConnection({ status: "CLOSED" }).status).toBe(
      "reconnecting"
    );
    expect(getTabletopRealtimeConnection({ status: "TIMED_OUT" }).status).toBe(
      "error"
    );
    expect(
      getTabletopRealtimeConnection({
        status: "CHANNEL_ERROR",
        error: new Error("private channel denied"),
      })
    ).toEqual({
      status: "error",
      detail: "实时连接失败：private channel denied",
    });
  });
});
