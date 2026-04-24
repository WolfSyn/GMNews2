// server/index.mjs  —  GMN News API Server
import express from "express";
import cors    from "cors";
import { configDotenv } from "dotenv";
configDotenv();
import sanitizeHtml from "sanitize-html";
import { JSDOM }    from "jsdom";

if (typeof fetch === "undefined") {
  const { default: nodeFetch } = await import("node-fetch");
  globalThis.fetch = nodeFetch;
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// ─────────────────────────────────────────────────────────────
//  ENV
// ─────────────────────────────────────────────────────────────
const GS_API_KEY        = process.env.GAMESPOT_API_KEY;
const YT_API_KEY        = process.env.YT_API_KEY;
const YT_PLAYLIST_ID    = process.env.YT_PLAYLIST_ID || "PLgbyvoUvIMf9Jz3j-JvpOW4CuXKB21Bis";
const TWITCH_CLIENT_ID  = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const STEAM_API_KEY     = process.env.STEAM_API_KEY;

const GS_ARTICLES_BASE = "https://www.gamespot.com/api/articles/";
const GS_REVIEWS_BASE  = "https://www.gamespot.com/api/reviews/";
const GS_RELEASES_BASE = "https://www.gamespot.com/api/releases/";

// ─────────────────────────────────────────────────────────────
//  TWITCH OAuth token cache  (Client-Credentials flow)
//  Token lasts ~60 days; we refresh automatically when expired
// ─────────────────────────────────────────────────────────────
let twitchToken    = null;
let twitchTokenExp = 0;

async function getTwitchToken() {
  if (twitchToken && Date.now() < twitchTokenExp) return twitchToken;

  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    throw new Error("Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET in .env");
  }

  const r = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     TWITCH_CLIENT_ID,
      client_secret: TWITCH_CLIENT_SECRET,
      grant_type:    "client_credentials",
    }),
  });

  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Twitch token error ${r.status}: ${txt}`);
  }

  const j = await r.json();
  twitchToken    = j.access_token;
  twitchTokenExp = Date.now() + (j.expires_in - 300) * 1000; // refresh 5 min early
  console.log("✅ Twitch token refreshed");
  return twitchToken;
}

function twitchHeaders(token) {
  return {
    "Client-ID":     TWITCH_CLIENT_ID,
    "Authorization": `Bearer ${token}`,
    "Content-Type":  "application/json",
  };
}

// ─────────────────────────────────────────────────────────────
//  In-memory cache helper  (avoids hammering APIs on every req)
// ─────────────────────────────────────────────────────────────
const cache = new Map();

function setCache(key, value, ttlMs) {
  cache.set(key, { value, exp: Date.now() + ttlMs });
}
function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.exp) { cache.delete(key); return null; }
  return entry.value;
}

// ─────────────────────────────────────────────────────────────
//  HEALTH
// ─────────────────────────────────────────────────────────────
app.get("/ping", (_req, res) => res.json({ ok: true }));

// ─────────────────────────────────────────────────────────────
//  /api/charts  —  GMN Hot 50
//
//  Strategy:
//    1. Fetch top 50 games by live viewer count from Twitch
//    2. For each game, look up IGDB for cover art + metadata
//    3. For games found on Steam, enrich with current player count
//    4. Calculate a composite GMN Score from the data
//    5. Cache result for 10 minutes to be kind to all three APIs
// ─────────────────────────────────────────────────────────────

// Known Steam App IDs for popular games (we'll auto-detect others via IGDB)
const KNOWN_STEAM_IDS = {
  "Counter-Strike 2":          730,
  "Dota 2":                    570,
  "PUBG: Battlegrounds":       578080,
  "Apex Legends":              1172470,
  "Destiny 2":                 1085660,
  "Team Fortress 2":           440,
  "Rust":                      252490,
  "Warframe":                  230410,
  "Path of Exile":             238960,
  "Path of Exile 2":           2694490,
  "Monster Hunter: World":     582010,
  "Monster Hunter Wilds":      2246340,
  "Elden Ring":                1245620,
  "Cyberpunk 2077":            1091500,
  "Red Dead Redemption 2":     1174180,
  "Grand Theft Auto V":        271590,
  "Baldur's Gate 3":           1086940,
  "Valheim":                   892970,
  "Terraria":                  105600,
  "Minecraft":                 null,   // not on Steam
  "Fortnite":                  null,   // Epic only
  "League of Legends":         null,   // Riot only
  "Valorant":                  null,   // Riot only
  "World of Warcraft":         null,   // Battle.net
  "Overwatch 2":               null,   // Battle.net
  "Diablo IV":                 null,   // Battle.net
  "Marvel Rivals":             2767030,
  "Hollow Knight: Silksong":   1030300,
  "Civilization VII":          1295660,
};

async function fetchSteamPlayers(appId) {
  if (!appId || !STEAM_API_KEY) return null;
  try {
    const url = `https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appId}&key=${STEAM_API_KEY}`;
    const r = await fetch(url, { headers: { "User-Agent": "GMN-News/1.0" } });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.response?.player_count ?? null;
  } catch { return null; }
}

async function fetchIGDBCovers(gameNames, token) {
  // IGDB query: find games by name, return cover art + metadata
  const namesList = gameNames.map(n => `"${n.replace(/"/g, "")}"`).join(",");
  const body = `
    fields name, cover.url, rating, first_release_date, platforms.name;
    where name = (${namesList});
    limit 50;
  `;
  try {
    const r = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: twitchHeaders(token),
      body,
    });
    if (!r.ok) return [];
    return await r.json();
  } catch { return []; }
}

