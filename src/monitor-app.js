import "dotenv/config";

if (!process.env.SERVER_1_BOT_TOKEN) {
  process.env.SERVER_1_BOT_TOKEN =
    process.env.DISCORD_BOT_TOKEN || process.env.BOT_TOKEN || "";
}

const { startPolling } = await import("./tracker.js");
const { startMonitors } = await import("./monitor.js");

console.log("WARDOGS monitor host");
startPolling();
startMonitors().catch((error) => {
  console.error("Мониторы не стартанули:", error.message);
  process.exit(1);
});
