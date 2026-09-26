/**
 * UnlimPlay Discord Activity — build v3
 *
 * URL Mappings (Developer Portal → Activities → URL Mappings):
 *   /            → yuritza953-cell.github.io/eivum
 *   /bot         → camiloh-bot-v2.onrender.com
 *   /unlimplay   → unlimplay.com
 */

import { DiscordSDK, patchUrlMappings } from "./discord-sdk.mjs?v=3";

const BUILD = "v3";
const IS_DISCORD = /discordsays\.com$/i.test(window.location.hostname);

const BOT_API_BASE = IS_DISCORD
  ? "/.proxy/bot"
  : "https://camiloh-bot-v2.onrender.com";

const UNLIMPLAY_BASE = IS_DISCORD
  ? "/.proxy/unlimplay"
  : "https://unlimplay.com";

let discordSdk = null;

function $(id) {
  return document.getElementById(id);
}

function setStatus(text, kind) {
  const el = $("status");
  if (!el) return;
  el.textContent = text || "";
  el.className = "status" + (kind ? " " + kind : "");
}

function setLoading(on) {
  const el = $("loading");
  if (el) el.style.display = on ? "block" : "none";
}

function toProxyEmbed(url) {
  if (!url) return url;
  try {
    const u = new URL(url, window.location.origin);
    if (u.hostname.includes("unlimplay.com") || String(url).includes("unlimplay.com")) {
      const path = u.pathname || String(url).replace(/^https?:\/\/[^/]+/, "");
      return UNLIMPLAY_BASE + path + (u.search || "");
    }
  } catch (_) {}
  if (String(url).startsWith("/f/")) return UNLIMPLAY_BASE + url;
  return url;
}

function showPlayer(data) {
  if (!data || !data.embed_url) return;

  const embedUrl = toProxyEmbed(data.embed_url);
  console.log("[" + BUILD + "] showPlayer", data.title, embedUrl);

  const titleEl = $("playerTitle");
  const metaEl = $("playerMeta");
  const wrapper = $("playerWrapper");
  const player = $("player");

  if (titleEl) titleEl.textContent = data.title || "Reproduciendo";

  if (metaEl) {
    if (data.type === "movie") {
      metaEl.textContent = data.year ? String(data.year) : "";
    } else {
      const se = "T" + (data.season || "?") + "E" + (data.episode || "?");
      metaEl.textContent = se + (data.year ? " · " + data.year : "");
    }
  }

  if (wrapper) {
    wrapper.innerHTML =
      '<iframe src="' +
      embedUrl +
      '" allowfullscreen scrolling="no" ' +
      'allow="autoplay; fullscreen; encrypted-media; picture-in-picture"></iframe>';
  }

  if (player) player.classList.add("active");
  setStatus("Reproduciendo · " + (data.title || ""), "ok");
  setLoading(false);

  const manual = $("manualBox");
  if (manual) manual.classList.remove("visible");
}

