import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getRoomCoverImageVariantUrl, RoomCard } from "./RoomCard";
import type { Room } from "../types";

describe("room cover image variants", () => {
  it("uses Supabase transformed images for compact room cards", () => {
    const url = getRoomCoverImageVariantUrl(
      "https://project.supabase.co/storage/v1/object/public/post-images/user/room-covers/cover.jpg",
      { width: 420, height: 560, quality: 70 }
    );

    expect(url).toBe(
      "https://project.supabase.co/storage/v1/render/image/public/post-images/user/room-covers/cover.jpg?width=420&height=560&resize=cover&quality=70"
    );
  });

  it("leaves non-Supabase public object urls alone", () => {
    expect(
      getRoomCoverImageVariantUrl("https://example.test/cover.jpg", {
        width: 420,
        height: 560,
        quality: 70,
      })
    ).toBe("https://example.test/cover.jpg");
  });

  it("renders a loader while a cover image is preloading", () => {
    const room: Room = {
      id: "room-1",
      created_at: "2026-06-18T00:00:00Z",
      kp_id: "keeper-1",
      title: "Room",
      description: null,
      status: "open",
      room_number: 1,
      cover_image_url: "https://example.test/cover.jpg",
      type: "text",
    };

    const html = renderToStaticMarkup(
      <RoomCard
        room={room}
        isAuthenticated={false}
        currentUserId={null}
        myCharacters={[]}
        onlineUsers={new Set()}
        onJoinRoom={() => {}}
      />
    );

    expect(html).toContain("animate-spin");
  });
});
