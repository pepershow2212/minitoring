function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function layout({ title, body, redirectUrl = "" }) {
  const refresh = redirectUrl
    ? `<meta http-equiv="refresh" content="0;url=${escapeHtml(redirectUrl)}">`
    : "";
  const boot = redirectUrl
    ? `<script>location.replace(${JSON.stringify(redirectUrl)});</script>`
    : "";

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Cache-Control" content="no-store">
  ${refresh}
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: dark; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: Segoe UI, Arial, sans-serif;
      background: #0f1115;
      color: #f2f4f8;
    }
    .card {
      width: min(520px, calc(100vw - 32px));
      background: #171a21;
      border: 1px solid #2a303c;
      border-radius: 16px;
      padding: 28px;
      text-align: center;
    }
    h1 { margin: 0 0 12px; font-size: 22px; }
    p { margin: 0 0 16px; color: #b7c0ce; line-height: 1.45; }
    a {
      display: inline-block;
      padding: 12px 18px;
      border-radius: 10px;
      background: #5865f2;
      color: #fff;
      text-decoration: none;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <main class="card">${body}</main>
  ${boot}
</body>
</html>`;
}

export function connectingPage({ serverName, steamUrl }) {
  return layout({
    title: `Подключение к ${serverName}`,
    redirectUrl: steamUrl,
    body: `
      <h1>Подключаем к ${escapeHtml(serverName)}</h1>
      <p>Игра должна быть уже запущена. Если Steam не открылся — нажмите ещё раз.</p>
      <a href="${escapeHtml(steamUrl)}">Играть в Wardogs</a>
    `,
  });
}

export function waitingPage({ serverName, searchName = "" }) {
  const extra = searchName
    ? `<p>Пока никого нет. В игре ищите <b>${escapeHtml(searchName)}</b> — страница обновится сама.</p>`
    : `<p>Пока никого нет на сервере. Страница обновится сама.</p>`;
  return layout({
    title: `${serverName}: ждём игрока`,
    body: `
      <h1>${escapeHtml(serverName)}</h1>
      ${extra}
      <script>setTimeout(function(){location.reload()},2000)</script>
    `,
  });
}
