import "dotenv/config";

for (const id of [1, 2]) {
  const host = process.env[`SERVER_${id}_RCON_HOST`];
  const port = process.env[`SERVER_${id}_RCON_PORT`];
  const password = process.env[`SERVER_${id}_RCON_PASSWORD`];
  const headers = { Authorization: `Bearer ${password}` };
  const status = await fetch(`http://${host}:${port}/v1/status`, { headers }).then((r) => r.json());
  const list = await fetch(`http://${host}:${port}/v1/players`, { headers }).then((r) => r.json());
  console.log(`СЕРВЕР ${id}`, {
    statusCurrent: status.players,
    listCount: list.count,
    listLen: list.players?.length,
    map: status.map,
  });
}
