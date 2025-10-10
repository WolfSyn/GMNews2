// server/index.mjs
import express from "express";
import cors from "cors";
import "dotenv/config";
import sanitizeHtml from "sanitize-html";
import { JSDOM } from "jsdom";

// ---- ensure fetch exists on Node < 18 ----
if (typeof fetch === "undefined") {
  const { default: nodeFetch } = await import("node-fetch");
  globalThis.fetch = nodeFetch;
}

const app = express();
app.use(cors({ origin: true }));

const GS_API_KEY = process.env.GAMESPOT_API_KEY;

// GameSpot API bases
const GS_ARTICLES_BASE = "https://www.gamespot.com/api/articles/";
const GS_REVIEWS_BASE  = "https://www.gamespot.com/api/reviews/";
const GS_RELEASES_BASE = "https://www.gamespot.com/api/releases/";

const YT_API_KEY = process.env.YT_API_KEY;
const YT_PLAYLIST_ID =
  process.env.YT_PLAYLIST_ID || "PLgbyvoUvIMf9Jz3j-JvpOW4CuXKB21Bis";

// health
app.get("/ping", (_req, res) => res.json({ ok: true }));

function pickImage(img) {
  if (!img) return null;
  return (
    img.original ||
    img.super_url ||
    img.medium_url ||
    img.small_url ||
    img.square_medium ||
    img.square_small ||
    img.thumb_url ||
    img.tiny_url ||
    null
  );
}

