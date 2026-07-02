// server/index.mjs  —  GMN News API Server (v3 — RSS Edition)
import express from "express";
import cors    from "cors";
import { configDotenv } from "dotenv";
configDotenv();
import sanitizeHtml from "sanitize-html";
import { JSDOM }    from "jsdom";
import { XMLParser } from "fast-xml-parser";
import { createClient } from "@supabase/supabase-js";

if (typeof fetch === "undefined") {
  const { default: nodeFetch } = await import("node-fetch");
  globalThis.fetch = nodeFetch;
}

// ─────────────────────────────────────────────────────────────
//  SUPABASE CLIENT (server-side, service role)
// ─────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// ─────────────────────────────────────────────────────────────
//  ENV
// ─────────────────────────────────────────────────────────────
const YT_API_KEY          = process.env.YT_API_KEY;
const YT_PLAYLIST_ID      = process.env.YT_PLAYLIST_ID || "PLgbyvoUvIMf9Jz3j-JvpOW4CuXKB21Bis";
const TWITCH_CLIENT_ID    = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const STEAM_API_KEY       = process.env.STEAM_API_KEY;

// ─────────────────────────────────────────────────────────────
//  RSS FEED SOURCES
// ─────────────────────────────────────────────────────────────
const RSS_FEEDS = [
  {
    name:     "IGN",
    url:      "https://feeds.feedburner.com/ign/games-all",
    fallback: "https://www.ign.com/rss/articles/games",
    color:    "#ff3a00",
  },
  {
    name:     "Polygon",
    url:      "https://www.polygon.com/rss/index.xml",
    color:    "#ef2d30",
  },
  {
    name:     "Kotaku",
    url:      "https://kotaku.com/rss",
    color:    "#00a550",
  },
  {
    name:     "Eurogamer",
    url:      "https://www.eurogamer.net/?format=rss",
    color:    "#f7cf00",
  },
  {
    name:     "PC Gamer",
    url:      "https://www.pcgamer.com/rss/",
    color:    "#e2001a",
  },
  {
    name:     "GameRant",
    url:      "https://gamerant.com/feed/",
    color:    "#e85d04",
  },
  {
    name:     "Rock Paper Shotgun",
    url:      "https://www.rockpapershotgun.com/feed",
    color:    "#6d6875",
  },
  {
    name:     "Destructoid",
    url:      "https://www.destructoid.com/feed/",
    color:    "#1db954",
  },
  {
    name:     "VGC",
    url:      "https://www.videogameschronicle.com/feed/",
    color:    "#0ea5e9",
  },
  {
    name:     "GamesRadar",
    url:      "https://www.gamesradar.com/rss/",
    color:    "#7c3aed",
  },
  {
    name:     "Insider Gaming",
    url:      "https://insidergaming.com/feed/",
    color:    "#f59e0b",
  },
  {
    name:     "Dot Esports",
    url:      "https://dotesports.com/feed",
    color:    "#3b82f6",
  },
];

// ─────────────────────────────────────────────────────────────
//  RSS PARSER
// ─────────────────────────────────────────────────────────────
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: true,
  trimValues: true,
});

function parseDate(raw) {
  if (!raw) return null;
  try { return new Date(raw).toISOString(); } catch { return null; }
}

function extractImage(item) {
  // Try media:content, media:thumbnail, enclosure, then og image in content
  if (item["media:content"]?.["@_url"]) return item["media:content"]["@_url"];
  if (item["media:thumbnail"]?.["@_url"]) return item["media:thumbnail"]["@_url"];
  if (item.enclosure?.["@_url"] && item.enclosure["@_url"].match(/\.(jpg|jpeg|png|webp)/i))
    return item.enclosure["@_url"];
  // Try to extract first img src from content
  const html = item["content:encoded"] || item.description || "";
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (match) return match[1];
  return null;
}

function extractDeck(item) {
  const raw = item.description || item["content:encoded"] || "";
  // Strip HTML tags and truncate
  const text = raw.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 200) + (text.length > 200 ? "…" : "") : null;
}

