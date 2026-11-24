import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://trpgtool.monocanto.com",
  "https://trpgtool.maoyiwei.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
];

const getAllowedOrigins = () => {
  const configured = (Deno.env.get("APP_ORIGIN") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured]);
};

const buildCorsHeaders = (origin: string | null) => {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "OPTIONS,GET",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    Vary: "Origin",
  };

  if (origin && getAllowedOrigins().has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
};

const NUMERIC_ID = /^\d{1,16}$/;
const NUMERIC_ID_LIST = /^\d{1,16}(,\d{1,16}){0,99}$/;

const resolveUpstreamTarget = (url: URL) => {
  const action = url.searchParams.get("action");

  if (action === "song-detail") {
    const ids = url.searchParams.get("ids") ?? "";
    if (!NUMERIC_ID_LIST.test(ids)) {
      return { error: "Invalid song ids" };
    }
    return {
      target: `https://music.163.com/api/song/detail?ids=[${ids}]`,
      cacheControl: "public, max-age=300",
    };
  }

  if (action === "playlist-detail") {
    const id = url.searchParams.get("id") ?? "";
    if (!NUMERIC_ID.test(id)) {
      return { error: "Invalid playlist id" };
    }
    return {
      target: `https://music.163.com/api/v6/playlist/detail?id=${id}&n=1000&s=8`,
      cacheControl: "public, max-age=180",
    };
  }

  if (action === "player-url") {
    const id = url.searchParams.get("id") ?? "";
    if (!NUMERIC_ID.test(id)) {
      return { error: "Invalid song id" };
    }
    return {
      target: `https://music.163.com/api/song/enhance/player/url?ids=[${id}]&br=320000`,
      cacheControl: "public, max-age=120",
    };
  }

  return { error: "Unsupported action" };
};

serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const corsHeaders = buildCorsHeaders(origin);
  const allowedOrigin = !origin || getAllowedOrigins().has(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: allowedOrigin ? 200 : 403,
      headers: corsHeaders,
    });
  }

  if (!allowedOrigin) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const resolved = resolveUpstreamTarget(new URL(req.url));
  if ("error" in resolved) {
    return new Response(JSON.stringify({ error: resolved.error }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const upstream = await fetch(resolved.target, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RunTableMusicProxy/1.0)",
        Referer: "https://music.163.com/",
      },
    });

    if (!upstream.ok) {
      return new Response(
        JSON.stringify({ error: `Upstream HTTP ${upstream.status}` }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = await upstream.text();
    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": resolved.cacheControl,
      },
    });
  } catch (error) {
    console.error("music-proxy failed", error);
    return new Response(JSON.stringify({ error: "Upstream request failed" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