// ---------- /api/articles ----------
app.get("/api/articles", async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    const url = new URL(GS_ARTICLES_BASE);
    url.searchParams.append("api_key", GS_API_KEY);
    url.searchParams.append("format", "json");
    url.searchParams.append("sort", "publish_date:desc");
    url.searchParams.append("limit", String(limit));
    url.searchParams.append("offset", String(offset));

    const r = await fetch(url.toString(), {
      headers: { "User-Agent": "GMN-News/1.0 (+server)" },
    });
    if (!r.ok) return res.status(502).json({ error: `Upstream ${r.status}` });
    const j = await r.json();

    const articles = (j.results || []).map((a) => ({
      title: a.title,
      link: a.site_detail_url,
      date: a.publish_date?.slice(0, 10),
      deck: a.deck,
      image: pickImage(a.image),
    }));

    res.json({
      articles,
      paging: {
        limit,
        offset,
        count: articles.length,
        hasMore: articles.length === limit,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch" });
  }
});

// ---------- /api/reviews (GameSpot Reviews) ----------
app.get("/api/reviews", async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    const url = new URL(GS_REVIEWS_BASE);
    url.searchParams.append("api_key", GS_API_KEY);
    url.searchParams.append("format", "json");
    url.searchParams.append("sort", "publish_date:desc");
    url.searchParams.append("limit", String(limit));
    url.searchParams.append("offset", String(offset));
    // keep the response lean; include score
    url.searchParams.append(
      "field_list",
      "title,deck,publish_date,image,site_detail_url,score,authors"
    );

    const r = await fetch(url.toString(), {
      headers: { "User-Agent": "GMN-News/1.0 (+server)" },
    });
    if (!r.ok) return res.status(502).json({ error: `Upstream ${r.status}` });
    const j = await r.json();

    const articles = (j.results || []).map((rv) => {
      // authors can come back as array or string; normalize to string
      let byline = null;
      if (Array.isArray(rv.authors)) {
        byline = rv.authors.map((a) => a?.name).filter(Boolean).join(", ") || null;
      } else if (typeof rv.authors === "string") {
        byline = rv.authors || null;
      }
      return {
        title: rv.title,
        link: rv.site_detail_url,
        date: rv.publish_date?.slice(0, 10),
        deck: rv.deck,
        image: pickImage(rv.image),
        score: rv.score ?? null,
        byline,
      };
    });

    res.json({
      articles,
      paging: {
        limit,
        offset,
        count: articles.length,
        hasMore: articles.length === limit,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

// ---------- /api/releases (GameSpot Releases) ----------
app.get("/api/releases", async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    const url = new URL(GS_RELEASES_BASE);
    url.searchParams.append("api_key", GS_API_KEY);
    url.searchParams.append("format", "json");
    url.searchParams.append("sort", "release_date:desc");
    url.searchParams.append("limit", String(limit));
    url.searchParams.append("offset", String(offset));
    // keep it lean; ask for common fields if supported
    url.searchParams.append(
      "field_list",
      "name,title,release_date,image,site_detail_url,platforms"
    );

    const r = await fetch(url.toString(), {
      headers: { "User-Agent": "GMN-News/1.0 (+server)" },
    });
    if (!r.ok) return res.status(502).json({ error: `Upstream ${r.status}` });
    const j = await r.json();

    const releases = (j.results || []).map((it) => {
      // title
      const title = it.name || it.title || "Untitled";

      // date
      const date =
        it.release_date?.slice(0, 10) ||
        it.publish_date?.slice(0, 10) ||
        null;

      // platforms may be array of strings or objects
      const platforms = []
        .concat(it.platforms || it.platform || [])
        .map((p) => (typeof p === "string" ? p : p?.name))
        .filter(Boolean)
        .join(", ");

      return {
        title,
        link: it.site_detail_url,
        date,
        deck: platforms ? `Platforms: ${platforms}` : null,
        image: pickImage(it.image) || null,
      };
    });

    res.json({
      // keep the same shape that the ArticlesPage expects
      articles: releases,
      paging: {
        limit,
        offset,
        count: releases.length,
        hasMore: releases.length === limit,
      },
    });
  } catch (e) {
    console.error("releases error:", e);
    res.status(500).json({ error: "Failed to fetch releases" });
  }
});

// ---------- /api/article ----------
app.get("/api/article", async (req, res) => {
  try {
    const articleUrl = req.query.url;
    if (!articleUrl) return res.status(400).json({ error: "Missing url param" });

    const u = new URL(articleUrl);
    if (!u.hostname.endsWith("gamespot.com")) {
      return res.status(400).json({ error: "Only GameSpot URLs are allowed" });
    }

    const htmlResp = await fetch(articleUrl, {
      headers: { "User-Agent": "GMN-Reader/1.0 (+server)" },
    });
    if (!htmlResp.ok) {
      return res.status(502).json({ error: `Upstream ${htmlResp.status}` });
    }
    const html = await htmlResp.text();

    const dom = new JSDOM(html, { url: articleUrl });
    const doc = dom.window.document;

    const { Readability } = await import("@mozilla/readability");
    const reader = new Readability(doc);
    const parsed = reader.parse();
    if (!parsed) return res.status(500).json({ error: "Unable to parse article" });

    const clean = sanitizeHtml(parsed.content, {
      allowedTags: sanitizeHtml.defaults.allowedTags.concat([
        "img",
        "figure",
        "figcaption",
      ]),
      allowedAttributes: {
        a: ["href", "name", "target", "rel"],
        img: ["src", "alt", "title"],
        "*": ["id", "class", "style"],
      },
      transformTags: {
        a: (tagName, attribs) => ({
          tagName: "a",
          attribs: { ...attribs, target: "_blank", rel: "noopener" },
        }),
      },
    });

    const leadImg =
      doc.querySelector('meta[property="og:image"]')?.content ||
      doc.querySelector('meta[name="twitter:image"]')?.content ||
      null;

    res.json({
      title: parsed.title,
      byline: parsed.byline || null,
      excerpt: parsed.excerpt || null,
      siteName: parsed.siteName || "GameSpot",
      leadImage: leadImg,
      html: clean,
    });
  } catch (e) {
    console.error("reader error:", e);
    res.status(500).json({ error: "Reader failed" });
  }
});

// ---------- /api/videos (YouTube playlist) ----------
app.get("/api/videos", async (req, res) => {
  try {
    if (!YT_API_KEY) return res.status(500).json({ error: "Missing YT_API_KEY" });

    const playlistId = (req.query.playlistId || YT_PLAYLIST_ID).trim();
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
    // ✅ accept either ?cursor= or ?pageToken=
    const pageToken = (req.query.cursor || req.query.pageToken || "").trim();

    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("maxResults", String(limit));
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    url.searchParams.set("key", YT_API_KEY);

    const r = await fetch(url.toString(), {
      headers: { "User-Agent": "GMN-News/1.0 (+server)" },
    });
    if (!r.ok) {
      const details = await r.json().catch(() => ({}));
      return res.status(r.status).json({ error: "YouTube error", details });
    }
    const j = await r.json();

    const items = (j.items || []).map((it) => {
      const s = it.snippet || {};
      const cd = it.contentDetails || {};
      const id = cd.videoId || s.resourceId?.videoId || null;
      const t = s.thumbnails || {};
      const thumb =
        t.maxres?.url || t.standard?.url || t.high?.url || t.medium?.url || t.default?.url || null;

      return {
        id,
        title: s.title || "Untitled",
        description: s.description || "",
        publishedAt: cd.videoPublishedAt || s.publishedAt || null,
        channelTitle: s.channelTitle || "",
        thumb,
        url: id ? `https://www.youtube.com/watch?v=${id}` : null,
      };
    });

    res.json({
      items,
      paging: {
        limit,
        nextPageToken: j.nextPageToken || null,
        prevPageToken: j.prevPageToken || null,
      },
    });
  } catch (e) {
    console.error("videos error:", e);
    res.status(500).json({ error: "Failed to fetch videos" });
  }
});

// (optional) root
app.get("/", (_req, res) => res.type("text").send("GMN API OK"));

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`API listening -> http://localhost:${PORT}`);
});