async function fetchRSSFeed(feed) {
  const urls = [feed.url, feed.fallback].filter(Boolean);
  for (const url of urls) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": "GMN-News/3.0 (+https://gmnnews.org)" },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) continue;
      const xml  = await r.text();
      const parsed = xmlParser.parse(xml);
      const channel = parsed?.rss?.channel || parsed?.feed;
      if (!channel) continue;

      // Handle both RSS 2.0 and Atom formats
      const items = channel.item || channel.entry || [];
      const arr   = Array.isArray(items) ? items : [items];

      return arr.slice(0, 20).map(item => ({
        title:     item.title?.["#text"] || item.title || "Untitled",
        link:      item.link?.["@_href"] || item.link?.["#text"] || item.link || null,
        date:      parseDate(item.pubDate || item.published || item.updated),
        deck:      extractDeck(item),
        image:     extractImage(item),
        source:    feed.name,
        sourceColor: feed.color,
      })).filter(a => a.link);
    } catch (e) {
      console.warn(`RSS fetch failed for ${feed.name} (${url}):`, e.message);
    }
  }
  return []; // graceful empty on total failure
}

// ─────────────────────────────────────────────────────────────
//  TWITCH OAuth token cache
// ─────────────────────────────────────────────────────────────
let twitchToken    = null;
let twitchTokenExp = 0;

async function getTwitchToken() {
  if (twitchToken && Date.now() < twitchTokenExp) return twitchToken;

  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET)
    throw new Error("Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET in .env");

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
  twitchTokenExp = Date.now() + (j.expires_in - 300) * 1000;
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
//  In-memory cache helper
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
//  /api/news  —  Latest gaming news from all RSS sources
//  Merged, deduped, sorted by date
// ─────────────────────────────────────────────────────────────
app.get("/api/articles", async (req, res) => {
  const source = req.query.source || "all"; // filter by source name
  const limit  = Math.min(100, Number(req.query.limit)  || 20);
  const offset = Number(req.query.offset) || 0;

  const cacheKey = `articles_${source}`;
  const cached   = getCache(cacheKey);

  try {
    let articles;
    if (cached) {
      articles = cached;
    } else {
      // Fetch all feeds in parallel
      const feeds   = source === "all"
        ? RSS_FEEDS
        : RSS_FEEDS.filter(f => f.name.toLowerCase() === source.toLowerCase());

      const results = await Promise.allSettled(feeds.map(fetchRSSFeed));
      const all     = results.flatMap(r => r.status === "fulfilled" ? r.value : []);

      // Dedupe by link, sort newest first
      const seen = new Set();
      articles = all
        .filter(a => { if (seen.has(a.link)) return false; seen.add(a.link); return true; })
        .sort((a, b) => {
          if (!a.date && !b.date) return 0;
          if (!a.date) return 1;
          if (!b.date) return -1;
          return new Date(b.date) - new Date(a.date);
        });

      setCache(cacheKey, articles, 10 * 60 * 1000); // 10 min cache
    }

    const page   = articles.slice(offset, offset + limit);
    res.json({
      articles: page,
      paging: {
        limit,
        offset,
        total:   articles.length,
        hasMore: offset + limit < articles.length,
      },
      sources: RSS_FEEDS.map(f => f.name),
    });
  } catch (e) {
    console.error("news error:", e);
    res.status(500).json({ error: "Failed to fetch news" });
  }
});

// ─────────────────────────────────────────────────────────────
//  /api/articles/sources  —  List available news sources
// ─────────────────────────────────────────────────────────────
app.get("/api/articles/sources", (_req, res) => {
  res.json(RSS_FEEDS.map(f => ({ name: f.name, color: f.color })));
});

