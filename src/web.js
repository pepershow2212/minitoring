import express from "express";
import { connectingPage, waitingPage } from "./pages.js";
import {
  addSeed,
  getAppId,
  liveJoin,
  rememberLobby,
  status,
} from "./tracker.js";
import { parseSteamJoinUrl, toSteamJoinUrl } from "./lobbyStore.js";
import { getServer } from "./servers.js";

export function resolvePublicUrl() {
  const hook = String(process.env.WEBHOOK_URL || "");
  const raw = String(process.env.PUBLIC_URL || process.env.DOMAIN || "").trim();
  if (!raw && hook.startsWith("http")) {
    try {
      return new URL(hook).origin;
    } catch {
      return "";
    }
  }
  if (!raw) return "";
  const url = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
  return url.replace(/\/$/, "");
}

export function createJoinApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));
  app.use((_req, res, next) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Cache-Control", "no-store");
    next();
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/wardogs/status", (_req, res) => {
    res.json(status());
  });

  app.get(["/api/wardogs/join-link", "/join"], async (req, res) => {
    const server = getServer(req.query.server || req.query.name);
    if (!server) {
      res.status(404).type("html").send(waitingPage({ serverName: "WARDOGS RUSSIA" }));
      return;
    }

    const result = await liveJoin(server.id);
    if (!result.ok || !result.steamUrl) {
      res.status(200).type("html").send(
        waitingPage({
          serverName: server.name,
          searchName: server.query,
        })
      );
      return;
    }

    res.status(200).type("html").send(
      connectingPage({
        serverName: server.name,
        steamUrl: result.steamUrl,
      })
    );
  });

  app.post("/api/wardogs/report-link", (req, res) => {
    const server = getServer(req.body?.server);
    const parsed = parseSteamJoinUrl(req.body?.link);
    if (!server || !parsed?.lobbyId) {
      res.status(400).json({
        error: "Нужны server: 1|2|3|4 и ссылка steam://joinlobby/APPID/LOBBYID/STEAMID",
      });
      return;
    }
    if (parsed.appId !== getAppId()) {
      res.status(400).json({ error: `Ожидается appId ${getAppId()}` });
      return;
    }
    if (parsed.steamId) addSeed(server.id, parsed.steamId);
    rememberLobby(server.id, {
      steamId: parsed.steamId || `manual-${parsed.lobbyId}`,
      lobbyId: parsed.lobbyId,
      appId: parsed.appId,
      persona: req.body?.persona || "manual",
    });
    res.json({
      ok: true,
      server: server.name,
      link: toSteamJoinUrl(parsed.appId, parsed.lobbyId, parsed.steamId),
    });
  });

  return app;
}

export function startJoinServer() {
  const port = Number(process.env.PORT || 3000);
  const app = createJoinApp();
  return new Promise((resolve, reject) => {
    const server = app.listen(port, "0.0.0.0", () => {
      const publicUrl = resolvePublicUrl();
      if (publicUrl) {
        process.env.PUBLIC_URL = publicUrl;
        console.log(`Публичный join: ${publicUrl}/join?server=2`);
      } else {
        console.log(`Join-сайт слушает 0.0.0.0:${port}, но PUBLIC_URL/DOMAIN пустой`);
      }
      resolve(server);
    });
    server.on("error", reject);
  });
}
