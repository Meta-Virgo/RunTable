export type MusicSourceType = 0 | 2;
export type MusicInputType = "song" | "playlist";

interface MusicFetchEndpoint<T> {
  name: string;
  url: string;
  headers?: Record<string, string>;
  parse: (data: any) => T;
}

const getMusicProxyEndpoint = (params: Record<string, string>) => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  if (!supabaseUrl) return null;

  const query = new URLSearchParams(params).toString();
  const headers: Record<string, string> = {};
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (anonKey) {
    headers.apikey = anonKey;
  }

  return {
    url: `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/music-proxy?${query}`,
    headers,
  };
};

const proxied = (target: string) => [
  `https://corsproxy.io/?${encodeURIComponent(target)}`,
  `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}`,
];

const fetchFirst = async <T>(endpoints: MusicFetchEndpoint<T>[]) => {
  let lastError: unknown = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(
        endpoint.url,
        endpoint.headers ? { headers: endpoint.headers } : undefined
      );
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

  const joinedIds = songIds.join(",");
  const ids = `[${joinedIds}]`;
  const proxy = getMusicProxyEndpoint({
    action: "song-detail",
    ids: joinedIds,
  });
  const urls = proxied(`https://music.163.com/api/song/detail?ids=${ids}`);
  const endpoints: MusicFetchEndpoint<any[]>[] = [
    ...(proxy
      ? [
          {
            name: "supabase-music-proxy-song-detail",
            url: proxy.url,
            headers: proxy.headers,
            parse: (data: any) => data.songs || [],
          },
        ]
      : []),
    ...urls.map((url, index) => ({
      name: index === 0 ? "corsproxy-song-detail" : "codetabs-song-detail",
      url,
      parse: (data: any) => data.songs || [],
    })),
  ];
  return fetchFirst(endpoints);
}

export async function fetchPlaylistDetails(playlistId: string) {
  const proxy = getMusicProxyEndpoint({
    action: "playlist-detail",
    id: playlistId,
  });
  const urls = proxied(
    `https://music.163.com/api/v6/playlist/detail?id=${playlistId}&n=1000&s=8`
  );
  const parsePlaylist = (data: any) => ({
    tracks: data.playlist?.tracks || [],
    trackIds: data.playlist?.trackIds || [],
  });
  const endpoints: MusicFetchEndpoint<{ tracks: any[]; trackIds: any[] }>[] = [
    ...(proxy
      ? [
          {
            name: "supabase-music-proxy-playlist",
            url: proxy.url,
            headers: proxy.headers,
            parse: parsePlaylist,
          },
        ]
      : []),
    ...urls.map((url, index) => ({
      name: index === 0 ? "corsproxy-playlist" : "codetabs-playlist",
      url,
      parse: parsePlaylist,
    })),
  ];
  return fetchFirst(endpoints);
}

export async function fetchPlayableSongUrl(songId: string) {
  const proxy = getMusicProxyEndpoint({
    action: "player-url",
    id: songId,
  });
  const urls = proxied(
    `https://music.163.com/api/song/enhance/player/url?ids=[${songId}]&br=320000`
  );
  const parseUrl = (data: any) => data.data?.[0]?.url || "";

  try {
    const endpoints: MusicFetchEndpoint<string>[] = [
      ...(proxy
        ? [
            {
              name: "supabase-music-proxy-player-url",
              url: proxy.url,
              headers: proxy.headers,
              parse: parseUrl,
            },
          ]
        : []),
      ...urls.map((endpointUrl, index) => ({
        name: index === 0 ? "corsproxy-player-url" : "codetabs-player-url",
        url: endpointUrl,
        parse: parseUrl,
      })),
    ];
    const url = await fetchFirst(endpoints);

    if (url) return url.replace(/^http:/, "https:");
  } catch (error) {
    console.warn("Unable to fetch playable song URL via API:", error);
  }

  return `https://music.163.com/song/media/outer/url?id=${songId}.mp3`;
}
