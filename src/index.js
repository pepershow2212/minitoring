import "dotenv/config";
import express from "express";
import { startBot } from "./bot.js";
import { startMonitors } from "./monitor.js";
import { connectingPage, waitingPage } from "./pages.js";
import { startPublicUrl } from "./tunnel.js";
import {
  addSeed,
  getAppId,
  liveJoin,
  rememberLobby,
  startPolling,
  status,
} from "./tracker.js";
import { parseSteamJoinUrl, toSteamJoinUrl } from "./lobbyStore.js";
import { getServer } from "./servers.js";

const PORT = Number(process.env.PORT || 3000);

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

function listen() {
  return new Promise((resolve, reject) => {
    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`WARDOGS RUSSIA connect http://localhost:${PORT}`);
      resolve(server);
    });
    server.on("error", reject);
  });
}

async function main() {
  await listen();
  startPolling();
  const url = await startPublicUrl(PORT);
  if (url) {
    console.log(`Публичный join: ${url}/join?server=2`);
  }
  startBot().catch((error) => {
    console.error("Discord бот не стартанул:", error.message);
  });
  if (process.env.SKIP_MONITORS === "1") {
    console.log("Мониторы выключены: SKIP_MONITORS=1");
  } else {
    startMonitors().catch((error) => {
      console.error("Мониторы не стартанули:", error.message);
    });
  }
}

if (process.env.BOT_ID && process.env.BOTHOST !== "0") {
  await import("./monitor-app.js");
} else {
  main().catch((error) => {
    console.error("Не стартануло:", error.message);
    process.exit(1);
  });
}
