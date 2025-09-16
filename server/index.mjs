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

const API_KEY = process.env.GAMESPOT_API_KEY;
const GS_BASE = "https://www.gamespot.com/api/articles/";

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

// ---------- list ----------
app.get("/api/articles", async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    const url = new URL(GS_BASE);
    url.searchParams.append("api_key", API_KEY);
    url.searchParams.append("format", "json");
    url.searchParams.append("sort", "publish_date:desc");
    url.searchParams.append("limit", String(limit));
    url.searchParams.append("offset", String(offset));

    const r = await fetch(url.toString(), {
      headers: { "User-Agent": "GMN-News/1.0 (+local-dev)" },
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

// ---------- reader ----------
app.get("/api/article", async (req, res) => {
  try {
    const articleUrl = req.query.url;
    if (!articleUrl) return res.status(400).json({ error: "Missing url param" });

    const u = new URL(articleUrl);
    if (!u.hostname.endsWith("gamespot.com")) {
      return res.status(400).json({ error: "Only GameSpot URLs are allowed" });
    }

    const htmlResp = await fetch(articleUrl, {
      headers: { "User-Agent": "GMN-Reader/1.0 (+local-dev)" },
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
      allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "figure", "figcaption"]),
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

const PORT = Number(process.env.PORT) || 3000;
// bind to all interfaces so http://localhost:3000 works reliably
app.listen(PORT, "0.0.0.0", () => {
  console.log(`API listening -> http://localhost:${PORT}`);
});
