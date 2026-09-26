/**
 * UnlimPlay Discord Activity (ES module)
 * El SDK va hosteado en el mismo repo (discord-sdk.mjs) para no depender de CDN.
 */

import { DiscordSDK, patchUrlMappings } from "./discord-sdk.mjs";

const IS_DISCORD = /discordsays\.com$/i.test(window.location.hostname);

// Dentro de Discord: proxy. Fuera: URL directa del bot.
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
    if (u.hostname.includes("unlimplay.com") || url.includes("unlimplay.com")) {
      const path = u.pathname || url.replace(/^https?:\/\/[^/]+/, "");
      return UNLIMPLAY_BASE + path + (u.search || "");
    }
  } catch (_) {}
  // si ya es path relativo /f/embed/...
  if (String(url).startsWith("/f/")) {
    return UNLIMPLAY_BASE + url;
  }
  return url;
}

function showPlayer(data) {
  if (!data || !data.embed_url) return;

  const embedUrl = toProxyEmbed(data.embed_url);

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
  setStatus("Reproduciendo", "ok");
  setLoading(false);

  const manual = $("manualBox");
  if (manual) manual.classList.remove("visible");
}

async function loadPendingFromBot(channelId) {
  if (!channelId) return null;
  const url =
    BOT_API_BASE.replace(/\/$/, "") +
    "/api/activity/pending?channel_id=" +
    encodeURIComponent(channelId);

  console.log("Fetching pending:", url);
  try {
    const res = await fetch(url);
    const json = await res.json();
    console.log("Pending response:", json);
    if (json && json.success && json.data && json.data.embed_url) {
      return json.data;
    }
  } catch (err) {
    console.log("pending fetch error:", err);
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
  setStatus("Conectando con Discord…");

  try {
    if (IS_DISCORD) {
      // Debe coincidir con los mappings del Developer Portal
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
    setStatus("Activity lista");

    console.log("SDK ready. channelId=", discordSdk.channelId, "guildId=", discordSdk.guildId);

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
    setStatus("Esperando contenido… Usa /pelicula o /serie en el bot y pulsa Reproducir.");
    showManual();
  } catch (err) {
    console.error("initDiscord error:", err);
    setLoading(false);
    setStatus(
      "Error al iniciar Activity: " + (err && err.message ? err.message : String(err)),
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