// ─────────────────────────────────────────────────────────────
//  /api/articles/search  —  Search articles by keyword (client-side filter on cached data)
// ─────────────────────────────────────────────────────────────
app.get("/api/articles/search", async (req, res) => {
  const q      = (req.query.q || "").trim();
  const limit  = Math.min(100, Number(req.query.limit) || 20);
  const offset = Number(req.query.offset) || 0;

  if (!q) return res.json({ articles: [], paging: { total: 0, hasMore: false } });

  const cacheKey = `search_${q.toLowerCase()}`;
  const cached   = getCache(cacheKey);
  if (cached) {
    const page = cached.slice(offset, offset + limit);
    return res.json({ articles: page, paging: { limit, offset, total: cached.length, hasMore: offset + limit < cached.length } });
  }

  try {
    // Search Supabase archive first (has historical articles)
    const { data: dbArticles, error } = await supabase
      .from("articles")
      .select("title, link, date, image, deck, source, source_color")
      .or(`title.ilike.%${q}%,deck.ilike.%${q}%,source.ilike.%${q}%`)
      .order("date", { ascending: false })
      .range(offset, offset + limit - 1);

    if (!error && dbArticles && dbArticles.length > 0) {
      // Get total count for pagination
      const { count } = await supabase
        .from("articles")
        .select("*", { count: "exact", head: true })
        .or(`title.ilike.%${q}%,deck.ilike.%${q}%,source.ilike.%${q}%`);

      const articles = dbArticles.map(a => ({
        title:       a.title,
        link:        a.link,
        date:        a.date,
        image:       a.image,
        deck:        a.deck,
        source:      a.source,
        sourceColor: a.source_color,
      }));

      setCache(cacheKey, articles, 5 * 60 * 1000);
      return res.json({
        articles,
        paging: { limit, offset, total: count || articles.length, hasMore: offset + limit < (count || 0) },
        source: "archive",
      });
    }

    // Fallback: search live RSS feeds if Supabase has no results yet
    const results  = await Promise.allSettled(RSS_FEEDS.map(fetchRSSFeed));
    const all      = results.flatMap(r => r.status === "fulfilled" ? r.value : []);
    const lower    = q.toLowerCase();
    const seen     = new Set();
    const matched  = all
      .filter(a => {
        if (!a.link || seen.has(a.link)) return false;
        seen.add(a.link);
        return (
          a.title?.toLowerCase().includes(lower) ||
          a.deck?.toLowerCase().includes(lower) ||
          a.source?.toLowerCase().includes(lower)
        );
      })
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    setCache(cacheKey, matched, 15 * 60 * 1000);
    res.json({
      articles: matched.slice(offset, offset + limit),
      paging: { limit, offset, total: matched.length, hasMore: offset + limit < matched.length },
      source: "live",
    });
  } catch (e) {
    console.error("news search error:", e);
    res.status(500).json({ error: "Search failed" });
  }
});