function formatPlayerCount(n) {
  if (!n) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)}K`;
  return String(n);
}

app.get("/api/charts", async (req, res) => {
  const cached = getCache("charts");
  if (cached) return res.json(cached);

  try {
    const token = await getTwitchToken();

    // ── Step 1: Top games on Twitch by viewer count ──
    const twitchRes = await fetch(
      "https://api.twitch.tv/helix/games/top?first=50",
      { headers: twitchHeaders(token) }
    );
    if (!twitchRes.ok) throw new Error(`Twitch top games ${twitchRes.status}`);
    const twitchData = await twitchRes.json();
    const twitchGames = twitchData.data || [];

    // ── Step 2: Get viewer counts per game (via streams endpoint) ──
    // Fetch stream data in batches to get viewer totals per game
    const gameIds = twitchGames.map(g => `game_id=${g.id}`).join("&");
    const streamsRes = await fetch(
      `https://api.twitch.tv/helix/streams?${gameIds}&first=100`,
      { headers: twitchHeaders(token) }
    );
    const streamsData = streamsRes.ok ? await streamsRes.json() : { data: [] };

    // Sum viewer counts per game_id
    const viewersByGameId = {};
    for (const stream of (streamsData.data || [])) {
      viewersByGameId[stream.game_id] = (viewersByGameId[stream.game_id] || 0) + stream.viewer_count;
    }

    // ── Step 3: IGDB cover art for all games ──
    const gameNames = twitchGames.map(g => g.name);
    const igdbGames = await fetchIGDBCovers(gameNames, token);

    // Build lookup: name → IGDB data
    const igdbByName = {};
    for (const g of igdbGames) {
      igdbByName[g.name?.toLowerCase()] = g;
    }

    // ── Step 4: Build chart rows ──
    const chartRows = [];
    let prevRanks = getCache("charts_prev_ranks") || {};

    for (let i = 0; i < twitchGames.length; i++) {
      const tw   = twitchGames[i];
      const rank = i + 1;
      const name = tw.name;

      // Viewer count (from streams batch or Twitch game object)
      const viewers = viewersByGameId[tw.id] || 0;

      // IGDB data
      const igdb      = igdbByName[name.toLowerCase()] || null;
      const coverUrl  = igdb?.cover?.url
        ? igdb.cover.url.replace("t_thumb", "t_cover_big").replace("http://", "https://")
        : null;
      const igdbRating = igdb?.rating ? Math.round(igdb.rating) : null;

      // Steam player count
      const steamId     = KNOWN_STEAM_IDS[name] ?? null;
      const steamCount  = steamId ? await fetchSteamPlayers(steamId) : null;

      // Trend vs last snapshot
      const prevRank = prevRanks[name];
      let trend, trendLabel;
      if (!prevRank)              { trend = "new";  trendLabel = "NEW"; }
      else if (rank < prevRank)   { trend = "up";   trendLabel = `▲ ${prevRank - rank}`; }
      else if (rank > prevRank)   { trend = "down"; trendLabel = `▼ ${rank - prevRank}`; }
      else                        { trend = "same"; trendLabel = "—"; }

      // Twitch thumbnail (box art)
      const twitchThumb = tw.box_art_url
        ? tw.box_art_url.replace("{width}", "120").replace("{height}", "160")
        : null;

      chartRows.push({
        rank,
        name,
        twitchId:    tw.id,
        coverUrl:    coverUrl || twitchThumb,
        viewers,
        viewersLabel: formatPlayerCount(viewers),
        steamPlayers: steamCount,
        steamLabel:   formatPlayerCount(steamCount),
        igdbRating,
        trend,
        trendLabel,
        // bar width = percentage of #1's viewers (capped 100)
        barPct: twitchGames[0] && viewers
          ? Math.round((viewers / (viewersByGameId[twitchGames[0].id] || viewers || 1)) * 100)
          : 0,
      });
    }

    // Save ranks for next poll (trend calculation)
    const newRanks = {};
    for (const row of chartRows) newRanks[row.name] = row.rank;
    setCache("charts_prev_ranks", newRanks, 24 * 60 * 60 * 1000); // keep 24h

    // ── Step 5: Rising games  (biggest rank improvements) ──
    const rising = chartRows
      .filter(r => r.trend === "up" || r.trend === "new")
      .sort((a, b) => {
        const aGain = (prevRanks[a.name] || 51) - a.rank;
        const bGain = (prevRanks[b.name] || 51) - b.rank;
        return bGain - aGain;
      })
      .slice(0, 5)
      .map(r => ({
        name: r.name,
        coverUrl: r.coverUrl,
        gain: (prevRanks[r.name] || 51) - r.rank,
        label: r.trend === "new" ? "NEW" : `+${(prevRanks[r.name] || 51) - r.rank}`,
      }));

    const result = {
      updatedAt: new Date().toISOString(),
      chart: chartRows,
      rising,
    };

    setCache("charts", result, 10 * 60 * 1000); // cache 10 min
    res.json(result);

  } catch (e) {
    console.error("charts error:", e);
    res.status(500).json({ error: e.message || "Failed to build charts" });
  }
});

