import "dotenv/config";

if (!process.env.SERVER_1_BOT_TOKEN) {
  process.env.SERVER_1_BOT_TOKEN =
    process.env.DISCORD_BOT_TOKEN || process.env.BOT_TOKEN || "";
}

const { startPolling } = await import("./tracker.js");
const { startMonitors } = await import("./monitor.js");
const { startBot } = await import("./bot.js");

console.log("WARDOGS host: панель + мониторы");
startPolling();
startBot()
  .then((client) => {
    if (!client) {
      console.log("Панель не стартанула: нет DISCORD_TOKEN в переменных Bothost");
    }
  })
  .catch((error) => {
    console.error("Панель не стартанула:", error.message);
  });
startMonitors().catch((error) => {
  console.error("Мониторы не стартанули:", error.message);
  process.exit(1);
});
