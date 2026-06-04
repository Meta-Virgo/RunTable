export type MusicSourceType = 0 | 2;
export type MusicInputType = "song" | "playlist";

interface MusicFetchEndpoint<T> {
  name: string;
  url: string;
  parse: (data: any) => T;
}

const proxied = (target: string) => [
  `https://corsproxy.io/?${encodeURIComponent(target)}`,
  `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}`,
];

const fetchFirst = async <T>(endpoints: MusicFetchEndpoint<T>[]) => {
  let lastError: unknown = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return endpoint.parse(await response.json());
    } catch (error) {
      console.warn(`Music catalog fetch failed via ${endpoint.name}:`, error);
      lastError = error;
    }
  }

  throw lastError || new Error("All music catalog fetch strategies failed");
};

export const parseMusicSource = (source?: string | null) => {
  if (!source) return { id: "", type: 2 as MusicSourceType };

  if (source.startsWith("s:")) {
    return { id: source.substring(2), type: 2 as MusicSourceType };
  }

  if (source.startsWith("p:")) {
    return { id: source.substring(2), type: 0 as MusicSourceType };
  }

  const match = source.match(/id=(\d+)/);
  if (match) {
    return {
      id: match[1],
      type: source.includes("playlist") ? 0 : (2 as MusicSourceType),
    };
  }

  if (/^\d+$/.test(source)) {
    return { id: source, type: 2 as MusicSourceType };
  }

  return { id: "", type: 2 as MusicSourceType };
};

export const parseMusicInput = (value: string) => {
  const match = value.match(/id=(\d+)/);

  if (value.includes("playlist")) {
    return {
      inputUrl: match ? match[1] : value,
      musicType: "playlist" as MusicInputType,
    };
  }

  if (value.includes("song")) {
    return {
      inputUrl: match ? match[1] : value,
      musicType: "song" as MusicInputType,
    };
  }

  return { inputUrl: value };
};

export const formatMusicSource = (
  inputUrl: string,
  musicType: MusicInputType
) => {
  const match = inputUrl.match(/id=(\d+)/);
  const id = match ? match[1] : inputUrl;

  if (!id.trim()) return "";

  return `${musicType === "playlist" ? "p" : "s"}:${id}`;
};

export async function fetchSongDetails(songIds: string[]) {
  if (songIds.length === 0) return [];

  const ids = `[${songIds.join(",")}]`;
  const urls = proxied(`https://music.163.com/api/song/detail?ids=${ids}`);
  return fetchFirst(
    urls.map((url, index) => ({
      name: index === 0 ? "corsproxy-song-detail" : "codetabs-song-detail",
      url,
      parse: (data) => data.songs || [],
    }))
  );
}

export async function fetchPlaylistDetails(playlistId: string) {
  const urls = proxied(
    `https://music.163.com/api/v6/playlist/detail?id=${playlistId}&n=1000&s=8`
  );
  return fetchFirst(
    urls.map((url, index) => ({
      name: index === 0 ? "corsproxy-playlist" : "codetabs-playlist",
      url,
      parse: (data) => ({
        tracks: data.playlist?.tracks || [],
        trackIds: data.playlist?.trackIds || [],
      }),
    }))
  );
}

export async function fetchPlayableSongUrl(songId: string) {
  const urls = proxied(
    `https://music.163.com/api/song/enhance/player/url?ids=[${songId}]&br=320000`
  );

  try {
    const url = await fetchFirst(
      urls.map((endpointUrl, index) => ({
        name: index === 0 ? "corsproxy-player-url" : "codetabs-player-url",
        url: endpointUrl,
        parse: (data) => data.data?.[0]?.url || "",
      }))
    );

    if (url) return url.replace(/^http:/, "https:");
  } catch (error) {
    console.warn("Unable to fetch playable song URL via API:", error);
  }

  return `https://music.163.com/song/media/outer/url?id=${songId}.mp3`;
}
