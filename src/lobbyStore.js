export class LobbyStore {
  constructor({ staleAfterMs }) {
    this.staleAfterMs = staleAfterMs;
    this.bySteamId = new Map();
    this.roundRobin = 0;
  }

  upsert(entry) {
    this.bySteamId.set(entry.steamId, {
      ...entry,
      updatedAt: Date.now(),
    });
  }

  remove(steamId) {
    this.bySteamId.delete(steamId);
  }

  prune(appId) {
    const now = Date.now();
    for (const [steamId, entry] of this.bySteamId) {
      if (entry.pinned) continue;
      const stale = now - entry.updatedAt > this.staleAfterMs;
      const wrongGame = appId && entry.appId && entry.appId !== appId;
      if (stale || wrongGame) {
        this.bySteamId.delete(steamId);
      }
    }
  }

  pick(appId) {
    this.prune(appId);
    const live = [...this.bySteamId.values()].filter((entry) => {
      if (appId && entry.appId !== appId) return false;
      return Boolean(entry.lobbyId || entry.gameserverIp);
    });
    if (live.length === 0) return null;
    this.roundRobin = (this.roundRobin + 1) % live.length;
    return live[this.roundRobin];
  }

  snapshot() {
    return [...this.bySteamId.values()].map((entry) => ({
      steamId: entry.steamId,
      lobbyId: entry.lobbyId,
      persona: entry.persona,
      appId: entry.appId,
      ageSec: Math.round((Date.now() - entry.updatedAt) / 1000),
    }));
  }
}

export function toSteamJoinUrl(appId, lobbyId, steamId) {
  return `steam://joinlobby/${appId}/${lobbyId}/${steamId}`;
}

export function toSteamConnectUrl(addr) {
  return `steam://connect/${addr}`;
}

export function joinToUrl(join) {
  if (!join) return "";
  if (join.addr) return toSteamConnectUrl(join.addr);
  if (join.lobbyId) {
    return toSteamJoinUrl(join.appId, join.lobbyId, join.steamId);
  }
  return "";
}

export function parseSteamJoinUrl(link) {
  const text = String(link || "").trim();
  if (!text || /^сброс|clear|reset$/i.test(text)) {
    return { reset: true };
  }
  const match = text.match(/^steam:\/\/joinlobby\/(\d+)\/(\d+)(?:\/(\d+))?/i);
  if (match) {
    return {
      appId: match[1],
      lobbyId: match[2],
      steamId: match[3] || "",
    };
  }
  const uuid = text.match(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  );
  if (uuid) {
    return { communityId: uuid[0].toLowerCase() };
  }
  const onlyLobby = text.match(/^(\d{5,})$/);
  if (onlyLobby) {
    return { appId: "", lobbyId: onlyLobby[1], steamId: "" };
  }
  return null;
}
