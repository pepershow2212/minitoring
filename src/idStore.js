import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const FILE = path.join(process.env.DATA_DIR || path.join(process.cwd(), "data"), "ids.json");

function readAll() {
  try {
    const data = JSON.parse(readFileSync(FILE, "utf8"));
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  mkdirSync(path.dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(data, null, 2));
}

export function loadServerId(serverId) {
  return readAll()[String(serverId)] || null;
}

export function loadAllServerIds() {
  return readAll();
}

export function saveServerId(serverId, entry) {
  const all = readAll();
  const prev = all[String(serverId)] || {};
  all[String(serverId)] = {
    lobbyId: String(entry.lobbyId ?? prev.lobbyId ?? ""),
    steamId: String(entry.steamId ?? prev.steamId ?? ""),
    appId: String(entry.appId ?? prev.appId ?? ""),
    gameId: String(entry.gameId ?? prev.gameId ?? ""),
    updatedAt: Date.now(),
  };
  writeAll(all);
  return all[String(serverId)];
}

export function clearServerId(serverId) {
  const all = readAll();
  delete all[String(serverId)];
  writeAll(all);
}
