function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const BANNER =
  process.env.PANEL_BANNER_URL || "https://i.ibb.co/sdVC2fSz/ssss123.png";

function liveLine(live) {
  if (!live) return "";
  const players = Number(live.players || 0);
  const maxPlayers = Number(live.maxPlayers || 0);
  const count = maxPlayers > 0 ? `${players}/${maxPlayers}` : String(players);
  const map = live.map || "";
  return map ? `${count} · ${map}` : count;
}

export function joinPayload(result) {
  const server = result?.server;
  const live = result?.live;
  const communityId = String(server?.gameId || "").trim();
  return {
    ok: Boolean(result?.ok && result.steamUrl),
    reason: result?.reason || (result?.ok ? "ready" : "nolobby"),
    steamUrl: result?.steamUrl || "",
    communityId,
    server: server
      ? {
          id: server.id,
          name: server.name,
          query: server.query,
          gameId: communityId,
        }
      : null,
    live: live
      ? {
          players: Number(live.players || 0),
          maxPlayers: Number(live.maxPlayers || 0),
          map: live.map || "",
        }
      : null,
  };
}

export function joinPage(result) {
  const data = joinPayload(result);
  const name = data.server?.name || "WARDOGS RUSSIA";
  const query = data.server?.query || "";
  const communityId = data.communityId || "";
  const empty = !data.ok && (data.reason === "empty" || !data.steamUrl);
  const status = data.ok
    ? "Открываем Steam…"
    : empty
      ? communityId
        ? "Онлайн 0. Скопируй ID и вставь в Community Servers в игре."
        : "Онлайн 0. Заходите из списка серверов в игре."
      : "Ищем лобби, страница сама кинет в игру.";
  const hint = data.ok
    ? "Wardogs должен быть уже запущен. Если Steam не открылся — жми ещё раз."
    : communityId
      ? "ID статичный с патча 0.11 — не меняется после рестарта."
      : query
        ? `В игре ищите: ${query}`
        : "Запусти Wardogs и подожди пару секунд.";

  const idBlock = communityId
    ? `<p class="idbox" id="idbox"><code id="cid">${escapeHtml(communityId)}</code></p>
       <button type="button" class="copy" id="copy">Скопировать ID</button>`
    : "";

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Cache-Control" content="no-store">
  ${data.ok ? `<meta http-equiv="refresh" content="0;url=${escapeHtml(data.steamUrl)}">` : ""}
  <title>${escapeHtml(name)}</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: Segoe UI, Arial, sans-serif;
      background: #0b0d11;
      color: #f2f4f8;
    }
    .card {
      width: min(520px, calc(100vw - 24px));
      overflow: hidden;
      background: #14181f;
      border: 1px solid #2a303c;
      border-radius: 18px;
    }
    img { display: block; width: 100%; height: auto; }
    .box { padding: 22px 22px 24px; text-align: center; }
    .name { margin: 0 0 6px; font-size: 22px; }
    .live { margin: 0 0 12px; color: #8b93a3; font-size: 14px; }
    .status { margin: 0 0 8px; color: #d7dde8; line-height: 1.45; }
    .hint { margin: 0 0 18px; color: #8b93a3; font-size: 14px; line-height: 1.4; }
    .idbox {
      margin: 0 0 12px;
      padding: 12px;
      border-radius: 10px;
      background: #0f131a;
      border: 1px dashed #3a4454;
      word-break: break-all;
      font-size: 14px;
    }
    code { color: #f8fafc; }
    .copy, a.play {
      display: inline-block;
      min-width: 180px;
      margin: 0 6px 8px;
      padding: 12px 20px;
      border: 0;
      border-radius: 10px;
      background: #16a34a;
      color: #fff;
      text-decoration: none;
      font-weight: 700;
      cursor: pointer;
      font-size: 15px;
    }
    .copy { background: #2563eb; }
    a.play[hidden], .copy[hidden] { display: none; }
    .wait { color: #f59e0b; }
  </style>
</head>
<body>
  <main class="card">
    <img src="${escapeHtml(BANNER)}" alt="WARDOGS RUSSIA">
    <div class="box">
      <h1 class="name">${escapeHtml(name)}</h1>
      <p class="live" id="live">${escapeHtml(liveLine(data.live))}</p>
      <p class="status ${data.ok ? "" : "wait"}" id="status">${escapeHtml(status)}</p>
      <p class="hint" id="hint">${escapeHtml(hint)}</p>
      ${idBlock}
      <a class="play" id="play" href="${escapeHtml(data.steamUrl)}" ${data.ok ? "" : "hidden"}>Играть</a>
    </div>
  </main>
  <script>
    const serverId = ${JSON.stringify(data.server?.id || "")};
    const communityId = ${JSON.stringify(communityId)};
    const play = document.getElementById("play");
    const statusEl = document.getElementById("status");
    const hintEl = document.getElementById("hint");
    const liveEl = document.getElementById("live");
    const copyBtn = document.getElementById("copy");
    let launched = false;

    if (copyBtn && communityId) {
      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(communityId);
          copyBtn.textContent = "Скопировано";
        } catch (e) {
          copyBtn.textContent = "Выдели ID вручную";
        }
      });
    }

    function liveText(live) {
      if (!live) return "";
      const count = live.maxPlayers > 0 ? live.players + "/" + live.maxPlayers : String(live.players || 0);
      return live.map ? count + " · " + live.map : count;
    }

    function launch(url) {
      if (!url) return;
      play.href = url;
      play.hidden = false;
      statusEl.className = "status";
      statusEl.textContent = "Открываем Steam…";
      hintEl.textContent = "Wardogs должен быть уже запущен. Если Steam не открылся — жми ещё раз.";
      if (launched) return;
      launched = true;
      const frame = document.createElement("iframe");
      frame.style.display = "none";
      frame.src = url;
      document.body.appendChild(frame);
      location.href = url;
      play.click();
    }

    async function poll() {
      if (launched || !serverId) return;
      try {
        const res = await fetch("/api/wardogs/join-link?server=" + encodeURIComponent(serverId), { cache: "no-store" });
        const data = await res.json();
        if (data.live) liveEl.textContent = liveText(data.live);
        if (data.steamUrl) {
          launch(data.steamUrl);
          return;
        }
        statusEl.className = "status wait";
        statusEl.textContent = data.communityId || communityId
          ? "Онлайн 0. Скопируй ID и вставь в Community Servers в игре."
          : "Онлайн 0. Заходите из списка серверов в игре.";
      } catch (error) {
        statusEl.textContent = "Нет связи с сайтом, пробую ещё…";
      }
      setTimeout(poll, 3000);
    }

    ${data.ok ? "launch(" + JSON.stringify(data.steamUrl) + ");" : "poll();"}
  </script>
</body>
</html>`;
}

export function connectingPage({ serverName, steamUrl, live }) {
  return joinPage({
    ok: true,
    steamUrl,
    server: { id: "", name: serverName, query: "", gameId: "" },
    live,
  });
}

export function waitingPage({ serverName, searchName = "", live, gameId = "" }) {
  return joinPage({
    ok: false,
    reason: "empty",
    server: { id: "", name: serverName, query: searchName, gameId },
    live,
  });
}
