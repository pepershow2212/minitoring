import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  GatewayIntentBits,
  MessageFlags,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";
import { joinMessage, panelFingerprint } from "./panel.js";
import { clearPanelRef, loadPanelRef, savePanelRef } from "./panelStore.js";
import { addSeed, getAppId, liveJoin, onLiveChange, rememberLobby } from "./tracker.js";
import { parseSteamJoinUrl } from "./lobbyStore.js";
import { communityIdOf, getServer, serverChoices, setServerGameId } from "./servers.js";
import { saveServerId } from "./idStore.js";
import { resolvePublicUrl } from "./web.js";

function joinReply(result) {
  if (!result || result.reason === "missing") {
    return { content: "Такого сервера нет." };
  }
  if (result.reason === "soon") {
    return { content: `**${result.server.name}** — скоро.` };
  }

  const site = resolvePublicUrl();
  if (site && result.server?.id && result.ok) {
    return {
      content: "Жми — сайт сразу кинет в игру.",
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel("Играть")
            .setURL(`${site}/join?server=${encodeURIComponent(result.server.id)}`)
        ),
      ],
    };
  }

  if (result.ok && result.steamUrl) {
    const online =
      result.live?.maxPlayers > 0
        ? `${result.live.players}/${result.live.maxPlayers}`
        : "";
    const map = result.live?.map || "";
    return {
      content: [
        result.steamUrl,
        `**${result.server.name}** ${online} ${map}`.trim(),
        "Игра должна быть уже запущена.",
      ].join("\n"),
    };
  }

  const communityId = communityIdOf(result.server);
  return {
    content: [
      `**${result.server.name}**: онлайн **0** — Steam-лобби нет.`,
      communityId
        ? `В игре: Community Servers → вставь ID:\n\`${communityId}\``
        : `В игре ищите: **${result.server.query}**`,
    ].join("\n"),
  };
}

async function registerCommands(token, clientId, guildId) {
  const commands = [
    new SlashCommandBuilder()
      .setName("панель")
      .setDescription("Живая панель серверов WARDOGS")
      .toJSON(),
    new SlashCommandBuilder()
      .setName("id")
      .setDescription("Записать ID сервера")
      .addStringOption((option) =>
        option
          .setName("сервер")
          .setDescription("Какой сервер")
          .setRequired(true)
          .addChoices(...serverChoices())
      )
      .addStringOption((option) =>
        option
          .setName("id")
          .setDescription("Статичный community ID сервера")
          .setRequired(true)
      )
      .toJSON(),
  ];

  const rest = new REST({ version: "10" }).setToken(token);
  try {
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commands,
      });
      return;
    }
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
  } catch (error) {
    console.error("Команды не зарегистрировались:", error.message);
    console.log("Пригласите основного бота на сервер с правами: applications.commands, Send Messages");
  }
}

export async function startBot() {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    console.log("Discord бот выключен: нет DISCORD_TOKEN");
    return null;
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  let lastFingerprint = "";
  let refreshBusy = false;

  async function rememberPanel(message) {
    savePanelRef({ channelId: message.channelId, messageId: message.id });
    lastFingerprint = panelFingerprint();
  }

  async function fetchTrackedPanel() {
    const ref = loadPanelRef();
    if (!ref) return null;
    const channel = await client.channels.fetch(ref.channelId).catch(() => null);
    if (!channel?.isTextBased()) return null;
    return channel.messages.fetch(ref.messageId).catch(() => null);
  }

  async function refreshPanel(force = false) {
    if (!client.isReady() || refreshBusy) return;
    const fingerprint = panelFingerprint();
    if (!force && fingerprint === lastFingerprint) return;

    refreshBusy = true;
    try {
      const message = await fetchTrackedPanel();
      if (!message) {
        if (force) clearPanelRef();
        return;
      }
      await message.edit(joinMessage());
      lastFingerprint = fingerprint;
    } catch (error) {
      if (error.code === 10008) {
        clearPanelRef();
        lastFingerprint = "";
        return;
      }
      console.error("Панель не обновилась:", error.message);
    } finally {
      refreshBusy = false;
    }
  }

  client.on("ready", async () => {
    console.log(`Discord: ${client.user.tag}`);
    const clientId = client.application?.id || client.user.id;
    await registerCommands(token, clientId, process.env.DISCORD_GUILD_ID);
    const existing = await fetchTrackedPanel();
    if (existing) {
      await refreshPanel(true);
      return;
    }
    const channelId = process.env.DISCORD_CHANNEL_ID;
    if (!channelId) return;
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased()) return;
    const sent = await channel.send(joinMessage());
    await rememberPanel(sent);
  });

  onLiveChange(() => {
    refreshPanel().catch((error) => {
      console.error("Панель не обновилась:", error.message);
    });
  });

  client.on("interactionCreate", async (interaction) => {
    if (interaction.isButton() && interaction.customId.startsWith("join:")) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const result = await liveJoin(interaction.customId.slice(5));
      await interaction.editReply(joinReply(result));
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "панель") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const previous = await fetchTrackedPanel();
      const sent = await interaction.channel.send(joinMessage());
      await rememberPanel(sent);
      if (previous && previous.id !== sent.id) {
        await previous.delete().catch(() => null);
      }
      await interaction.deleteReply().catch(() => null);
      return;
    }

    if (interaction.commandName === "id") {
      const server = getServer(interaction.options.getString("сервер"));
      const parsed = parseSteamJoinUrl(interaction.options.getString("id"));
      if (!server || parsed?.reset || (!parsed?.communityId && !parsed?.lobbyId)) {
        await interaction.reply({
          ephemeral: true,
          content: "Напиши сервер и ID (UUID вида `b84ed563-...`).",
        });
        return;
      }

      if (parsed.communityId) {
        setServerGameId(server.id, parsed.communityId);
        saveServerId(server.id, { gameId: parsed.communityId });
        await interaction.reply({
          ephemeral: true,
          content: `ID записан на **${server.name}**:\n\`${parsed.communityId}\``,
        });
        await refreshPanel(true);
        return;
      }

      const appId = parsed.appId || getAppId();
      if (parsed.appId && parsed.appId !== getAppId()) {
        await interaction.reply({ ephemeral: true, content: "Это ID от другой игры." });
        return;
      }
      if (parsed.steamId) addSeed(server.id, parsed.steamId);
      rememberLobby(
        server.id,
        {
          steamId: parsed.steamId || `manual-${parsed.lobbyId}`,
          lobbyId: parsed.lobbyId,
          appId,
          persona: interaction.user.username,
          pinned: true,
        },
        true
      );
      await interaction.reply({
        ephemeral: true,
        content: `Lobby ID записан на **${server.name}**: \`${parsed.lobbyId}\``,
      });
    }
  });

  await client.login(token);
  return client;
}
