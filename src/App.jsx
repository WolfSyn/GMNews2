// src/App.jsx  —  GMN News · Billboard of Gaming
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Routes,
  Route,
  NavLink,
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
  useParams,
} from "react-router-dom";

export default function App() {
  return <RootLayout />;
}

function RootLayout() {
  return (
    <div className="app">
      <Header />
      <main>
        <ScrollToTop />
        <Routes>
          <Route path="/"               element={<HomePage />} />
          <Route path="/about"          element={<AboutPage />} />
          <Route path="/articles"       element={<ArticlesPage />} />
          <Route path="/blog"           element={<BlogPage />} />
          <Route path="/videos"         element={<VideosPage />} />
          <Route path="/tech"           element={<TechPage />} />
          <Route path="/support"        element={<SupportPage />} />
          <Route path="/privacy"        element={<PrivacyPage />} />
          <Route path="/article-detail" element={<ArticleDetailPage />} />
          <Route path="/game/:name"     element={<GameDetailPage />} />
          <Route path="/search"         element={<SearchPage />} />
          <Route path="/digest"         element={<WeeklyDigestPage />} />
          <Route path="/reviews/submit" element={<SubmitReviewPage />} />
          <Route path="*"               element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

/* ─────────────────────────────────────────
   API hooks
───────────────────────────────────────── */
function useApiBase() {
  return useMemo(() => {
    const raw = import.meta.env.VITE_API_BASE?.trim();
    const normalize = (val) => {
      if (!val) return null;
      let s = val.trim();
      if (/^:?\d{2,5}$/.test(s))        s = `http://localhost:${s.replace(":", "")}`;
      if (/^[\w.-]+:\d{2,5}$/.test(s))  s = `http://${s}`;
      try {
        const u = new URL(s, window.location.origin);
        if (!/\/api\/articles\/?$/.test(u.pathname))
          u.pathname = u.pathname.replace(/\/+$/, "") + "/api/articles";
        return (u.origin + u.pathname).replace(/\/$/, "");
      } catch { return null; }
    };
    return normalize(raw) ?? "https://gmnews2.onrender.com/api/articles";
  }, []);
}
function useReaderBase() {
  const b = useApiBase();
  return useMemo(() => b.replace(/\/api\/articles\/?$/, "/api/article"), [b]);
}
function useApiOrigin() {
  const b = useApiBase();
  return useMemo(() => { try { return new URL(b).origin; } catch { return window.location.origin; } }, [b]);
}
function useVideosBase() {
  const b = useApiBase();
  return useMemo(() => b.replace(/\/api\/articles\/?$/, "/api/videos"), [b]);
}
function useReviewsBase() {
  const b = useApiBase();
  return useMemo(() => b.replace(/\/api\/articles\/?$/, "/api/reviews"), [b]);
}

/* ─────────────────────────────────────────
   HEADER
───────────────────────────────────────── */
function CategoryLink({ label, tag }) {
  const loc = useLocation();
  const href = tag && tag !== "all" ? `/articles?tag=${tag}` : "/articles";
  const currentTag = new URLSearchParams(loc.search).get("tag") || "all";
  const active = loc.pathname === "/articles" && currentTag === (tag || "all");
  return (
    <Link to={href} className={`category-link ${active ? "active" : ""}`}>
      {label}
    </Link>
  );
}

function Header() {
  const [open, setOpen] = useState(false);

  const cats = [
    ["All", "all"],
    ["PC", "pc"],
    ["PlayStation", "playstation"],
    ["Xbox", "xbox"],
    ["Nintendo", "nintendo"],
    ["Mobile", "mobile"],
  ];
  const loc = useLocation();
  const q = new URLSearchParams(loc.search);
  const tag = q.get("tag") || "all";
  const onArticles = loc.pathname === "/articles";

  // Current month label for the LIVE badge
  const monthLabel = new Date().toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <header className="header">
      <nav className="site-nav">
        <div className="nav-inner">
          <NavLink to="/" className="logo" onClick={() => setOpen(false)}>
            <img
              src="/important_stuff.png"
              alt="GMN News"
              className="logo-img"
              width="38"
              height="38"
              loading="eager"
              decoding="async"
              fetchpriority="high"
            />
            <span>GMN News</span>
          </NavLink>

          <button className="menu-btn" onClick={() => setOpen(v => !v)} aria-label="Toggle menu">☰</button>

          <div className="nav-links" data-open={open}>
            <NavLink to="/" end>Home</NavLink>
            <Link to="/articles"             className={onArticles && (tag === "all" || tag === "news")    ? "active" : ""}>News</Link>
            <Link to="/articles?tag=reviews" className={onArticles && tag === "reviews"                    ? "active" : ""}>Reviews</Link>
            <Link to="/articles?tag=releases"className={onArticles && tag === "releases"                   ? "active" : ""}>Releases</Link>
            <NavLink to="/videos">Videos</NavLink>
            <NavLink to="/digest">Digest</NavLink>
            <NavLink to="/tech">GMN Tech</NavLink>
          </div>

          <NavLink to="/search" className="nav-icon-btn" aria-label="Search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          </NavLink>

          <div className="nav-live">
            <span className="live-dot" />
            {monthLabel}
          </div>
        </div>
      </nav>

      {/* Category rail */}
      <div className="category-nav">
        <div className="category-inner">
          {cats.map(([label, key]) => (
            <CategoryLink key={key} label={label} tag={key} />
          ))}
        </div>
      </div>

      {/* Trending ticker */}
      <TrendingBar />
    </header>
  );
}

function TrendingBar() {
  const API_ORIGIN = useApiOrigin();
  const [items, setItems] = useState(["Loading live trends…"]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_ORIGIN}/api/charts/streams`);
        if (!r.ok) return;
        const data = await r.json();
        if (data?.length) setItems(data.slice(0, 10).map((g, i) => `#${i + 1} ${g.name}`));
      } catch { /* keep fallback */ }
    })();
  }, [API_ORIGIN]);

  const doubled = [...items, ...items];
  return (
    <div className="trending-bar">
      <span className="trend-label">TRENDING</span>
      <div className="trend-track">
        <div className="trend-marquee">
          {doubled.map((t, i) => (
            <span className="trend-item" key={i}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   FOOTER
───────────────────────────────────────── */
function Footer() {
  return (
    <footer>
      <div className="footer-inner">
        <p>
          <Link to="/privacy">Privacy Policy</Link>
          {" · "}
          <Link to="/support">Support</Link>
        </p>
        <p>© {new Date().getFullYear()} GMN News · GMN Tech</p>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────
   HOME PAGE — BILLBOARD OF GAMING (live data)
───────────────────────────────────────── */

function rankClass(r) {
  if (r === 1) return "gold";
  if (r === 2) return "silver";
  if (r === 3) return "bronze";
  return "";
}
function trendClass(t) {
  if (t === "up")   return "pill-up";
  if (t === "down") return "pill-down";
  if (t === "new")  return "pill-new";
  return "pill-same";
}
function barColor(rank) {
  if (rank === 1) return "var(--gold)";
  if (rank <= 3)  return "var(--red)";
  return "var(--muted)";
}
function miniPillClass(pill) {
  if (pill === "new")  return "mpill-new";
  if (pill === "free") return "mpill-free";
  if (pill === "hot")  return "mpill-hot";
  if (pill === "up")   return "mpill-up";
  return "";
}
function miniPillLabel(pill) {
  if (pill === "new")  return "NEW";
  if (pill === "free") return "FREE";
  if (pill === "hot")  return "HOT";
  if (pill === "up")   return "▲";
  return "";
}

/* Skeleton rows for loading states */
function ChartSkeleton({ rows = 10 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <div className="chart-row" key={i} style={{ pointerEvents: "none" }}>
          <div className="rank-num" style={{ opacity: 0.3 }}>{i + 1}</div>
          <div className="game-thumb-wrap skeleton-box" />
          <div className="game-info">
            <div className="skeleton-box" style={{ height: 13, width: "65%", borderRadius: 6 }} />
            <div className="skeleton-box" style={{ height: 10, width: "45%", borderRadius: 6, marginTop: 5 }} />
          </div>
          <div className="game-bar-wrap">
            <div className="game-bar-bg"><div className="game-bar-fill skeleton-box" style={{ width: `${80 - i * 6}%` }} /></div>
          </div>
          <div className="skeleton-box" style={{ width: 36, height: 22, borderRadius: 6 }} />
        </div>
      ))}
    </>
  );
}

function MiniSkeleton({ rows = 5 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <div className="mini-chart-item" key={i}>
          <span className="mini-rank">{i + 1}</span>
          <div className="skeleton-box" style={{ flex: 1, height: 12, borderRadius: 6 }} />
        </div>
      ))}
    </>
  );
}