async function fetchPending(url) {
  console.log("[" + BUILD + "] GET", url);
  const res = await fetch(url);
  console.log("[" + BUILD + "] status", res.status, url);
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

async function loadPendingFromBot(channelId) {
  if (!channelId) return null;

  // 1) Ruta normal vía mapping /bot → host (path sin /bot)
  const urls = [
    BOT_API_BASE.replace(/\/$/, "") +
      "/api/activity/pending?channel_id=" +
      encodeURIComponent(channelId),
  ];

  // 2) Si el proxy no quita el prefijo, el bot también escucha /bot/api/...
  //    (solo tiene sentido fuera del mapping raro; dentro de Discord ya va con /bot)
  if (!IS_DISCORD) {
    urls.push(
      "https://camiloh-bot-v2.onrender.com/bot/api/activity/pending?channel_id=" +
        encodeURIComponent(channelId)
    );
  }

  for (const url of urls) {
    try {
      const json = await fetchPending(url);
      console.log("[" + BUILD + "] pending body", json);
      if (json && json.success && json.data && json.data.embed_url) {
        return json.data;
      }
      if (json && json.success && json.data === null) {
        return null;
      }
    } catch (err) {
      console.log("[" + BUILD + "] pending error", err);
    }
  }
  return null;
}

function parseQueryFallback() {
  try {
    const q = new URLSearchParams(window.location.search);
    const type = q.get("type") || "movie";
    const id = q.get("tmdb_id") || q.get("id");
    if (!id) return null;

    const season = parseInt(q.get("season") || "1", 10);
    const episode = parseInt(q.get("episode") || "1", 10);
    const embed_url =
      type === "movie"
        ? UNLIMPLAY_BASE + "/f/embed/movie/" + id
        : UNLIMPLAY_BASE + "/f/embed/tv/" + id + "/" + season + "/" + episode;

    return {
      type,
      tmdb_id: id,
      season,
      episode,
      title: q.get("title") || "Contenido",
      embed_url,
    };
  } catch (_) {
    return null;
  }
}

function showManual() {
  const manual = $("manualBox");
  if (manual) manual.classList.add("visible");
}

async function initDiscord() {
  setLoading(true);
  setStatus("Conectando con Discord… (" + BUILD + ")");

  try {
    if (IS_DISCORD) {
      patchUrlMappings(
        [
          { prefix: "/bot", target: "camiloh-bot-v2.onrender.com" },
          { prefix: "/unlimplay", target: "unlimplay.com" },
        ],
        {
          patchFetch: true,
          patchWebSocket: true,
          patchXhr: true,
          patchSrcAttributes: true,
        }
      );
    }

    const appId =
      window.__cid && typeof window.__cid.resolve === "function"
        ? window.__cid.resolve()
        : null;

    if (!appId) {
      setLoading(false);
      setStatus("No se pudo resolver la aplicación.", "error");
      showManual();
      return;
    }

    discordSdk = new DiscordSDK(appId);
    await discordSdk.ready();
    setStatus("Activity lista (" + BUILD + ")");

    console.log(
      "[" + BUILD + "] SDK ready channelId=",
      discordSdk.channelId,
      "guildId=",
      discordSdk.guildId
    );

    const channelId = discordSdk.channelId;
    let pending = await loadPendingFromBot(channelId);

    if (!pending) {
      pending = parseQueryFallback();
    }

    if (pending) {
      showPlayer(pending);
      return;
    }

    setLoading(false);
    setStatus(
      "Esperando contenido… Usa /pelicula o /serie en el bot y pulsa Reproducir. (" +
        BUILD +
        ")"
    );
    showManual();
  } catch (err) {
    console.error("[" + BUILD + "] initDiscord error:", err);
    setLoading(false);
    setStatus(
      "Error (" + BUILD + "): " + (err && err.message ? err.message : String(err)),
      "error"
    );
    const fb = parseQueryFallback();
    if (fb) showPlayer(fb);
    else showManual();
  }
}

function manualPlay() {
  const type = ($("manualType") && $("manualType").value) || "movie";
  const id = ($("manualId") && $("manualId").value.trim()) || "";
  if (!id) {
    setStatus("Ingresa un ID de TMDB o IMDB.", "error");
    return;
  }
  const season = parseInt(($("manualSeason") && $("manualSeason").value) || "1", 10);
  const episode = parseInt(($("manualEpisode") && $("manualEpisode").value) || "1", 10);

  const embed_url =
    type === "movie"
      ? UNLIMPLAY_BASE + "/f/embed/movie/" + id
      : UNLIMPLAY_BASE + "/f/embed/tv/" + id + "/" + season + "/" + episode;

  showPlayer({
    type,
    tmdb_id: id,
    season,
    episode,
    title: "ID " + id,
    embed_url,
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = $("manualPlayBtn");
  if (btn) btn.addEventListener("click", manualPlay);
  initDiscord();
});