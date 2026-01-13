import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { AccessToken } from "livekit-server-sdk";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 加载环境变量，包括那些不带 VITE_ 前缀的（如 LIVEKIT_API_KEY）
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      {
        name: "api-server-middleware",
        configureServer(server) {
          server.middlewares.use("/api/token", async (req, res, next) => {
            if (req.method === "POST") {
              let body = "";
              req.on("data", (chunk) => {
                body += chunk.toString();
              });
              req.on("end", async () => {
                try {
                  const { roomName, participantName } = JSON.parse(body);

                  const apiKey = env.LIVEKIT_API_KEY;
                  const apiSecret = env.LIVEKIT_API_SECRET;

                  if (!apiKey || !apiSecret) {
                    console.error(
                      "❌ Missing LIVEKIT_API_KEY or LIVEKIT_API_SECRET in .env file"
                    );
                    res.statusCode = 500;
                    res.setHeader("Content-Type", "application/json");
                    res.end(
                      JSON.stringify({
                        error: "Server misconfigured: Missing API Key/Secret",
                      })
                    );
                    return;
                  }

                  const at = new AccessToken(apiKey, apiSecret, {
                    identity: participantName,
                  });
                  at.addGrant({ roomJoin: true, room: roomName });
                  const token = await at.toJwt();

                  console.log(
                    `✅ Generated LiveKit token for user: ${participantName}, room: ${roomName}`
                  );
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ token }));
                } catch (e) {
                  console.error("❌ Error generating token:", e);
                  res.statusCode = 500;
                  res.setHeader("Content-Type", "application/json");
                  res.end(
                    JSON.stringify({ error: "Could not generate token" })
                  );
                }
              });
            } else {
              next();
            }
          });
        },
      },
    ],
  };
});