// ─────────────────────────────────────────────────────────────
//  /api/charts/streams  —  Most Streamed right now (Twitch)
//  Returns top 20 games by total live viewers
// ─────────────────────────────────────────────────────────────
app.get("/api/charts/streams", async (req, res) => {
  const cached = getCache("streams");
  if (cached) return res.json(cached);
  try {
    const token = await getTwitchToken();
    const r = await fetch("https://api.twitch.tv/helix/games/top?first=20", {
      headers: twitchHeaders(token),
    });
    if (!r.ok) throw new Error(`Twitch ${r.status}`);
    const { data } = await r.json();

    const result = (data || []).map((g, i) => ({
      rank:     i + 1,
      name:     g.name,
      coverUrl: g.box_art_url
        ? g.box_art_url.replace("{width}", "80").replace("{height}", "107")
        : null,
    }));

    setCache("streams", result, 5 * 60 * 1000); // 5 min
    res.json(result);
  } catch (e) {
    console.error("streams error:", e);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────
//  /api/charts/releases  —  Recent game releases (IGDB)
// ─────────────────────────────────────────────────────────────
app.get("/api/charts/releases", async (req, res) => {
  const cached = getCache("releases_chart");
  if (cached) return res.json(cached);
  try {
    const token = await getTwitchToken();

    const RECENT = [
      "Monster Hunter Wilds",
      "Assassin's Creed Shadows",
      "Like a Dragon: Pirate Yakuza in Hawaii",
      "Avowed",
      "Kingdom Come: Deliverance II",
      "Split Fiction",
      "Civilization VII",
      "Hogwarts Legacy",
      "Lies of P",
      "Baldur's Gate 3",
    ];

    const namesList = RECENT.map(n => `"${n}"`).join(",");
    const r = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: twitchHeaders(token),
      body: `fields name, cover.url, first_release_date; where name = (${namesList}); limit 10;`,
    });
    if (!r.ok) throw new Error(`IGDB ${r.status}`);
    const games = await r.json();

    const result = RECENT.map((name, i) => {
      const igdb = games.find(g => g.name.toLowerCase() === name.toLowerCase());
      return {
        rank: i + 1,
        name,
        coverUrl: igdb?.cover?.url
          ? igdb.cover.url.replace("t_thumb", "t_cover_big").replace("http://", "https://")
          : null,
        releaseDate: igdb?.first_release_date
          ? new Date(igdb.first_release_date * 1000).toLocaleDateString("en-US", { month: "short", year: "numeric" })
          : "2025",
      };
    });

    setCache("releases_chart", result, 60 * 60 * 1000);
    res.json(result);
  } catch (e) {
    console.error("releases chart error:", e);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────
//  /api/charts/freetoplay  —  Top F2P games (IGDB)
// ─────────────────────────────────────────────────────────────
app.get("/api/charts/freetoplay", async (req, res) => {
  const cached = getCache("ftp_chart");
  if (cached) return res.json(cached);
  try {
    const token = await getTwitchToken();
    const body = `
      fields name, cover.url, rating, platforms.name;
      where game_modes.name = "Massively Multiplayer Online"
        | game_modes.name = "Multiplayer";
      sort rating desc;
      limit 10;
    `;
    // Use Twitch top games and filter for known F2P titles as IGDB
    // doesn't have a "free" price field we can reliably filter on
    const KNOWN_F2P = [
      "Fortnite", "Apex Legends", "Valorant", "League of Legends",
      "Warframe", "Destiny 2", "Path of Exile 2", "Genshin Impact",
      "Marvel Rivals", "Counter-Strike 2",
    ];

    const namesList = KNOWN_F2P.map(n => `"${n}"`).join(",");
    const r = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: twitchHeaders(token),
      body: `fields name, cover.url, rating; where name = (${namesList}); limit 10;`,
    });
    if (!r.ok) throw new Error(`IGDB ${r.status}`);
    const games = await r.json();

    // Sort by rating desc, keep known order as fallback
    const sorted = KNOWN_F2P
      .map(name => {
        const igdb = games.find(g => g.name.toLowerCase() === name.toLowerCase());
        return { name, coverUrl: igdb?.cover?.url?.replace("t_thumb","t_cover_big").replace("http://","https://") || null };
      });

    setCache("ftp_chart", sorted, 60 * 60 * 1000); // 1 hour
    res.json(sorted.map((g, i) => ({ rank: i + 1, ...g })));
  } catch (e) {
    console.error("f2p chart error:", e);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────
//  /api/charts/gmnscore  —  GMN Score of the Month
//  Picks the highest-rated recent game from IGDB
// ─────────────────────────────────────────────────────────────
app.get("/api/charts/gmnscore", async (req, res) => {
  const cached = getCache("gmnscore");
  if (cached) return res.json(cached);
  try {
    const token = await getTwitchToken();

    // Pick the GMN Score game by name — update monthly
    const SCORE_GAME = "Pragmata";

    const r = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: twitchHeaders(token),
      body: `fields name, cover.url, rating, aggregated_rating, platforms.name, involved_companies.company.name, summary; where name = "${SCORE_GAME}"; limit 1;`,
    });
    if (!r.ok) throw new Error(`IGDB ${r.status}`);
    const games = await r.json();
    const game = games[0];
    if (!game) throw new Error("No game found");

    const agg = game.aggregated_rating || 85;
    const usr = game.rating || agg;
    const gmnScore = Math.round((agg + usr) / 2);

    const developer = game.involved_companies?.[0]?.company?.name || "Capcom";
    const platforms = (game.platforms || []).map(p => p.name).slice(0, 3).join(", ") || "PS5, Xbox, PC";
    const coverUrl  = game.cover?.url
      ? game.cover.url.replace("t_thumb", "t_cover_big").replace("http://", "https://")
      : null;

    const result = {
      name: game.name,
      coverUrl,
      developer,
      platforms,
      gmnScore,
      summary: game.summary?.slice(0, 160) || "",
      breakdown: [
        { label: "Critics", val: Math.round(agg), color: "var(--gold)"  },
        { label: "Players", val: Math.round(usr), color: "var(--blue)"  },
        { label: "GMN",     val: gmnScore,         color: "var(--green)" },
      ],
    };

    setCache("gmnscore", result, 60 * 60 * 1000);
    res.json(result);
  } catch (e) {
    console.error("gmnscore error:", e);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────
//  /api/games/search  —  Search IGDB for any game by name
// ─────────────────────────────────────────────────────────────
app.get("/api/games/search", async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) return res.json([]);
  const cacheKey = `game_search_${q.toLowerCase()}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);
  try {
    const token = await getTwitchToken();
    const r = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: twitchHeaders(token),
      body: `
        fields name, cover.url, platforms.name, first_release_date;
        search "${q.replace(/"/g, "")}";
        where version_parent = null;
        limit 10;
      `,
    });
    if (!r.ok) throw new Error(`IGDB ${r.status}`);
    const games = await r.json();
    const results = games.map(g => ({
      name: g.name,
      coverUrl: g.cover?.url
        ? ("https:" + g.cover.url.replace("t_thumb", "t_cover_big")).replace("https:https:", "https:")
        : null,
      platforms: (g.platforms || []).map(p => p.name).slice(0, 3).join(", ") || null,
      year: g.first_release_date
        ? new Date(g.first_release_date * 1000).getFullYear()
        : null,
    }));
    setCache(cacheKey, results, 10 * 60 * 1000);
    res.json(results);
  } catch (e) {
    console.error("game search error:", e);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────
//  GAMESPOT ENDPOINTS  (unchanged from your original)
// ─────────────────────────────────────────────────────────────
function pickImage(img) {
  if (!img) return null;
  return img.original || img.super_url || img.medium_url || img.small_url ||
         img.square_medium || img.square_small || img.thumb_url || img.tiny_url || null;
}

app.get("/api/articles", async (req, res) => {
  try {
    const limit  = req.query.limit  ? Number(req.query.limit)  : 20;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const url = new URL(GS_ARTICLES_BASE);
    url.searchParams.append("api_key", GS_API_KEY);
    url.searchParams.append("format",  "json");
    url.searchParams.append("sort",    "publish_date:desc");
    url.searchParams.append("limit",   String(limit));
    url.searchParams.append("offset",  String(offset));
    const r = await fetch(url.toString(), { headers: { "User-Agent": "GMN-News/1.0 (+server)" } });
    if (!r.ok) return res.status(502).json({ error: `Upstream ${r.status}` });
    const j = await r.json();
    const articles = (j.results || []).map(a => ({
      title: a.title,
      link:  a.site_detail_url,
      date:  a.publish_date?.slice(0, 10),
      deck:  a.deck,
      image: pickImage(a.image),
    }));
    res.json({ articles, paging: { limit, offset, count: articles.length, hasMore: articles.length === limit } });
  } catch (e) { res.status(500).json({ error: "Failed to fetch" }); }
});

// ─────────────────────────────────────────────────────────────
//  /api/articles/search  —  Search GameSpot articles by keyword
// ─────────────────────────────────────────────────────────────
app.get("/api/articles/search", async (req, res) => {
  try {
    const q      = req.query.q || "";
    const limit  = req.query.limit  ? Number(req.query.limit)  : 20;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    if (!q.trim()) return res.json({ articles: [], paging: { count: 0, hasMore: false } });

    const url = new URL(GS_ARTICLES_BASE);
    url.searchParams.append("api_key", GS_API_KEY);
    url.searchParams.append("format",  "json");
    url.searchParams.append("sort",    "publish_date:desc");
    url.searchParams.append("limit",   String(limit));
    url.searchParams.append("offset",  String(offset));
    // GameSpot filter param: search by title
    url.searchParams.append("filter",  `title:${q}`);

    const r = await fetch(url.toString(), { headers: { "User-Agent": "GMN-News/1.0 (+server)" } });
    if (!r.ok) return res.status(502).json({ error: `Upstream ${r.status}` });
    const j = await r.json();
    const articles = (j.results || []).map(a => ({
      title: a.title,
      link:  a.site_detail_url,
      date:  a.publish_date?.slice(0, 10),
      deck:  a.deck,
      image: pickImage(a.image),
    }));
    res.json({ articles, paging: { limit, offset, count: articles.length, hasMore: articles.length === limit } });
  } catch (e) { res.status(500).json({ error: "Search failed" }); }
});

app.get("/api/reviews", async (req, res) => {
  try {
    const limit  = req.query.limit  ? Number(req.query.limit)  : 20;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const url = new URL(GS_REVIEWS_BASE);
    url.searchParams.append("api_key",    GS_API_KEY);
    url.searchParams.append("format",     "json");
    url.searchParams.append("sort",       "publish_date:desc");
    url.searchParams.append("limit",      String(limit));
    url.searchParams.append("offset",     String(offset));
    url.searchParams.append("field_list", "title,deck,publish_date,image,site_detail_url,score,authors");
    const r = await fetch(url.toString(), { headers: { "User-Agent": "GMN-News/1.0 (+server)" } });
    if (!r.ok) return res.status(502).json({ error: `Upstream ${r.status}` });
    const j = await r.json();
    const articles = (j.results || []).map(rv => ({
      title:  rv.title,
      link:   rv.site_detail_url,
      date:   rv.publish_date?.slice(0, 10),
      deck:   rv.deck,
      image:  pickImage(rv.image),
      score:  rv.score ?? null,
      byline: Array.isArray(rv.authors)
        ? rv.authors.map(a => a?.name).filter(Boolean).join(", ") || null
        : rv.authors || null,
    }));
    res.json({ articles, paging: { limit, offset, count: articles.length, hasMore: articles.length === limit } });
  } catch (e) { res.status(500).json({ error: "Failed to fetch reviews" }); }
});

app.get("/api/releases", async (req, res) => {
  try {
    const limit  = req.query.limit  ? Number(req.query.limit)  : 20;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const url = new URL(GS_RELEASES_BASE);
    url.searchParams.append("api_key",    GS_API_KEY);
    url.searchParams.append("format",     "json");
    url.searchParams.append("sort",       "release_date:desc");
    url.searchParams.append("limit",      String(limit));
    url.searchParams.append("offset",     String(offset));
    url.searchParams.append("field_list", "name,title,release_date,image,site_detail_url,platforms");
    const r = await fetch(url.toString(), { headers: { "User-Agent": "GMN-News/1.0 (+server)" } });
    if (!r.ok) return res.status(502).json({ error: `Upstream ${r.status}` });
    const j = await r.json();
    const releases = (j.results || []).map(it => ({
      title:    it.name || it.title || "Untitled",
      link:     it.site_detail_url,
      date:     it.release_date?.slice(0, 10) || it.publish_date?.slice(0, 10) || null,
      deck:     (() => {
        const p = [].concat(it.platforms || it.platform || [])
          .map(p => typeof p === "string" ? p : p?.name).filter(Boolean).join(", ");
        return p ? `Platforms: ${p}` : null;
      })(),
      image:    pickImage(it.image) || null,
    }));
    res.json({ articles: releases, paging: { limit, offset, count: releases.length, hasMore: releases.length === limit } });
  } catch (e) { res.status(500).json({ error: "Failed to fetch releases" }); }
});

app.get("/api/article", async (req, res) => {
  try {
    const articleUrl = req.query.url;
    if (!articleUrl) return res.status(400).json({ error: "Missing url param" });
    const u = new URL(articleUrl);
    if (!u.hostname.endsWith("gamespot.com"))
      return res.status(400).json({ error: "Only GameSpot URLs are allowed" });
    const htmlResp = await fetch(articleUrl, { headers: { "User-Agent": "GMN-Reader/1.0 (+server)" } });
    if (!htmlResp.ok) return res.status(502).json({ error: `Upstream ${htmlResp.status}` });
    const html = await htmlResp.text();
    const dom  = new JSDOM(html, { url: articleUrl });
    const { Readability } = await import("@mozilla/readability");
    const parsed = new Readability(dom.window.document).parse();
    if (!parsed) return res.status(500).json({ error: "Unable to parse article" });
    const clean = sanitizeHtml(parsed.content, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "figure", "figcaption"]),
      allowedAttributes: {
        a:   ["href", "name", "target", "rel"],
        img: ["src", "alt", "title"],
        "*": ["id", "class", "style"],
      },
      transformTags: { a: (tag, attribs) => ({ tagName: "a", attribs: { ...attribs, target: "_blank", rel: "noopener" } }) },
    });
    res.json({
      title:    parsed.title,
      byline:   parsed.byline || null,
      excerpt:  parsed.excerpt || null,
      siteName: parsed.siteName || "GameSpot",
      leadImage: dom.window.document.querySelector('meta[property="og:image"]')?.content ||
                 dom.window.document.querySelector('meta[name="twitter:image"]')?.content || null,
      html: clean,
    });
  } catch (e) { res.status(500).json({ error: "Reader failed" }); }
});

app.get("/api/videos", async (req, res) => {
  try {
    if (!YT_API_KEY) return res.status(500).json({ error: "Missing YT_API_KEY" });
    const playlistId = (req.query.playlistId || YT_PLAYLIST_ID).trim();
    const limit      = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
    const pageToken  = (req.query.cursor || req.query.pageToken || "").trim();
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    url.searchParams.set("part",       "snippet,contentDetails");
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("maxResults", String(limit));
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    url.searchParams.set("key", YT_API_KEY);
    const r = await fetch(url.toString(), { headers: { "User-Agent": "GMN-News/1.0 (+server)" } });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      return res.status(r.status).json({ error: "YouTube error", details: d });
    }
    const j = await r.json();
    const items = (j.items || []).map(it => {
      const s  = it.snippet || {};
      const cd = it.contentDetails || {};
      const id = cd.videoId || s.resourceId?.videoId || null;
      const t  = s.thumbnails || {};
      return {
        id,
        title:        s.title || "Untitled",
        description:  s.description || "",
        publishedAt:  cd.videoPublishedAt || s.publishedAt || null,
        channelTitle: s.channelTitle || "",
        thumb:        t.maxres?.url || t.standard?.url || t.high?.url || t.medium?.url || t.default?.url || null,
        url:          id ? `https://www.youtube.com/watch?v=${id}` : null,
      };
    });
    res.json({
      items,
      paging: { limit, nextPageToken: j.nextPageToken || null, prevPageToken: j.prevPageToken || null },
    });
  } catch (e) { res.status(500).json({ error: "Failed to fetch videos" }); }
});

app.get("/", (_req, res) => res.type("text").send("GMN API OK"));

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🎮 GMN News API → http://localhost:${PORT}`);
  console.log(`   Twitch:  ${TWITCH_CLIENT_ID  ? "✅ key found" : "❌ MISSING"}`);
  console.log(`   Steam:   ${STEAM_API_KEY     ? "✅ key found" : "❌ MISSING"}`);
  console.log(`   YouTube: ${YT_API_KEY        ? "✅ key found" : "❌ MISSING"}`);
  console.log(`   GameSpot:${GS_API_KEY        ? "✅ key found" : "❌ MISSING"}\n`);
});
