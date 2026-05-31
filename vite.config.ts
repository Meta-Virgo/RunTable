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
    build: {
      chunkSizeWarningLimit: 650,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (id.includes("@livekit") || id.includes("livekit-client")) {
              return "livekit-vendor";
            }
            if (id.includes("@supabase")) {
              return "supabase-vendor";
            }
            if (id.includes("react") || id.includes("scheduler")) {
              return "react-vendor";
            }
            if (id.includes("lucide-react")) {
              return "icons-vendor";
            }
          },
        },
      },
    },
  };
});
