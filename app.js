/**
 * UnlimPlay Discord Activity
 * Bot API: https://camiloh-bot-v2.onrender.com
 */
(function () {
  "use strict";

  var BOT_API_BASE = "https://camiloh-bot-v2.onrender.com";

  var discordSdk = null;
  var currentEmbedUrl = "";

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(text, kind) {
    var el = $("status");
    if (!el) return;
    el.textContent = text || "";
    el.className = "status" + (kind ? " " + kind : "");
  }

  function setLoading(on) {
    var el = $("loading");
    if (el) el.style.display = on ? "block" : "none";
  }

  function showPlayer(data) {
    if (!data || !data.embed_url) return;

    currentEmbedUrl = data.embed_url;

    var titleEl = $("playerTitle");
    var metaEl = $("playerMeta");
    var wrapper = $("playerWrapper");
    var player = $("player");

    if (titleEl) titleEl.textContent = data.title || "Reproduciendo";

    if (metaEl) {
      if (data.type === "movie") {
        metaEl.textContent = data.year ? String(data.year) : "";
      } else {
        var se = "T" + (data.season || "?") + "E" + (data.episode || "?");
        metaEl.textContent = se + (data.year ? " · " + data.year : "");
      }
    }

    if (wrapper) {
      wrapper.innerHTML =
        '<iframe src="' +
        data.embed_url +
        '" allowfullscreen scrolling="no" ' +
        'allow="autoplay; fullscreen; encrypted-media"></iframe>';
    }

    if (player) player.classList.add("active");
    setStatus("Reproduciendo", "ok");
    setLoading(false);
  }

  function loadPendingFromBot(channelId) {
    if (!BOT_API_BASE || !channelId) {
      return Promise.resolve(null);
    }
    var url =
      BOT_API_BASE.replace(/\/$/, "") +
      "/api/activity/pending?channel_id=" +
      encodeURIComponent(channelId);

    return fetch(url)
      .then(function (res) {
        return res.json();
      })
      .then(function (json) {
        if (json && json.success && json.data && json.data.embed_url) {
          return json.data;
        }
        return null;
      })
      .catch(function (err) {
        console.log("pending fetch error:", err);
        return null;
      });
  }

  function parseQueryFallback() {
    try {
      var q = new URLSearchParams(window.location.search);
      var type = q.get("type") || "movie";
      var id = q.get("tmdb_id") || q.get("id");
      if (!id) return null;

      var season = parseInt(q.get("season") || "1", 10);
      var episode = parseInt(q.get("episode") || "1", 10);
      var base = "https://unlimplay.com/f/embed/";
      var embed_url;

      if (type === "movie") {
        embed_url = base + "movie/" + id;
      } else {
        embed_url = base + "tv/" + id + "/" + season + "/" + episode;
      }

      return {
        type: type,
        tmdb_id: id,
        season: season,
        episode: episode,
        title: q.get("title") || "Contenido",
        embed_url: embed_url
      };
    } catch (_) {
      return null;
    }
  }

  function initDiscord() {
    setLoading(true);
    setStatus("Conectando con Discord…");

    var DiscordSDKCtor =
      (window.DiscordSDK && window.DiscordSDK.DiscordSDK) ||
      (window.DiscordSDK && window.DiscordSDK.default) ||
      window.DiscordSDK;

    if (!DiscordSDKCtor) {
      setLoading(false);
      setStatus("SDK de Discord no disponible. Abre esto como Activity.", "error");
      tryManualFallback();
      return;
    }

    try {
      var appId =
        window.__cid && typeof window.__cid.resolve === "function"
          ? window.__cid.resolve()
          : null;

      if (!appId) {
        setLoading(false);
        setStatus("No se pudo resolver la aplicación.", "error");
        return;
      }

      // Solo Client ID — nunca secret en el cliente
      discordSdk = new DiscordSDKCtor(appId);

      discordSdk
        .ready()
        .then(function () {
          setStatus("Activity lista");

          // Usuario (opcional)
          if (discordSdk.commands && discordSdk.commands.getUser) {
            return discordSdk.commands.getUser().then(function (user) {
              var box = $("userInfo");
              if (box && user) {
                box.style.display = "flex";
                var name = $("userName");
                var avatar = $("userAvatar");
                if (name) name.textContent = user.username || "";
                if (avatar && user.id && user.avatar) {
                  avatar.src =
                    "https://cdn.discordapp.com/avatars/" +
                    user.id +
                    "/" +
                    user.avatar +
                    ".png";
                }
              }
            }).catch(function () {});
          }
        })
        .then(function () {
          var channelId = discordSdk.channelId;
          return loadPendingFromBot(channelId);
        })
        .then(function (pending) {
          if (pending) {
            showPlayer(pending);
            return;
          }
          var fromQuery = parseQueryFallback();
          if (fromQuery) {
            showPlayer(fromQuery);
            return;
          }
          setLoading(false);
          setStatus("Esperando contenido… Usa /pelicula o /serie en el bot.");
          var manual = $("manualBox");
          if (manual) manual.classList.add("visible");
        })
        .catch(function (err) {
          console.log("Discord ready error:", err);
          setLoading(false);
          setStatus("Error al iniciar Activity.", "error");
          tryManualFallback();
        });
    } catch (err) {
      console.log("initDiscord error:", err);
      setLoading(false);
      setStatus("No se pudo inicializar Discord SDK.", "error");
      tryManualFallback();
    }
  }

  function tryManualFallback() {
    var fromQuery = parseQueryFallback();
    if (fromQuery) {
      showPlayer(fromQuery);
      return;
    }
    var manual = $("manualBox");
    if (manual) manual.classList.add("visible");
  }

  // Carga manual (si no hay pending del bot)
  function manualPlay() {
    var typeEl = $("manualType");
    var idEl = $("manualId");
    var seasonEl = $("manualSeason");
    var epEl = $("manualEpisode");

    var type = typeEl ? typeEl.value : "movie";
    var id = idEl ? idEl.value.trim() : "";
    if (!id) {
      setStatus("Ingresa un ID de TMDB o IMDB.", "error");
      return;
    }

    var season = seasonEl ? parseInt(seasonEl.value || "1", 10) : 1;
    var episode = epEl ? parseInt(epEl.value || "1", 10) : 1;
    var base = "https://unlimplay.com/f/embed/";
    var embed_url =
      type === "movie"
        ? base + "movie/" + id
        : base + "tv/" + id + "/" + season + "/" + episode;

    showPlayer({
      type: type,
      tmdb_id: id,
      season: season,
      episode: episode,
      title: "ID " + id,
      embed_url: embed_url
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var btn = $("manualPlayBtn");
    if (btn) btn.addEventListener("click", manualPlay);
    initDiscord();
  });
})();
