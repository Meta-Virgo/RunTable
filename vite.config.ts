import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import {
  generateLiveKitToken,
  TokenRequestError,
} from "./server/livekitToken";
import type { TokenBody } from "./server/livekitToken";

const readJsonBody = async (req: any): Promise<TokenBody> =>
  new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: { toString(): string }) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });

const sendJson = (res: any, statusCode: number, payload: unknown) => {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (
              id.includes("livekit-client") ||
              id.includes("@livekit/")
            ) {
              return "vendor-livekit";
            }
            if (
              id.includes("konva") ||
              id.includes("react-konva") ||
              id.includes("yjs") ||
              id.includes("y-indexeddb") ||
              id.includes("lib0")
            ) {
              return "vendor-tabletop";
            }
            if (id.includes("@supabase/")) {
              return "vendor-supabase";
            }
            if (
              id.includes("react-markdown") ||
              id.includes("remark-") ||
              id.includes("rehype-") ||
              id.includes("micromark") ||
              id.includes("mdast-") ||
              id.includes("hast-") ||
              id.includes("unified")
            ) {
              return "vendor-markdown";
            }
            if (id.includes("lucide-react")) {
              return "vendor-icons";
            }
            if (
              id.includes("/react/") ||
              id.includes("\\react\\") ||
              id.includes("/react-dom/") ||
              id.includes("\\react-dom\\") ||
              id.includes("scheduler")
            ) {
              return "vendor-react";
            }
          },
        },
      },
    },
    plugins: [
      react(),
      {
        name: "api-server-middleware",
        configureServer(server) {
          server.middlewares.use("/api/token", async (req, res, next) => {
            if (req.method !== "POST") {
              next();
              return;
            }

            try {
              const authHeader = Array.isArray(req.headers.authorization)
                ? req.headers.authorization[0]
                : req.headers.authorization;
              const token = await generateLiveKitToken({
                body: await readJsonBody(req),
                authHeader,
                env,
              });

              sendJson(res, 200, { token });
            } catch (error) {
              console.error("Error generating LiveKit token:", error);
              if (error instanceof TokenRequestError) {
                sendJson(res, error.statusCode, { error: error.message });
                return;
              }
              sendJson(res, 500, { error: "Could not generate token" });
            }
          });
        },
      },
    ],
  };
});