function HomePage() {
  const API_BASE   = useApiBase();
  const API_ORIGIN = useApiOrigin();

  // Live chart data
  const [chartData,   setChartData]   = useState(null);
  const [chartErr,    setChartErr]    = useState(null);
  const [chartLoading,setChartLoading]= useState(true);

  // GMN Score
  const [scoreData,   setScoreData]   = useState(null);
  const [scoreLoading,setScoreLoading]= useState(true);

  // Mini charts
  const [streams,     setStreams]     = useState([]);
  const [releases,    setReleases]    = useState([]);
  const [freeToPlay,  setFreeToPlay]  = useState([]);
  const [miniLoading, setMiniLoading] = useState(true);

  // Latest news articles
  const [latest,      setLatest]      = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsErr,     setNewsErr]     = useState(null);

  const [platformFilter, setPlatformFilter] = useState("all");
  const monthYear = new Date().toLocaleString("default", { month: "long", year: "numeric" });

  // Fetch all chart data in parallel
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_ORIGIN}/api/charts`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setChartData(await r.json());
      } catch (e) {
        setChartErr(e.message || "Failed to load chart");
      } finally {
        setChartLoading(false);
      }
    })();
  }, [API_ORIGIN]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_ORIGIN}/api/charts/gmnscore`);
        if (r.ok) setScoreData(await r.json());
      } finally { setScoreLoading(false); }
    })();
  }, [API_ORIGIN]);

  useEffect(() => {
    (async () => {
      try {
        const [rs, rr, rf] = await Promise.all([
          fetch(`${API_ORIGIN}/api/charts/streams`),
          fetch(`${API_ORIGIN}/api/charts/releases`),
          fetch(`${API_ORIGIN}/api/charts/freetoplay`),
        ]);
        if (rs.ok) setStreams(await rs.json());
        if (rr.ok) setReleases(await rr.json());
        if (rf.ok) setFreeToPlay(await rf.json());
      } finally { setMiniLoading(false); }
    })();
  }, [API_ORIGIN]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}?limit=9&offset=0`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        setLatest(j.articles || []);
      } catch (e) {
        setNewsErr(e.message || "Failed to load");
      } finally { setNewsLoading(false); }
    })();
  }, [API_BASE]);

  const chart  = chartData?.chart  || [];
  const rising = chartData?.rising || [];

  const PLATFORM_KEYWORDS = {
    pc:          /(PC|Windows|Steam|Epic)/i,
    playstation: /(PlayStation|PS5|PS4)/i,
    xbox:        /(Xbox|Series X|Series S)/i,
    nintendo:    /(Nintendo|Switch)/i,
    mobile:      /(Mobile|iOS|Android)/i,
  };
  const filteredChart = platformFilter === "all"
    ? chart
    : chart.filter(g => PLATFORM_KEYWORDS[platformFilter]?.test(g.name + " " + (g.platform || "")));

  // Format the updatedAt timestamp
  const updatedAt = chartData?.updatedAt
    ? new Date(chartData.updatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <div className="home">

      {/* ── Billboard headline ── */}
      <div className="billboard-datebar">
        <h1 className="billboard-headline">
          GMN <span>Hot 50</span>
        </h1>
        <span className="billboard-date">— {monthYear}</span>
      </div>

      {/* ── Platform filter ── */}
      <div className="platform-filter-bar">
        {[
          { key: "all",         label: "All Platforms" },
          { key: "pc",          label: "PC" },
          { key: "playstation", label: "PlayStation" },
          { key: "xbox",        label: "Xbox" },
          { key: "nintendo",    label: "Nintendo" },
          { key: "mobile",      label: "Mobile" },
        ].map(p => (
          <button
            key={p.key}
            className={`platform-btn ${platformFilter === p.key ? "active" : ""}`}
            onClick={() => setPlatformFilter(p.key)}
          >{p.label}</button>
        ))}
      </div>

      {/* ── Main chart + sidebar ── */}
      <div className="billboard-grid">

        {/* HOT 50 CHART */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <div className="chart-card-title">
                🏆 Most Watched Games
                <span className="chart-type-badge badge-live">LIVE</span>
              </div>
              <div className="chart-card-sub">
                Ranked by live Twitch viewers
              </div>
            </div>
            <div className="chart-updated">
              {updatedAt ? `Updated ${updatedAt}` : "Loading…"}
            </div>
          </div>

          {chartErr && (
            <div style={{ padding: "14px 18px", color: "var(--muted)", fontSize: 13 }}>
              ⚠️ {chartErr} — check your Twitch keys in .env
            </div>
          )}

          <div className="chart-rows">
            {chartLoading
              ? <ChartSkeleton rows={10} />
              : (filteredChart.length ? filteredChart : chart).slice(0, 10).map(item => (
                  <div className="chart-row" key={item.rank} onClick={() => window.location.href=`/game/${encodeURIComponent(item.name)}`} style={{cursor:"pointer"}}>
                    <div className={`rank-num ${rankClass(item.rank)}`}>{item.rank}</div>
                    <div className="game-thumb-wrap">
                      {item.coverUrl
                        ? <img src={item.coverUrl} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <div className="game-thumb-emoji">🎮</div>
                      }
                    </div>
                    <div className="game-info">
                      <div className="game-name">{item.name}</div>
                      <div className="game-platform">
                        {item.steamLabel
                          ? `${item.viewersLabel} viewers · ${item.steamLabel} on Steam`
                          : `${item.viewersLabel} viewers on Twitch`
                        }
                      </div>
                    </div>
                    <div className="game-bar-wrap">
                      <div className="game-bar-bg">
                        <div
                          className="game-bar-fill"
                          style={{ width: `${item.barPct}%`, background: barColor(item.rank) }}
                        />
                      </div>
                      <div className="game-bar-num">{item.viewersLabel}</div>
                    </div>
                    <span className={`trend-pill ${trendClass(item.trend)}`}>
                      {item.trendLabel}
                    </span>
                  </div>
                ))
            }
          </div>

          <div className="chart-footer">
            <span className="chart-footer-note">
              Top 10 of 50
            </span>
            <Link to="/articles" className="chart-footer-link">
              All Articles →
            </Link>
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="billboard-sidebar">

          {/* GMN Score — live from IGDB */}
          <div className="side-card">
            <div className="side-card-header">
              <span className="side-dot dot-gold" />
              GMN Score of the Month
            </div>
            {scoreLoading ? (
              <div style={{ padding: 16 }}>
                <div className="skeleton-box" style={{ height: 52, width: 52, borderRadius: 12, marginBottom: 10 }} />
                <div className="skeleton-box" style={{ height: 13, width: "70%", borderRadius: 6, marginBottom: 6 }} />
                <div className="skeleton-box" style={{ height: 40, width: "40%", borderRadius: 6 }} />
              </div>
            ) : scoreData ? (
              <>
                <div className="gmn-score-game">
                  <div className="gmn-score-thumb">
                    {scoreData.coverUrl
                      ? <img src={scoreData.coverUrl} alt={scoreData.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }} />
                      : "🏆"
                    }
                  </div>
                  <div className="gmn-score-info">
                    <div className="gmn-score-name">{scoreData.name}</div>
                    <div className="gmn-score-platform">{scoreData.developer} · {scoreData.platforms}</div>
                  </div>
                </div>
                <div style={{ padding: "0 16px 8px", display: "flex", alignItems: "baseline", gap: 10 }}>
                  <div className="gmn-score-num">{scoreData.gmnScore}</div>
                  <div>
                    <div className="gmn-score-label">
                      {scoreData.gmnScore >= 90 ? "EXCEPTIONAL"
                        : scoreData.gmnScore >= 80 ? "GREAT"
                        : scoreData.gmnScore >= 70 ? "GOOD"
                        : "MIXED"}
                    </div>
                    <div className="gmn-score-desc">GMN Score / 100</div>
                  </div>
                </div>
                <div className="gmn-score-bars">
                  {scoreData.breakdown.map(b => (
                    <div className="score-bar-row" key={b.label}>
                      <span className="score-bar-label">{b.label}</span>
                      <div className="score-bar-track">
                        <div className="score-bar-val" style={{ width: `${b.val}%`, background: b.color }} />
                      </div>
                      <span className="score-bar-num" style={{ color: b.color }}>{b.val}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ padding: 16, fontSize: 13, color: "var(--muted)" }}>Score unavailable</div>
            )}
          </div>

          {/* Rising This Week — from chart trend data */}
          <div className="side-card">
            <div className="side-card-header">
              <span className="side-dot dot-green" />
              Rising This Week
            </div>
            {chartLoading ? (
              <MiniSkeleton rows={5} />
            ) : rising.length > 0 ? (
              rising.map(r => (
                <div className="rising-item" key={r.name}>
                  <span className="rising-arrow">↑</span>
                  <span className="rising-name">{r.name}</span>
                  <span className="rising-pct">{r.label}</span>
                </div>
              ))
            ) : (
              /* Fallback: show top movers from chart */
              chart.filter(g => g.trend === "up" || g.trend === "new").slice(0, 5).map(g => (
                <div className="rising-item" key={g.name}>
                  <span className="rising-arrow">↑</span>
                  <span className="rising-name">{g.name}</span>
                  <span className="rising-pct">{g.trendLabel}</span>
                </div>
              ))
            )}
          </div>

        </div>
      </div>

      {/* ── Mini charts row ── */}
      <div className="mini-charts-row">

        {/* Most Streamed — Twitch */}
        <div className="mini-chart-card">
          <div className="mini-chart-header">📺 Most Streamed</div>
          {miniLoading ? <MiniSkeleton /> : streams.slice(0, 5).map((item, i) => (
            <div className="mini-chart-item" key={i}>
              <span className="mini-rank">{item.rank}</span>
              <span className="mini-name">{item.name}</span>
              {i === 0 && <span className="mini-pill mpill-hot">HOT</span>}
            </div>
          ))}
        </div>

        {/* New Releases — IGDB */}
        <div className="mini-chart-card">
          <div className="mini-chart-header">🚀 New Releases</div>
          {miniLoading ? <MiniSkeleton /> : releases.slice(0, 5).map((item, i) => (
            <div className="mini-chart-item" key={i}>
              <span className="mini-rank">{item.rank}</span>
              <span className="mini-name">{item.name}</span>
              <span className="mini-pill mpill-new">NEW</span>
            </div>
          ))}
        </div>

        {/* Free to Play — IGDB */}
        <div className="mini-chart-card">
          <div className="mini-chart-header">🆓 Free to Play</div>
          {miniLoading ? <MiniSkeleton /> : freeToPlay.slice(0, 5).map((item, i) => (
            <div className="mini-chart-item" key={i}>
              <span className="mini-rank">{item.rank}</span>
              <span className="mini-name">{item.name}</span>
              <span className="mini-pill mpill-free">FREE</span>
            </div>
          ))}
        </div>

      </div>

      {/* ── Latest News ── */}
      <div className="latest-section">
        <div className="section-head">
          <h2 className="section-title">Latest News</h2>
          <Link to="/articles" className="section-link">All Articles →</Link>
        </div>

        {newsErr && (
          <div className="card" style={{ borderColor: "#fca5a5", padding: 16, marginBottom: 16 }}>
            <strong>Couldn't load news.</strong>{" "}
            <span className="micro">({newsErr})</span>
          </div>
        )}

        <div className="articles-grid">
          {(newsLoading ? Array.from({ length: 9 }) : latest).map((a, i) => (
            <article className="article-card" key={i}>
              <a href={a ? `/article-detail?url=${encodeURIComponent(a.link)}&title=${encodeURIComponent(a.title)}` : "#"}>
                {a?.image
                  ? <img className="article-thumb" src={a.image} alt={a.title} loading="lazy" />
                  : <div className="article-thumb skeleton-box" style={{ aspectRatio: "16/9" }} />
                }
              </a>
              <div className="article-body">
                <div className="article-meta">
                  <span className="badge">NEWS</span>
                  {a?.date && <time className="micro" dateTime={a.date}>{timeAgo(a.date)}</time>}
                </div>
                <h3 className="article-title">
                  {a
                    ? <a href={`/article-detail?url=${encodeURIComponent(a.link)}&title=${encodeURIComponent(a.title)}`}>{a.title}</a>
                    : <span className="skeleton-box" style={{ display: "block", height: 14, borderRadius: 6 }} />
                  }
                </h3>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   SHARED HELPER
───────────────────────────────────────── */
function timeAgo(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ─────────────────────────────────────────
   ARTICLES PAGE
───────────────────────────────────────── */
function ArticlesPage() {
  const API_BASE     = useApiBase();
  const REVIEWS_BASE = useReviewsBase();
  const loc          = useLocation();
  const navigate     = useNavigate();

  const startTag = new URLSearchParams(loc.search).get("tag") || "all";
  const [items, setItems]   = useState([]);
  const [paging, setPaging] = useState({ count: 0, hasMore: true });
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter]   = useState(startTag);
  const [error, setError]     = useState(null);
  const [lastUrl, setLastUrl] = useState("");
  const loadMoreRef = useRef(null);

  useEffect(() => { if (filter !== startTag) setFilter(startTag); }, [startTag]); // eslint-disable-line

  const PLATFORM_RE = {
    pc:          /(PC|Windows|Steam|Epic)\b/i,
    playstation: /(PlayStation|PS5|PS4|Sony)\b/i,
    xbox:        /(Xbox|Series X|Series S|Game Pass)\b/i,
    nintendo:    /(Nintendo|Switch)\b/i,
    mobile:      /(Mobile|iOS|Android|iPhone|iPad|Google Play)\b/i,
  };
  const TYPE_RE = { releases: /\b(release|released|launch|launches|launching)\b/i };

  async function fetchArticles(reset = false) {
    if (loading) return;
    setLoading(true); setError(null);
    try {
      const nextOffset = reset ? 0 : offset;
      const base   = filter === "reviews" ? REVIEWS_BASE : API_BASE;
      const params = new URLSearchParams({ limit: 20, offset: nextOffset });
      if (filter !== "all" && filter !== "reviews") params.set("tag", filter);
      const url = `${base}?${params}`;
      setLastUrl(url);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { articles, paging: pg } = await res.json();
      let list = articles || [];
      if (filter !== "reviews") {
        const hay = a => [a.title, a.deck, a.link].filter(Boolean).join(" ");
        if (PLATFORM_RE[filter])  list = list.filter(a => PLATFORM_RE[filter].test(hay(a)));
        else if (TYPE_RE[filter]) list = list.filter(a => TYPE_RE[filter].test(hay(a)));
      }
      setItems(reset ? list : [...items, ...list]);
      setPaging(pg || { count: list.length, hasMore: list.length === 20 });
      setOffset(nextOffset + (pg?.count || list.length || 0));
    } catch (e) {
      setError(e.message || "Failed to load articles");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setItems([]); setOffset(0); setPaging({ count: 0, hasMore: true });
    fetchArticles(true);
  }, [filter, API_BASE, REVIEWS_BASE]); // eslint-disable-line

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      entries => { if (entries.some(e => e.isIntersecting) && paging.hasMore) fetchArticles(); },
      { rootMargin: "600px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [paging.hasMore]); // eslint-disable-line

  const goToTag = tag => navigate(tag === "all" ? "/articles" : `/articles?tag=${tag}`);

  return (
    <div className="articles-page">
      <header className="page-head">
        <h1>Latest Articles</h1>
        <div className="filters">
          {["all", "news", "reviews", "releases"].map(t => (
            <button key={t} className={`chip ${filter === t ? "is-active" : ""}`} onClick={() => goToTag(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </header>

      {error && (
        <div className="card" style={{ maxWidth: 900, margin: "0 auto 16px", padding: 16, borderColor: "#fca5a5" }}>
          <strong>Couldn't load feed.</strong>{" "}
          <span className="micro">({error})</span>
          {lastUrl && <><br /><a className="section-link" href={lastUrl} target="_blank" rel="noreferrer">Open request</a></>}
        </div>
      )}

      <div className="articles-grid" style={{ maxWidth: 1280, margin: "0 auto", padding: "0 20px 24px" }}>
        {items.length === 0 && !loading && !error && <p className="empty-msg">No items yet.</p>}
        {items.length === 0 && loading && Array.from({ length: 6 }).map((_, i) => (
          <div className="article-card" key={i}>
            <div className="article-thumb skeleton-box" style={{ aspectRatio: "16/9" }} />
            <div className="article-body">
              <div className="skeleton-box" style={{ height: 12, width: "60%", borderRadius: 6, margin: "6px 0" }} />
              <div className="skeleton-box" style={{ height: 14, borderRadius: 6, margin: "4px 0" }} />
            </div>
          </div>
        ))}
        {items.map((a, i) => {
          const url = `/article-detail?url=${encodeURIComponent(a.link)}&title=${encodeURIComponent(a.title)}`;
          return (
            <article className="article-card" key={i}>
              <a href={url} style={{ display: "block" }}>
                {a.image
                  ? <img loading="lazy" src={a.image} alt={a.title} className="article-thumb" />
                  : <div className="article-thumb skeleton-box" style={{ aspectRatio: "16/9" }} />
                }
              </a>
              <div className="article-body">
                <div className="article-meta">
                  <span className="badge">Posted</span>
                  {a.date && <time className="micro" dateTime={a.date}>{timeAgo(a.date)}</time>}
                  {typeof a.score === "number" && (
                    <span className="badge" style={{ marginLeft: 6 }}>⭐ {a.score}</span>
                  )}
                </div>
                <h2 className="article-title"><a href={url}>{a.title}</a></h2>
              </div>
            </article>
          );
        })}
      </div>

      {paging.hasMore && (
        <div className="load-more-wrapper">
          <button className="btn-secondary" disabled={loading} onClick={() => fetchArticles()}>
            {loading ? "Loading…" : "Load More"}
          </button>
        </div>
      )}
      <div ref={loadMoreRef} style={{ height: 1 }} />
    </div>
  );
}

/* ─────────────────────────────────────────
   ARTICLE DETAIL
───────────────────────────────────────── */
function ArticleDetailPage() {
  const readerBase = useReaderBase();
  const [sp]  = useSearchParams();
  const url   = sp.get("url");
  const title = sp.get("title") || "Article";
  const [data, setData]       = useState(null);
  const [err, setErr]         = useState(null);
  const [loading, setLoading] = useState(!!url);

  useEffect(() => {
    if (!url) return;
    (async () => {
      try {
        setLoading(true); setErr(null);
        const r = await fetch(`${readerBase}?url=${encodeURIComponent(url)}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setData(await r.json());
      } catch (e) {
        setErr(e.message || "Failed to load article");
      } finally { setLoading(false); }
    })();
  }, [readerBase, url]);

  return (
    <div className="article-detail-wrap">
      {!url && (
        <div className="card" style={{ borderColor: "#fca5a5", padding: 16 }}>
          <strong>Missing article URL.</strong>
        </div>
      )}
      {url && (
        <>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(24px,4vw,40px)", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: 8 }}>
            {data?.title || title}
          </h1>
          {data?.byline && <p className="micro" style={{ marginBottom: 16 }}>{data.byline}</p>}
          {loading && <div className="card skeleton-box" style={{ height: 200, padding: 16 }} />}
          {err && (
            <div className="card" style={{ borderColor: "#fca5a5", padding: 16 }}>
              <strong>Couldn't load article.</strong> <span className="micro">({err})</span>
            </div>
          )}
          {data?.leadImage && (
            <div style={{ margin: "16px 0" }}>
              <img src={data.leadImage} alt="" style={{ width: "100%", borderRadius: 12 }} />
            </div>
          )}
          {data?.html && (
            <div className="card" style={{ padding: 20 }}>
              <div dangerouslySetInnerHTML={{ __html: data.html }} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   VIDEOS PAGE
───────────────────────────────────────── */
function VideosPage() {
  const API_ORIGIN = useApiOrigin();
  const [items, setItems]       = useState([]);
  const [nextCursor, setNext]   = useState(null);
  const [prevCursor, setPrev]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  async function load(cursor = null) {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ limit: 12 });
      if (cursor) params.set("cursor", cursor);
      const r = await fetch(`${API_ORIGIN}/api/videos?${params}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const arr = Array.isArray(j.videos) ? j.videos : (Array.isArray(j.items) ? j.items : []);
      setItems(arr);
      const pg = j.paging || {};
      setNext(pg.next ?? pg.nextCursor ?? pg.nextPageToken ?? null);
      setPrev(pg.prev ?? pg.prevCursor ?? pg.prevPageToken ?? null);
    } catch (e) {
      setError(e.message || "Failed to load videos");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(null); }, [API_ORIGIN]);

  return (
    <div className="videos-page">
      <section className="page-hero">
        <h1>Videos</h1>
        <p>Latest uploads from GMN News.</p>
      </section>

      {error && (
        <div className="card" style={{ maxWidth: 900, margin: "0 auto 16px", padding: 16, borderColor: "#fca5a5" }}>
          <strong>Couldn't load videos.</strong> <span className="micro">({error})</span>
        </div>
      )}

      <div className="articles-grid" style={{ padding: "0 20px" }}>
        {loading && Array.from({ length: 8 }).map((_, i) => (
          <div className="article-card" key={i}>
            <div className="skeleton-box" style={{ aspectRatio: "16/9" }} />
            <div className="article-body">
              <div className="skeleton-box" style={{ height: 12, width: "60%", borderRadius: 6, margin: "6px 0" }} />
            </div>
          </div>
        ))}
        {!loading && items.length === 0 && <p className="empty-msg">No videos yet.</p>}
        {!loading && items.map((v, i) => {
          const id    = v.id ?? i;
          const link  = v.link ?? v.url ?? (v.id ? `https://www.youtube.com/watch?v=${v.id}` : "#");
          const thumb = v.thumbnail ?? v.thumb ?? v.thumbUrl ?? v.thumbs?.medium ?? v.thumbs?.default;
          const pub   = v.publishedAt ?? v.published_at;
          return (
            <article className="article-card" key={id}>
              <a href={link} target="_blank" rel="noreferrer">
                {thumb
                  ? <img className="article-thumb" src={thumb} alt={v.title} style={{ aspectRatio: "16/9" }} />
                  : <div className="article-thumb skeleton-box" style={{ aspectRatio: "16/9" }} />
                }
              </a>
              <div className="article-body">
                <div className="article-meta">
                  <span className="badge">YouTube</span>
                  {pub && <time className="micro" dateTime={pub}>{new Date(pub).toLocaleDateString()}</time>}
                </div>
                <h2 className="article-title">
                  <a href={link} target="_blank" rel="noreferrer">{v.title}</a>
                </h2>
              </div>
            </article>
          );
        })}
      </div>

      <div className="load-more-wrapper">
        <button className="btn-secondary" disabled={!prevCursor || loading} onClick={() => load(prevCursor)}>Prev</button>
        <button className="btn-secondary" disabled={!nextCursor || loading} onClick={() => load(nextCursor)}>Next</button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   TECH PAGE
───────────────────────────────────────── */
function TechPage() {
  return (
    <div className="tech-page">
      <section className="page-hero">
        <h1>GMN Tech</h1>
        <p>Websites, apps, and AI — delivered with speed and quality.</p>
        <div className="hero-actions">
          <a className="btn-primary" href="#contact">Start project</a>
          <a className="btn-ghost" href="#pricing">See pricing</a>
        </div>
      </section>
      <section className="service-grid-wrap">
        <ul className="service-grid">
          {[
            ["Websites & Stores",    "React/Vite/Tailwind, CMS, SEO."],
            ["Mobile Apps",          "SwiftUI, Kotlin, PWAs, store deploy."],
            ["AI Solutions",         "Chatbots, RAG, analytics, automations."],
            ["Support & Success",    "SLAs, monitoring, QA automation."],
          ].map(([title, desc]) => (
            <li className="card" key={title} style={{ padding: 20 }}>
              <h3>{title}</h3><p style={{ color: "var(--muted2)", fontSize: 14 }}>{desc}</p>
            </li>
          ))}
        </ul>
      </section>
      <section id="process" className="process">
        <h2>How we work</h2>
        <ol className="steps">
          {[
            ["1) Discover & Scope",  "We map goals, users, and constraints; you get a clear plan."],
            ["2) Design & Build",    "Design system, dev sprints, weekly demos, and staging links."],
            ["3) Launch & Support",  "Deploy, monitor, fix fast, and iterate with your feedback."],
          ].map(([t, d]) => (
            <li className="card" key={t} style={{ padding: 20 }}><h3>{t}</h3><p style={{ color: "var(--muted2)", fontSize: 14 }}>{d}</p></li>
          ))}
        </ol>
      </section>
      <section id="pricing" className="pricing">
        <h2>Flexible pricing</h2>
        <div className="pricing-grid">
          {[
            { name: "Starter", price: "$1.5k–$3k", features: ["1–3 pages or MVP", "Brand styling", "Cloudflare Pages"] },
            { name: "Growth",  price: "$5k–$12k",  features: ["Multi-page or module", "Design system + CMS", "Analytics + SEO"] },
            { name: "Pro",     price: "Custom",     features: ["Complex app or AI", "Integrations", "Support SLA"] },
          ].map(plan => (
            <article className="plan card" key={plan.name}>
              <h3>{plan.name}</h3>
              <p className="price">{plan.price}</p>
              <ul>{plan.features.map(f => <li key={f}>{f}</li>)}</ul>
              <a className="btn-primary" href="#contact">Choose {plan.name}</a>
            </article>
          ))}
        </div>
        <p className="micro" style={{ textAlign: "center", marginTop: 12 }}>Final price after a quick discovery call.</p>
      </section>
      <section id="contact" className="contact card">
        <h2>Start a project</h2>
        <form className="lead-form" action="https://formspree.io/f/mzbldqoq" method="POST">
          <div className="grid">
            <input name="name" placeholder="Your name" required />
            <input name="email" type="email" placeholder="Email" required />
          </div>
          <textarea name="message" rows="5" placeholder="What do you want to build?" required />
          <button className="btn-primary" type="submit">Send inquiry</button>
        </form>
        <p className="micro">Prefer email? <a href="mailto:BigZ12123@gmail.com">BigZ12123@gmail.com</a></p>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────
   BLOG
───────────────────────────────────────── */
function BlogPage() {
  return (
    <div className="blog-page">
      <section className="page-hero">
        <h1>GMN Blog</h1>
        <p>Deep-dives, interviews, and culture.</p>
      </section>
      <section className="blog-list">
        {[
          { title: "Gamescom 2025: What to Expect", meta: "August 2025 · GMN News Editorial", excerpt: "The world's largest gaming event takes over Cologne with conferences, demos, and community celebrations…" },
          { title: "PlayStation Plus Essential: August 2025", meta: "August 6, 2025 · Daniel Garcia", excerpt: "This week we explore the top monthly titles making it into PS Plus…" },
        ].map(post => (
          <article className="blog-post card" key={post.title} style={{ padding: 22 }}>
            <h2 style={{ fontSize: 20, margin: "0 0 6px" }}><a href="#">{post.title}</a></h2>
            <p className="micro" style={{ marginBottom: 8 }}>{post.meta}</p>
            <p style={{ color: "var(--muted2)", fontSize: 14 }}>{post.excerpt}</p>
            <a href="#" className="section-link" style={{ display: "inline-block", marginTop: 10, fontSize: 13 }}>Read More →</a>
          </article>
        ))}
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────
   ABOUT
───────────────────────────────────────── */
function AboutPage() {
  return (
    <div className="about-page">
      <section className="page-hero">
        <h1>Welcome to GMN News</h1>
        <p>The Billboard of Gaming — always know what's being played right now.</p>
      </section>
      <section className="about-content">
        {[
          ["🎯 Our Mission",    "From breaking news and patch notes to in-depth reviews and dev insights, GMN keeps you ahead of the curve."],
          ["🏆 Our Charts",     "The GMN Hot 50 ranks the most-played, most-streamed, and most-talked-about games every month — the Billboard of Gaming."],
          ["🚀 Our Promise",    "Fast. Reliable. Original. No fluff — just signal. GMN scores, original takes, and data you won't find anywhere else."],
        ].map(([title, text]) => (
          <div className="card" key={title} style={{ padding: 22 }}>
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>{title}</h2>
            <p style={{ color: "var(--muted2)", fontSize: 14 }}>{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────
   SUPPORT
───────────────────────────────────────── */
function SupportPage() {
  const loc = useLocation();
  const sent = new URLSearchParams(loc.search).get("sent") === "1";
  const redirectUrl = typeof window !== "undefined"
    ? `${window.location.origin}/support?sent=1`
    : "/support?sent=1";

  return (
    <div className="support-page">
      <section className="page-hero" style={{ textAlign: "center" }}>
        <h1>Support</h1>
        <p>Found a bug or have feedback? Tell us below — we read everything.</p>
      </section>
      {sent && (
        <div className="card" style={{ maxWidth: 900, margin: "0 auto 16px", padding: 16, borderColor: "#86efac" }}>
          <strong>Thanks!</strong> <span className="micro">We got your message and will follow up if needed.</span>
        </div>
      )}
      <section className="card support-card">
        <form className="lead-form" action="https://formspree.io/f/mqaybeaw" method="POST">
          <input type="hidden" name="_subject" value="[GMN Support] New submission" />
          <input type="hidden" name="_redirect" value={redirectUrl} />
          <input type="text" name="_gotcha" tabIndex="-1" autoComplete="off" style={{ display: "none" }} />
          <div className="grid twocol">
            <input name="name" placeholder="Your name" required />
            <input name="email" type="email" placeholder="Email (for follow-up)" required />
          </div>
          <div className="grid twocol">
            <select name="type" defaultValue="bug" required>
              <option value="bug">Bug report</option>
              <option value="feedback">Feedback</option>
              <option value="feature">Feature request</option>
              <option value="other">Other</option>
            </select>
            <select name="severity" defaultValue="normal">
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <input name="subject" placeholder='Short title (e.g., "Cards overlap on mobile")' required />
          <div className="grid twocol">
            <textarea name="details" rows="6" required placeholder="What happened? Steps to reproduce, expected vs actual…" />
            <input name="screenshot" type="url" placeholder="Screenshot / video link (optional)" />
          </div>
          <label className="micro">By submitting, you agree we may contact you about this issue.</label>
          <button className="btn-primary" type="submit">Submit</button>
        </form>
      </section>
      <style>{`
        .support-page .support-card { max-width:980px; margin:0 auto 28px; padding:24px; border-radius:20px; }
        .support-page .lead-form { display:grid; gap:14px; }
        .support-page .lead-form .grid.twocol { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        @media(max-width:760px){ .support-page .lead-form .grid.twocol { grid-template-columns:1fr; } }
        .support-page input,.support-page select,.support-page textarea { width:100%; border-radius:12px; border:1px solid rgba(255,255,255,0.10); background:rgba(255,255,255,0.03); color:#e5e7eb; font-size:15px; padding:12px 14px; outline:none; transition:border-color .15s; font-family:inherit; }
        .support-page textarea { min-height:150px; resize:vertical; }
        .support-page input::placeholder,.support-page textarea::placeholder { color:#9ca3af; }
        .support-page input:focus,.support-page select:focus,.support-page textarea:focus { border-color:#60a5fa; }
        .support-page select { appearance:none; }
        .support-page .btn-primary { height:46px; padding:0 18px; border-radius:12px; font-weight:700; border:none; background:linear-gradient(180deg,#3b82f6,#2563eb); color:white; cursor:pointer; }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────────
   PRIVACY
───────────────────────────────────────── */
function PrivacyPage() {
  const today = new Date().toLocaleDateString();
  return (
    <div className="privacy-page">
      <section className="page-hero" style={{ textAlign: "center" }}>
        <h1>Privacy Policy</h1>
        <p>We collect as little as possible and never sell your data.</p>
      </section>
      <section className="card policy-card" style={{ maxWidth: 900, margin: "0 auto 28px", padding: 24, borderRadius: 20 }}>
        <h2>Quick summary</h2>
        <ul className="bullets" style={{ paddingLeft: 18, color: "var(--muted2)" }}>
          <li>No accounts.</li>
          <li>Support forms send us your name, email, and message via Formspree.</li>
          <li>Our server keeps minimal logs for security and debugging.</li>
          <li>We never sell your personal information.</li>
        </ul>
        <h2>What we collect</h2>
        <p style={{ color: "var(--muted2)" }}>Support form submissions (name, email, details). Standard server logs (IP, user agent, timestamps). No personal profiles are built from logs.</p>
        <h2>Content APIs</h2>
        <p style={{ color: "var(--muted2)" }}>Articles are fetched from GameSpot; videos via YouTube Data API. We don't send your data to these providers. If you follow external links, their privacy policies apply.</p>
        <h2>Cookies & tracking</h2>
        <p style={{ color: "var(--muted2)" }}>We don't use advertising cookies or cross-site tracking.</p>
        <h2>Contact</h2>
        <p style={{ color: "var(--muted2)" }}>Questions? Email <a href="mailto:gmn.news.official@gmail.com" style={{ color: "var(--blue)" }}>gmn.news.official@gmail.com</a></p>
        <p className="micro" style={{ marginTop: 20 }}>Effective date: {today}</p>
      </section>
    </div>
  );
}


/* ─────────────────────────────────────────
   SEARCH PAGE
───────────────────────────────────────── */
function SearchPage() {
  const API_BASE   = useApiBase();
  const API_ORIGIN = useApiOrigin();
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState([]);
  const [games, setGames]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Pre-load chart for game search
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_ORIGIN}/api/charts`);
        if (r.ok) { const d = await r.json(); setGames(d.chart || []); }
      } catch {}
    })();
  }, [API_ORIGIN]);

  async function doSearch(q) {
    if (!q.trim()) return;
    setLoading(true); setSearched(true);
    try {
      const r = await fetch(`${API_BASE}?limit=20&offset=0`);
      if (!r.ok) throw new Error();
      const { articles } = await r.json();
      const lower = q.toLowerCase();
      setResults((articles || []).filter(a =>
        a.title?.toLowerCase().includes(lower) ||
        a.deck?.toLowerCase().includes(lower)
      ));
    } catch { setResults([]); } finally { setLoading(false); }
  }

  const gameResults = query.length > 1
    ? games.filter(g => g.name.toLowerCase().includes(query.toLowerCase())).slice(0, 5)
    : [];

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 20px" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 900, textTransform: "uppercase", marginBottom: 20 }}>
        Search GMN
      </h1>
      <div style={{ position: "relative", marginBottom: 24 }}>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && doSearch(query)}
          placeholder="Search games, news, reviews…"
          style={{
            width: "100%", padding: "14px 50px 14px 18px",
            background: "var(--panel)", border: "1px solid var(--ring-md)",
            borderRadius: 12, color: "var(--text)", fontSize: 16,
            fontFamily: "var(--font-body)", outline: "none",
          }}
        />
        <button
          onClick={() => doSearch(query)}
          style={{
            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
            background: "var(--red)", border: "none", borderRadius: 8,
            color: "#fff", padding: "6px 14px", fontWeight: 700, cursor: "pointer",
          }}
        >Go</button>
      </div>

      {/* Game results from chart */}
      {gameResults.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div className="section-title" style={{ fontSize: 13, marginBottom: 10, color: "var(--muted)" }}>GAMES</div>
          {gameResults.map(g => (
            <a key={g.rank} href={`/game/${encodeURIComponent(g.name)}`}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--ring)", textDecoration: "none", color: "var(--text)" }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, overflow: "hidden", background: "var(--panel2)", flexShrink: 0 }}>
                {g.coverUrl && <img src={g.coverUrl} alt={g.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
              </div>
              <div>
                <div style={{ fontWeight: 700 }}>{g.name}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>#{g.rank} on GMN Hot 50 · {g.viewersLabel} viewers</div>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Article results */}
      {searched && (
        <div>
          <div className="section-title" style={{ fontSize: 13, marginBottom: 10, color: "var(--muted)" }}>
            {loading ? "SEARCHING…" : `ARTICLES (${results.length})`}
          </div>
          {!loading && results.length === 0 && <p style={{ color: "var(--muted)" }}>No articles found for "{query}"</p>}
          <div className="articles-grid">
            {results.map((a, i) => {
              const url = `/article-detail?url=${encodeURIComponent(a.link)}&title=${encodeURIComponent(a.title)}`;
              return (
                <article className="article-card" key={i}>
                  <a href={url}>
                    {a.image
                      ? <img className="article-thumb" src={a.image} alt={a.title} loading="lazy" />
                      : <div className="article-thumb skeleton-box" style={{ aspectRatio: "16/9" }} />
                    }
                  </a>
                  <div className="article-body">
                    <div className="article-meta">
                      <span className="badge">NEWS</span>
                      {a.date && <time className="micro" dateTime={a.date}>{timeAgo(a.date)}</time>}
                    </div>
                    <h2 className="article-title"><a href={url}>{a.title}</a></h2>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {!searched && query.length === 0 && (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>
          Type a game name or topic and press Enter or Go.
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   GAME DETAIL PAGE
───────────────────────────────────────── */
function GameDetailPage() {
  const { name } = useParams();
  const API_BASE   = useApiBase();
  const API_ORIGIN = useApiOrigin();
  const gameName = decodeURIComponent(name || "");

  const [game,    setGame]    = useState(null);
  const [articles,setArticles]= useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Find game in chart
        const r = await fetch(`${API_ORIGIN}/api/charts`);
        if (r.ok) {
          const d = await r.json();
          const found = (d.chart || []).find(g => g.name.toLowerCase() === gameName.toLowerCase());
          if (found) setGame(found);
        }
        // Find related articles
        const r2 = await fetch(`${API_BASE}?limit=20&offset=0`);
        if (r2.ok) {
          const { articles: arts } = await r2.json();
          const lower = gameName.toLowerCase().split(":")[0].trim();
          setArticles((arts || []).filter(a =>
            a.title?.toLowerCase().includes(lower) ||
            a.deck?.toLowerCase().includes(lower)
          ).slice(0, 6));
        }
      } catch {} finally { setLoading(false); }
    })();
  }, [gameName, API_ORIGIN, API_BASE]);

  if (loading) return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: "0 20px" }}>
      <div className="skeleton-box" style={{ height: 40, width: "60%", borderRadius: 8, marginBottom: 20 }} />
      <div className="skeleton-box" style={{ height: 200, borderRadius: 12 }} />
    </div>
  );

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px 60px" }}>
      {/* Back */}
      <a href="/" style={{ color: "var(--muted)", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 20, textDecoration: "none" }}>
        ← Back to Hot 50
      </a>

      {/* Game header */}
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", marginBottom: 28 }}>
        {game?.coverUrl && (
          <img src={game.coverUrl} alt={gameName}
            style={{ width: 100, height: 133, objectFit: "cover", borderRadius: 12, flexShrink: 0, border: "1px solid var(--ring)" }} />
        )}
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px,5vw,48px)", fontWeight: 900, textTransform: "uppercase", margin: "0 0 8px" }}>
            {gameName}
          </h1>
          {game && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              <span className="badge" style={{ background: "var(--red-glow)", color: "var(--red)", border: "1px solid rgba(255,50,50,0.3)" }}>
                #{game.rank} on GMN Hot 50
              </span>
              <span className="badge">{game.viewersLabel} viewers on Twitch</span>
              {game.steamLabel && <span className="badge">{game.steamLabel} on Steam</span>}
              <span className={`trend-pill ${trendClass(game.trend)}`}>{game.trendLabel}</span>
            </div>
          )}
          {!game && (
            <p style={{ color: "var(--muted)", fontSize: 14 }}>This game isn't currently in the Hot 50.</p>
          )}
        </div>
      </div>

      {/* Stats bar */}
      {game && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 28 }}>
          {[
            { label: "Twitch Rank",    value: `#${game.rank}` },
            { label: "Live Viewers",   value: game.viewersLabel || "—" },
            { label: "Steam Players",  value: game.steamLabel  || "N/A" },
            { label: "Trend",          value: game.trendLabel  || "—" },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: "14px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontFamily: "var(--font-display)", fontWeight: 900, color: "var(--text)" }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, fontWeight: 600, letterSpacing: "0.4px", textTransform: "uppercase" }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Related articles */}
      <div className="section-head" style={{ marginBottom: 14 }}>
        <h2 className="section-title" style={{ fontSize: 18 }}>Related News</h2>
      </div>
      {articles.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>No recent articles found for {gameName}.</p>
      ) : (
        <div className="articles-grid">
          {articles.map((a, i) => {
            const url = `/article-detail?url=${encodeURIComponent(a.link)}&title=${encodeURIComponent(a.title)}`;
            return (
              <article className="article-card" key={i}>
                <a href={url}>
                  {a.image
                    ? <img className="article-thumb" src={a.image} alt={a.title} loading="lazy" />
                    : <div className="article-thumb skeleton-box" style={{ aspectRatio: "16/9" }} />
                  }
                </a>
                <div className="article-body">
                  <div className="article-meta">
                    <span className="badge">NEWS</span>
                    {a.date && <time className="micro" dateTime={a.date}>{timeAgo(a.date)}</time>}
                  </div>
                  <h2 className="article-title"><a href={url}>{a.title}</a></h2>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   WEEKLY DIGEST PAGE
───────────────────────────────────────── */
function WeeklyDigestPage() {
  const API_ORIGIN = useApiOrigin();
  const API_BASE   = useApiBase();
  const [chart,   setChart]   = useState([]);
  const [score,   setScore]   = useState(null);
  const [news,    setNews]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [rc, rs, rn] = await Promise.all([
          fetch(`${API_ORIGIN}/api/charts`),
          fetch(`${API_ORIGIN}/api/charts/gmnscore`),
          fetch(`${API_BASE}?limit=5&offset=0`),
        ]);
        if (rc.ok) { const d = await rc.json(); setChart(d.chart || []); }
        if (rs.ok) setScore(await rs.json());
        if (rn.ok) { const d = await rn.json(); setNews(d.articles || []); }
      } catch {} finally { setLoading(false); }
    })();
  }, [API_ORIGIN, API_BASE]);

  const week = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const top3 = chart.slice(0, 3);
  const risers = chart.filter(g => g.trend === "up" || g.trend === "new").slice(0, 3);

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 20px 60px" }}>
      {/* Header */}
      <div style={{ borderBottom: "2px solid var(--red)", paddingBottom: 16, marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--red)", letterSpacing: "1.2px", marginBottom: 6 }}>GMN WEEKLY DIGEST</div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px,5vw,44px)", fontWeight: 900, textTransform: "uppercase", margin: "0 0 6px" }}>
          This Week in Gaming
        </h1>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>Week of {week}</div>
      </div>

      {loading ? (
        <div className="skeleton-box" style={{ height: 300, borderRadius: 12 }} />
      ) : (
        <>
          {/* Top 3 */}
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 900, textTransform: "uppercase", marginBottom: 14 }}>
              🏆 Top 3 This Week
            </h2>
            <div style={{ display: "grid", gap: 10 }}>
              {top3.map((g, i) => (
                <a key={g.rank} href={`/game/${encodeURIComponent(g.name)}`}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: 14, background: "var(--panel)", border: "1px solid var(--ring)", borderRadius: 12, textDecoration: "none", color: "var(--text)", transition: "border-color .15s" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 900, width: 36, textAlign: "center", color: i === 0 ? "var(--gold)" : i === 1 ? "#b0bec5" : "#cd7f32" }}>
                    {g.rank}
                  </div>
                  {g.coverUrl && (
                    <img src={g.coverUrl} alt={g.name} style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{g.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{g.viewersLabel} viewers on Twitch{g.steamLabel ? ` · ${g.steamLabel} on Steam` : ""}</div>
                  </div>
                  <span className={`trend-pill ${trendClass(g.trend)}`}>{g.trendLabel}</span>
                </a>
              ))}
            </div>
          </section>

          {/* Rising */}
          {risers.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 900, textTransform: "uppercase", marginBottom: 14 }}>
                📈 Rising This Week
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {risers.map(g => (
                  <a key={g.name} href={`/game/${encodeURIComponent(g.name)}`}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--panel)", border: "1px solid var(--ring)", borderRadius: 10, textDecoration: "none", color: "var(--text)" }}>
                    <span style={{ color: "var(--green)", fontWeight: 900, fontSize: 16 }}>↑</span>
                    <span style={{ flex: 1, fontWeight: 700 }}>{g.name}</span>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>#{g.rank} · {g.viewersLabel} viewers</span>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* GMN Score */}
          {score && (
            <section style={{ marginBottom: 32 }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 900, textTransform: "uppercase", marginBottom: 14 }}>
                ⭐ GMN Score of the Week
              </h2>
              <div className="card" style={{ padding: 20, display: "flex", gap: 16, alignItems: "center" }}>
                {score.coverUrl && (
                  <img src={score.coverUrl} alt={score.name} style={{ width: 70, height: 93, objectFit: "cover", borderRadius: 10, flexShrink: 0 }} />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{score.name}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>{score.developer} · {score.platforms}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 40, fontWeight: 900, color: "var(--gold)", lineHeight: 1 }}>{score.gmnScore}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--gold)" }}>
                        {score.gmnScore >= 90 ? "EXCEPTIONAL" : score.gmnScore >= 80 ? "GREAT" : "GOOD"}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>GMN Score / 100</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Latest news */}
          <section>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 900, textTransform: "uppercase", marginBottom: 14 }}>
              📰 Top Stories This Week
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {news.map((a, i) => {
                const url = `/article-detail?url=${encodeURIComponent(a.link)}&title=${encodeURIComponent(a.title)}`;
                return (
                  <a key={i} href={url}
                    style={{ display: "flex", gap: 14, padding: 14, background: "var(--panel)", border: "1px solid var(--ring)", borderRadius: 12, textDecoration: "none", color: "var(--text)", alignItems: "flex-start" }}>
                    {a.image && (
                      <img src={a.image} alt={a.title} style={{ width: 80, height: 52, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} loading="lazy" />
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.4 }}>{a.title}</div>
                      {a.date && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{timeAgo(a.date)}</div>}
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   SUBMIT REVIEW PAGE  (GMN Originals)
───────────────────────────────────────── */
function SubmitReviewPage() {
  const [form, setForm]       = useState({ game: "", score: 80, summary: "", gameplay: 80, story: 80, value: 80, reviewer: "" });
  const [submitted, setSubmitted] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const label = s => s >= 90 ? "Exceptional" : s >= 80 ? "Great" : s >= 70 ? "Good" : s >= 60 ? "Mixed" : "Poor";

  if (submitted) return (
    <div style={{ maxWidth: 600, margin: "60px auto", padding: "0 20px", textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🎮</div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 900, textTransform: "uppercase", marginBottom: 12 }}>Review Submitted!</h1>
      <p style={{ color: "var(--muted2)", marginBottom: 24 }}>Thanks for contributing to GMN News. Your review of <strong>{form.game}</strong> has been received.</p>
      <a href="/" className="btn-primary">Back to Home</a>
    </div>
  );

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "32px 20px 60px" }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "var(--red)", letterSpacing: "1.2px", marginBottom: 6 }}>GMN ORIGINALS</div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px,5vw,40px)", fontWeight: 900, textTransform: "uppercase", margin: "0 0 8px" }}>
          Submit a Review
        </h1>
        <p style={{ color: "var(--muted2)", fontSize: 14, margin: 0 }}>Share your take. Your voice makes GMN original.</p>
      </div>

      <form
        action="https://formspree.io/f/mqaybeaw"
        method="POST"
        onSubmit={() => setSubmitted(true)}
        style={{ display: "flex", flexDirection: "column", gap: 18 }}
      >
        <input type="hidden" name="_subject" value={`[GMN Review] ${form.game}`} />

        {/* Game name */}
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6, letterSpacing: "0.4px" }}>GAME TITLE *</label>
          <input name="game" required value={form.game} onChange={e => set("game", e.target.value)}
            placeholder="e.g. Monster Hunter Wilds"
            style={{ width: "100%", padding: "12px 14px", background: "var(--panel)", border: "1px solid var(--ring-md)", borderRadius: 10, color: "var(--text)", fontSize: 15, fontFamily: "var(--font-body)", outline: "none" }}
          />
        </div>

        {/* Reviewer */}
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6, letterSpacing: "0.4px" }}>YOUR NAME / HANDLE *</label>
          <input name="reviewer" required value={form.reviewer} onChange={e => set("reviewer", e.target.value)}
            placeholder="e.g. GamerTag123"
            style={{ width: "100%", padding: "12px 14px", background: "var(--panel)", border: "1px solid var(--ring-md)", borderRadius: 10, color: "var(--text)", fontSize: 15, fontFamily: "var(--font-body)", outline: "none" }}
          />
        </div>

        {/* Score sliders */}
        {[
          { key: "score",    label: "GMN SCORE (OVERALL)" },
          { key: "gameplay", label: "GAMEPLAY" },
          { key: "story",    label: "STORY / NARRATIVE" },
          { key: "value",    label: "VALUE FOR MONEY" },
        ].map(s => (
          <div key={s.key}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", letterSpacing: "0.4px" }}>{s.label}</label>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 900, color: "var(--gold)", lineHeight: 1 }}>{form[s.key]}</span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>— {label(form[s.key])}</span>
              </div>
            </div>
            <input type="hidden" name={s.key} value={form[s.key]} />
            <input type="range" min="0" max="100" value={form[s.key]}
              onChange={e => set(s.key, Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--red)" }}
            />
          </div>
        ))}

        {/* Summary */}
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6, letterSpacing: "0.4px" }}>YOUR REVIEW *</label>
          <textarea name="summary" required rows={6} value={form.summary} onChange={e => set("summary", e.target.value)}
            placeholder="Write your honest take on the game. What did you love? What fell short?"
            style={{ width: "100%", padding: "12px 14px", background: "var(--panel)", border: "1px solid var(--ring-md)", borderRadius: 10, color: "var(--text)", fontSize: 15, fontFamily: "var(--font-body)", outline: "none", resize: "vertical", minHeight: 140 }}
          />
        </div>

        <button type="submit" className="btn-primary" style={{ alignSelf: "flex-start", padding: "12px 28px", fontSize: 15, borderRadius: 12 }}>
          Submit Review →
        </button>
      </form>
    </div>
  );
}

/* ─────────────────────────────────────────
   404
───────────────────────────────────────── */
function NotFound() {
  return (
    <div className="page-hero" style={{ textAlign: "center" }}>
      <h1>404</h1>
      <p>That page is AFK.</p>
    </div>
  );
}