// ─────────────────────────────────────────────────────────────
//  /api/games/top200  —  Top 200 Twitch games for search
// ─────────────────────────────────────────────────────────────
app.get("/api/games/top200", async (req, res) => {
  const cached = getCache("games_top200");
  if (cached) return res.json(cached);
  try {
    const token = await getTwitchToken();

    // Fetch 2 pages of 100 = top 200
    let cursor = null;
    let allGames = [];
    for (let page = 0; page < 2; page++) {
      const url = new URL("https://api.twitch.tv/helix/games/top");
      url.searchParams.set("first", "100");
      if (cursor) url.searchParams.set("after", cursor);
      const r = await fetch(url.toString(), {
        headers: twitchHeaders(token),
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) break;
      const j = await r.json();
      allGames = [...allGames, ...(j.data || [])];
      cursor = j.pagination?.cursor;
      if (!cursor) break;
    }

    const results = allGames.map((g, i) => ({
      rank:     i + 1,
      name:     g.name,
      twitchId: g.id,
      coverUrl: g.box_art_url
        ? g.box_art_url.replace("{width}", "120").replace("{height}", "160")
        : null,
    }));

    setCache("games_top200", results, 10 * 60 * 1000);
    res.json(results);
  } catch (e) {
    console.error("top200 error:", e);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────
//  /api/article  —  Full article reader (scrape any gaming URL)
// ─────────────────────────────────────────────────────────────
const ALLOWED_DOMAINS = [
  "ign.com", "polygon.com", "kotaku.com",
  "eurogamer.net", "pcgamer.com", "gamespot.com",
  "gamesradar.com", "rockpapershotgun.com",
];

app.get("/api/article", async (req, res) => {
  try {
    const articleUrl = req.query.url;
    if (!articleUrl) return res.status(400).json({ error: "Missing url param" });

    const u = new URL(articleUrl);
    if (!["http:", "https:"].includes(u.protocol))
      return res.status(400).json({ error: "Invalid URL protocol" });

    // For Google News URLs — fetch the page to get the real redirect URL from HTML meta
    let finalUrl = articleUrl;
    if (u.hostname.includes("news.google.com")) {
      try {
        const gnResp = await fetch(articleUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36" },
          redirect: "follow",
          signal: AbortSignal.timeout(8000),
        });
        // Try to extract real URL from the response URL or meta refresh
        if (gnResp.url && !gnResp.url.includes("news.google.com")) {
          finalUrl = gnResp.url;
        } else {
          const html = await gnResp.text();
          const metaMatch = html.match(/url=([^"&']+)/i) || html.match(/href="(https?:\/\/(?!news\.google)[^"]+)"/);
          if (metaMatch) finalUrl = decodeURIComponent(metaMatch[1]);
        }
      } catch {}
    }

    // Fetch the real article
    const htmlResp = await fetch(finalUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36" },
      signal: AbortSignal.timeout(10000),
    });

    // Check if site allows iframing (for fallback in frontend)
    const xFrameOptions = htmlResp.headers.get("x-frame-options") || "";
    const csp = htmlResp.headers.get("content-security-policy") || "";
    const allowsIframe = !xFrameOptions && !csp.includes("frame-ancestors");

    if (!htmlResp.ok) {
      // Return iframe fallback info so frontend can show iframe or redirect button
      return res.status(200).json({
        iframeFallback: true,
        allowsIframe,
        finalUrl,
        title: null,
      });
    }

    const html   = await htmlResp.text();
    const dom    = new JSDOM(html, { url: finalUrl });
    const { Readability } = await import("@mozilla/readability");
    const parsed = new Readability(dom.window.document).parse();

    // If Readability cant parse it, return iframe fallback
    if (!parsed) {
      return res.status(200).json({
        iframeFallback: true,
        allowsIframe,
        finalUrl,
        title: dom.window.document.title || null,
      });
    }

    const clean = sanitizeHtml(parsed.content, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "figure", "figcaption"]),
      allowedAttributes: {
        a:   ["href", "name", "target", "rel"],
        img: ["src", "alt", "title"],
        "*": ["id", "class"],
      },
      transformTags: {
        a: (tag, attribs) => ({ tagName: "a", attribs: { ...attribs, target: "_blank", rel: "noopener" } }),
      },
    });

    res.json({
      iframeFallback: false,
      allowsIframe,
      finalUrl,
      title:     parsed.title,
      byline:    parsed.byline   || null,
      excerpt:   parsed.excerpt  || null,
      siteName:  parsed.siteName || u.hostname,
      leadImage: dom.window.document.querySelector('meta[property="og:image"]')?.content ||
                 dom.window.document.querySelector('meta[name="twitter:image"]')?.content || null,
      html: clean,
    });
  } catch (e) {
    console.error("article reader error:", e);
    res.status(500).json({ error: "Reader failed" });
  }
});

// ─────────────────────────────────────────────────────────────
//  /api/charts  —  GMN Hot 50
// ─────────────────────────────────────────────────────────────
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
  "Minecraft":                 null,
  "Fortnite":                  null,
  "League of Legends":         null,
  "Valorant":                  null,
  "World of Warcraft":         null,
  "Overwatch 2":               null,
  "Diablo IV":                 null,
  "Marvel Rivals":             2767030,
  "Hollow Knight: Silksong":   1030300,
  "Civilization VII":          1295660,
};

async function fetchSteamPlayers(appId) {
  if (!appId || !STEAM_API_KEY) return null;
  try {
    const url = `https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appId}&key=${STEAM_API_KEY}`;
    const r = await fetch(url, {
      headers: { "User-Agent": "GMN-News/3.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.response?.player_count ?? null;
  } catch { return null; }
}

async function fetchIGDBCovers(gameNames, token) {
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
      signal: AbortSignal.timeout(8000),
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

    const twitchRes = await fetch(
      "https://api.twitch.tv/helix/games/top?first=50",
      { headers: twitchHeaders(token), signal: AbortSignal.timeout(8000) }
    );
    if (!twitchRes.ok) throw new Error(`Twitch top games ${twitchRes.status}`);
    const twitchData  = await twitchRes.json();
    const twitchGames = twitchData.data || [];

    const gameIds = twitchGames.map(g => `game_id=${g.id}`).join("&");
    const streamsRes = await fetch(
      `https://api.twitch.tv/helix/streams?${gameIds}&first=100`,
      { headers: twitchHeaders(token), signal: AbortSignal.timeout(8000) }
    );
    const streamsData = streamsRes.ok ? await streamsRes.json() : { data: [] };

    const viewersByGameId = {};
    for (const stream of (streamsData.data || [])) {
      viewersByGameId[stream.game_id] = (viewersByGameId[stream.game_id] || 0) + stream.viewer_count;
    }

    const gameNames = twitchGames.map(g => g.name);
    const igdbGames = await fetchIGDBCovers(gameNames, token);

    const igdbByName = {};
    for (const g of igdbGames) igdbByName[g.name?.toLowerCase()] = g;

    const chartRows  = [];
    let   prevRanks  = getCache("charts_prev_ranks") || {};

    for (let i = 0; i < twitchGames.length; i++) {
      const tw   = twitchGames[i];
      const rank = i + 1;
      const name = tw.name;

      const viewers    = viewersByGameId[tw.id] || 0;
      const igdb       = igdbByName[name.toLowerCase()] || null;
      const coverUrl   = igdb?.cover?.url
        ? igdb.cover.url.replace("t_thumb", "t_cover_big").replace("http://", "https://")
        : null;
      const igdbRating = igdb?.rating ? Math.round(igdb.rating) : null;
      const steamId    = KNOWN_STEAM_IDS[name] ?? null;
      const steamCount = steamId ? await fetchSteamPlayers(steamId) : null;

      const prevRank = prevRanks[name];
      let trend, trendLabel;
      if (!prevRank)            { trend = "new";  trendLabel = "NEW"; }
      else if (rank < prevRank) { trend = "up";   trendLabel = `▲ ${prevRank - rank}`; }
      else if (rank > prevRank) { trend = "down"; trendLabel = `▼ ${rank - prevRank}`; }
      else                      { trend = "same"; trendLabel = "—"; }

      const twitchThumb = tw.box_art_url
        ? tw.box_art_url.replace("{width}", "120").replace("{height}", "160")
        : null;

      chartRows.push({
        rank,
        name,
        twitchId:     tw.id,
        coverUrl:     coverUrl || twitchThumb,
        viewers,
        viewersLabel: formatPlayerCount(viewers),
        steamPlayers: steamCount,
        steamLabel:   formatPlayerCount(steamCount),
        igdbRating,
        trend,
        trendLabel,
        barPct: twitchGames[0] && viewers
          ? Math.round((viewers / (viewersByGameId[twitchGames[0].id] || viewers || 1)) * 100)
          : 0,
      });
    }

    const newRanks = {};
    for (const row of chartRows) newRanks[row.name] = row.rank;
    setCache("charts_prev_ranks", newRanks, 24 * 60 * 60 * 1000);

    const rising = chartRows
      .filter(r => r.trend === "up" || r.trend === "new")
      .sort((a, b) => {
        const aGain = (prevRanks[a.name] || 51) - a.rank;
        const bGain = (prevRanks[b.name] || 51) - b.rank;
        return bGain - aGain;
      })
      .slice(0, 5)
      .map(r => ({
        name:     r.name,
        coverUrl: r.coverUrl,
        gain:     (prevRanks[r.name] || 51) - r.rank,
        label:    r.trend === "new" ? "NEW" : `+${(prevRanks[r.name] || 51) - r.rank}`,
      }));

    const result = { updatedAt: new Date().toISOString(), chart: chartRows, rising };
    setCache("charts", result, 10 * 60 * 1000);
    res.json(result);

  } catch (e) {
    console.error("charts error:", e);
    res.status(500).json({ error: e.message || "Failed to build charts" });
  }
});

// ─────────────────────────────────────────────────────────────
//  /api/charts/streams
// ─────────────────────────────────────────────────────────────
app.get("/api/charts/streams", async (req, res) => {
  const cached = getCache("streams");
  if (cached) return res.json(cached);
  try {
    const token = await getTwitchToken();
    const r = await fetch("https://api.twitch.tv/helix/games/top?first=20", {
      headers: twitchHeaders(token),
      signal: AbortSignal.timeout(8000),
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
    setCache("streams", result, 5 * 60 * 1000);
    res.json(result);
  } catch (e) {
    console.error("streams error:", e);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────
//  /api/charts/releases
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
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`IGDB ${r.status}`);
    const games  = await r.json();
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
//  /api/charts/freetoplay
// ─────────────────────────────────────────────────────────────
app.get("/api/charts/freetoplay", async (req, res) => {
  const cached = getCache("ftp_chart");
  if (cached) return res.json(cached);
  try {
    const token = await getTwitchToken();
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
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`IGDB ${r.status}`);
    const games  = await r.json();
    const sorted = KNOWN_F2P.map(name => {
      const igdb = games.find(g => g.name.toLowerCase() === name.toLowerCase());
      return {
        name,
        coverUrl: igdb?.cover?.url
          ?.replace("t_thumb", "t_cover_big").replace("http://", "https://") || null,
      };
    });
    setCache("ftp_chart", sorted, 60 * 60 * 1000);
    res.json(sorted.map((g, i) => ({ rank: i + 1, ...g })));
  } catch (e) {
    console.error("f2p chart error:", e);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────
//  /api/charts/gmnscore
// ─────────────────────────────────────────────────────────────
app.get("/api/charts/gmnscore", async (req, res) => {
  const cached = getCache("gmnscore");
  if (cached) return res.json(cached);
  try {
    const token = await getTwitchToken();
    const SCORE_GAME = "Meccha Chameleon";
    const r = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: twitchHeaders(token),
      body: `fields name, cover.url, rating, aggregated_rating, platforms.name, involved_companies.company.name, summary; where name = "${SCORE_GAME}"; limit 1;`,
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`IGDB ${r.status}`);
    const games = await r.json();
    const game  = games[0];
    if (!game) throw new Error("No game found");

    const agg      = game.aggregated_rating || 85;
    const usr      = game.rating || agg;
    const gmnScore = Math.round((agg + usr) / 2);
    const developer = game.involved_companies?.[0]?.company?.name || "Unknown";
    const platforms = (game.platforms || []).map(p => p.name).slice(0, 3).join(", ") || "PS5, Xbox, PC";
    const coverUrl  = game.cover?.url
      ? game.cover.url.replace("t_thumb", "t_cover_big").replace("http://", "https://")
      : null;

    const result = {
      name: game.name, coverUrl, developer, platforms, gmnScore,
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
//  /api/games/search
// ─────────────────────────────────────────────────────────────
app.get("/api/games/search", async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) return res.json([]);
  const cacheKey = `game_search_${q.toLowerCase()}`;
  const cached   = getCache(cacheKey);
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
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`IGDB ${r.status}`);
    const games   = await r.json();
    const results = games.map(g => ({
      name:      g.name,
      coverUrl:  g.cover?.url
        ? ("https:" + g.cover.url.replace("t_thumb", "t_cover_big")).replace("https:https:", "https:")
        : null,
      platforms: (g.platforms || []).map(p => p.name).slice(0, 3).join(", ") || null,
      year:      g.first_release_date
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
//  /api/games/hub?q=NAME  —  Full game profile (IGDB + Twitch + Steam)
// ─────────────────────────────────────────────────────────────
app.get("/api/games/hub", async (req, res) => {
  const q = (req.query.q || "").trim();
  if (!q) return res.status(400).json({ error: "Missing q param" });
  const cacheKey = `game_hub_${q.toLowerCase()}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);
  try {
    const token = await getTwitchToken();

    const ir = await fetch("https://api.igdb.com/v4/games", {
      method: "POST",
      headers: twitchHeaders(token),
      body: `search "${q.replace(/"/g, "")}"; fields name, cover.url, platforms.name, first_release_date, summary, aggregated_rating, rating, involved_companies.company.name; where version_parent = null; limit 1;`,
      signal: AbortSignal.timeout(8000),
    });
    if (!ir.ok) throw new Error(`IGDB ${ir.status}`);
    const game = (await ir.json())[0];
    if (!game) return res.status(404).json({ error: "No game found" });

    const agg = game.aggregated_rating ? Math.round(game.aggregated_rating) : null;
    const usr = game.rating ? Math.round(game.rating) : null;
    const gmnScore = (agg || usr) ? Math.round(((agg || usr) + (usr || agg)) / 2) : null;
    const coverUrl = game.cover?.url
      ? ("https:" + game.cover.url.replace("t_thumb", "t_cover_big")).replace("https:https:", "https:")
      : null;

    let twitchViewers = null;
    try {
      const gr = await fetch(`https://api.twitch.tv/helix/games?name=${encodeURIComponent(game.name)}`, {
        headers: twitchHeaders(token), signal: AbortSignal.timeout(6000),
      });
      const gid = (await gr.json()).data?.[0]?.id;
      if (gid) {
        const sr = await fetch(`https://api.twitch.tv/helix/streams?game_id=${gid}&first=100`, {
          headers: twitchHeaders(token), signal: AbortSignal.timeout(6000),
        });
        twitchViewers = ((await sr.json()).data || []).reduce((s, x) => s + (x.viewer_count || 0), 0);
      }
    } catch (e) {}

    const steamId = KNOWN_STEAM_IDS[game.name] ?? null;
    const steamPlayers = steamId ? await fetchSteamPlayers(steamId) : null;

    const result = {
      name: game.name,
      coverUrl,
      developer: game.involved_companies?.[0]?.company?.name || null,
      platforms: (game.platforms || []).map(p => p.name).slice(0, 3).join(", ") || null,
      year: game.first_release_date ? new Date(game.first_release_date * 1000).getFullYear() : null,
      summary: game.summary ? game.summary.slice(0, 240) : null,
      igdbRating: agg || usr || null,
      gmnScore,
      twitchViewers,
      twitchViewersLabel: twitchViewers != null ? formatPlayerCount(twitchViewers) : null,
      steamPlayers,
      steamPlayersLabel: steamPlayers != null ? formatPlayerCount(steamPlayers) : null,
    };
    setCache(cacheKey, result, 5 * 60 * 1000);
    res.json(result);
  } catch (e) {
    console.error("game hub error:", e);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────────────────────
//  /api/videos  —  YouTube playlist
// ─────────────────────────────────────────────────────────────
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

    const r = await fetch(url.toString(), {
      headers: { "User-Agent": "GMN-News/3.0 (+https://gmnnews.org)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      return res.status(r.status).json({ error: "YouTube error", details: d });
    }
    const j     = await r.json();
    const items = (j.items || []).map(it => {
      const s  = it.snippet        || {};
      const cd = it.contentDetails || {};
      const id = cd.videoId || s.resourceId?.videoId || null;
      const t  = s.thumbnails || {};
      return {
        id,
        title:        s.title        || "Untitled",
        description:  s.description  || "",
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
  } catch (e) {
    console.error("videos error:", e);
    res.status(500).json({ error: "Failed to fetch videos" });
  }
});

// ─────────────────────────────────────────────────────────────
//  ROOT
// ─────────────────────────────────────────────────────────────
app.get("/", (_req, res) => res.type("text").send("GMN News API v3 — RSS Edition ✅"));

// ─────────────────────────────────────────────────────────────
//  RSS → SUPABASE ARCHIVER
//  Runs on startup and every 30 minutes to save new articles
// ─────────────────────────────────────────────────────────────
async function archiveArticles() {
  try {
    const results = await Promise.allSettled(RSS_FEEDS.map(fetchRSSFeed));
    const all     = results.flatMap(r => r.status === "fulfilled" ? r.value : []);
    if (!all.length) return;

    // Upsert articles — link is unique so duplicates are ignored
    const rows = all.map(a => ({
      title:        a.title,
      link:         a.link,
      date:         a.date,
      image:        a.image,
      deck:         a.deck,
      source:       a.source,
      source_color: a.sourceColor,
    })).filter(r => r.link);

    const { error } = await supabase
      .from("articles")
      .upsert(rows, { onConflict: "link", ignoreDuplicates: true });

    if (error) console.error("Supabase archive error:", error.message);
    else console.log(`✅ Archived ${rows.length} articles to Supabase`);
  } catch (e) {
    console.error("Archive failed:", e.message);
  }
}

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, "0.0.0.0", async () => {
  console.log(`\n🎮 GMN News API v3 → http://localhost:${PORT}`);
  console.log(`   Twitch:   ${TWITCH_CLIENT_ID            ? "✅ key found" : "❌ MISSING"}`);
  console.log(`   Steam:    ${STEAM_API_KEY               ? "✅ key found" : "❌ MISSING"}`);
  console.log(`   YouTube:  ${YT_API_KEY                  ? "✅ key found" : "❌ MISSING"}`);
  console.log(`   Supabase: ${process.env.SUPABASE_SERVICE_KEY ? "✅ key found" : "❌ MISSING"}`);
  console.log(`   News:     ✅ RSS feeds (12 sources)\n`);

  // Archive articles on startup then every 30 minutes
  await archiveArticles();
  setInterval(archiveArticles, 30 * 60 * 1000);
});
