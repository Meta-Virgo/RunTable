import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchPlayableSongUrl,
  fetchPlaylistDetails,
  fetchSongDetails,
  parseMusicSource,
} from "./musicCatalog";

describe("musicCatalog service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("parses song and playlist identifiers", () => {
    expect(parseMusicSource("s:12345")).toEqual({ id: "12345", type: 2 });
    expect(parseMusicSource("p:67890")).toEqual({ id: "67890", type: 0 });
  });

  it("prefers the Supabase music-proxy Edge Function for song details", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");

    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ songs: [{ id: 123, name: "Track" }] }), {
        status: 200,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const songs = await fetchSongDetails(["123"]);
    expect(songs).toEqual([{ id: 123, name: "Track" }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/music-proxy?action=song-detail&ids=123",
      { headers: { apikey: "anon-key" } }
    );
  });

  it("falls back to public proxies when the Edge Function fails", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("Not Found", { status: 404 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            playlist: { tracks: [{ id: 1 }], trackIds: [{ id: 1 }] },
          }),
          { status: 200 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const details = await fetchPlaylistDetails("42");
    expect(details.tracks).toEqual([{ id: 1 }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("normalizes playable song URLs to HTTPS", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "anon-key");

    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ data: [{ url: "http://music.example.com/song.mp3" }] }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPlayableSongUrl("999")).resolves.toBe(
      "https://music.example.com/song.mp3"
    );
  });
});
