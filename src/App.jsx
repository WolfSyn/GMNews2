// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Routes,
  Route,
  NavLink,
  Link, // ✅ added
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

/* ================= Root/App ================= */
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
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/articles" element={<ArticlesPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/videos" element={<VideosPage />} />
          <Route path="/tech" element={<TechPage />} />
          {/* ✅ NEW: Support route */}
          <Route path="/support" element={<SupportPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          {/* Single-article reader */}
          <Route path="/article-detail" element={<ArticleDetailPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/* ================= Header ================= */
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

  // figure out which top link should be active
  const loc = useLocation();
  const q = new URLSearchParams(loc.search);
  const tag = q.get("tag") || "all";
  const onArticles = loc.pathname === "/articles";

  return (
    <header className="header">
      {/* Top brand bar */}
      <nav className="site-nav">
        <div className="nav-inner">
          <NavLink to="/" className="logo" onClick={() => setOpen(false)}>
            <img
              src="/important_stuff.png"
              alt="GMN News"
              className="logo-img"
              width="140"
              height="120"
              loading="eager"
              decoding="async"
              fetchpriority="high"
            />
            <span>GMN News</span>
          </NavLink>
          <button
            className="menu-btn"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            ☰
          </button>
          <div className="nav-links" data-open={open}>
            <NavLink to="/" end>
              Home
            </NavLink>

            {/* Use Link with manual "active" so only one of these highlights */}
            <Link
              to="/articles"
              className={onArticles && (tag === "all" || tag === "news") ? "active" : ""}
            >
              News
            </Link>
            <Link
              to="/articles?tag=reviews"
              className={onArticles && tag === "reviews" ? "active" : ""}
            >
              Reviews
            </Link>
            <Link
              to="/articles?tag=releases"
              className={onArticles && tag === "releases" ? "active" : ""}
            >
              Releases
            </Link>

            {/* <NavLink to="/blog">Features</NavLink> */}
            <NavLink to="/videos">Videos</NavLink>
            <NavLink to="/tech">GMN Tech</NavLink>
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
  const items = [
    "Starfield update adds over 400 fixes",
    "PlayStation showcase out now",
    "Switch successor dev kits spotted",
    "Biggest releases this week",
  ];
  return (
    <div className="trending-bar">
      <div className="trend-label">TRENDING</div>
      <div className="trend-track">
        <div className="trend-marquee">
          {items.concat(items).map((t, i) => (
            <span className="trend-item" key={i}>
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================= Footer ================= */
function Footer() {
  return (
    <footer>
      <div className="footer-inner">
        <p>
          <Link to="/privacy">Privacy Policy</Link> · <Link to="/support">Support</Link>
        </p>
        <p>© {new Date().getFullYear()} GMN News • GMN Tech</p>
      </div>
    </footer>
  );
}

/* ================= Shared: API base (force remote default) ================= */
function useApiBase() {
  return useMemo(() => {
    const raw = import.meta.env.VITE_API_BASE?.trim();

    const normalize = (val) => {
      if (!val) return null;
      let s = val.trim();
      if (/^:?\d{2,5}$/.test(s)) {
        const port = s.replace(":", "");
        s = `http://localhost:${port}`;
      }
      if (/^[\w.-]+:\d{2,5}$/.test(s)) {
        s = `http://${s}`;
      }
      try {
        const u = new URL(s, window.location.origin);
        if (!/\/api\/articles\/?$/.test(u.pathname)) {
          u.pathname = u.pathname.replace(/\/+$/, "") + "/api/articles";
        }
        return (u.origin + u.pathname).replace(/\/$/, "");
      } catch {
        return null;
      }
    };

    const fromEnv = normalize(raw);
    if (fromEnv) return fromEnv;

    return "https://gmnews2.onrender.com/api/articles";
  }, []);
}

/* Derive /api/article reader from /api/articles base */
function useReaderBase() {
  const articlesBase = useApiBase();
  return useMemo(
    () => articlesBase.replace(/\/api\/articles\/?$/, "/api/article"),
    [articlesBase]
  );
}

/* ================= Helpers: API origin for non-articles endpoints ============ */
function useApiOrigin() {
  const base = useApiBase();
  return useMemo(() => {
    try {
      const u = new URL(base);
      return u.origin; // e.g. http://localhost:3000 or https://gmnews2.onrender.com
    } catch {
      return window.location.origin;
    }
  }, [base]);
}

/* Derive /api/videos from /api/articles base */
function useVideosBase() {
  const articlesBase = useApiBase();
  return useMemo(
    () => articlesBase.replace(/\/api\/articles\/?$/, "/api/videos"),
    [articlesBase]
  );
}

/* ✅ Derive /api/reviews from /api/articles base */
function useReviewsBase() {
  const articlesBase = useApiBase();
  return useMemo(
    () => articlesBase.replace(/\/api\/articles\/?$/, "/api/reviews"),
    [articlesBase]
  );
}

/* ================= Home ================= */
function HomePage() {
  const API_BASE = useApiBase();
  const [head, setHead] = useState([]);
  const [latest, setLatest] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r1 = await fetch(`${API_BASE}?limit=5&offset=0`);
        if (!r1.ok) throw new Error(`HTTP ${r1.status}`);
        const j1 = await r1.json();

        const r2 = await fetch(`${API_BASE}?limit=12&offset=5`);
        if (!r2.ok) throw new Error(`HTTP ${r2.status}`);
        const j2 = await r2.json();

        setHead(j1.articles || []);
        setLatest(j2.articles || []);
        setError(null);
      } catch (e) {
        console.error("Home fetch error:", e);
        setError(e.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [API_BASE]);

  const Main = head[0];
  const Side = head.slice(1, 5);

  return (
    <div className="home light">
      {error && (
        <div className="card" style={{ maxWidth: 900, margin: "12px auto", borderColor: "#fca5a5" }}>
          <strong>Couldn’t load home feed.</strong>{" "}
          <span className="micro">({error})</span>
        </div>
      )}

      {/* Featured */}
      <section className="featured-grid">
        {/* MAIN STORY */}
        <article className="story-main card">
          {loading || !Main ? (
            <div className="hero-media skeleton-box" />
          ) : (
            <a
              className="hero-media"
              href={`/article-detail?url=${encodeURIComponent(Main.link)}&title=${encodeURIComponent(Main.title)}`}
            >
              {Main.image ? <img src={Main.image} alt={Main.title} /> : <div className="hero-media placeholder" />}
            </a>
          )}
          <div className="story-body">
            <span className="kicker">FEATURED</span>
            <h2 className="story-title">{Main ? Main.title : "Loading…"}</h2>
            <p className="story-deck">{Main?.deck || "A big headline space for the day’s top story."}</p>
          </div>
        </article>

        {/* SIDE STORIES */}
        <div className="story-side">
          {(loading ? Array.from({ length: 4 }) : Side).map((s, i) => (
            <article className="story card story-sm" key={i}>
              <a
                className="thumb"
                href={
                  s
                    ? `/article-detail?url=${encodeURIComponent(s.link)}&title=${encodeURIComponent(s.title)}`
                    : "#"
                }
              >
                {s?.image ? <img src={s.image} alt={s.title} /> : <div className="thumb placeholder skeleton-box" />}
              </a>
              <div className="story-body">
                <span className="kicker">NEWS</span>
                <h3 className="story-title-sm">{s ? s.title : "Loading…"}</h3>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Latest grid */}
      <section className="latest">
        <div className="section-head">
          <h2 className="section-title">Latest</h2>
        </div>
        <div className="articles-grid grid-3">
          {(loading ? Array.from({ length: 9 }) : latest).map((a, i) => (
            <article className="article-card card" key={i}>
              <a
                className="thumb-link"
                href={
                  a
                    ? `/article-detail?url=${encodeURIComponent(a.link)}&title=${encodeURIComponent(a.title)}`
                    : "#"
                }
              >
                {a?.image ? <img className="article-thumb" src={a.image} alt={a.title} /> : <div className="article-thumb skeleton-box" />}
              </a>
              <div className="article-body">
                <div className="article-meta">
                  <span className="badge">Posted</span>
                </div>
                <h3 className="article-title">{a ? a.title : "Loading…"}</h3>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ================= Articles ================= */
function ArticlesPage() {
  const API_BASE = useApiBase();
  const REVIEWS_BASE = useReviewsBase();                // 👈 new
  const loc = useLocation();
  const navigate = useNavigate();

  // derive tag from URL
  const startTag = new URLSearchParams(loc.search).get("tag") || "all";

  // local state (+ error + lastUrl)
  const [items, setItems] = useState([]);
  const [paging, setPaging] = useState({ count: 0, hasMore: true });
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState(startTag);
  const [error, setError] = useState(null);
  const [lastUrl, setLastUrl] = useState("");
  const loadMoreRef = useRef(null);

  // keep filter in sync with URL (?tag=...)
  useEffect(() => {
    if (filter !== startTag) setFilter(startTag);
  }, [startTag]); // eslint-disable-line

  const timeAgo = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const diff = (Date.now() - d.getTime()) / 1000;
    const m = Math.floor(diff / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    return `${days}d ago`;
  };

  // simple client-side filters for platform + type (for articles only)
  const PLATFORM_RE = {
    pc: /(PC|Windows|Steam|Epic)\b/i,
    playstation: /(PlayStation|PS5|PS4|Sony)\b/i,
    xbox: /(Xbox|Series X|Series S|Game Pass)\b/i,
    nintendo: /(Nintendo|Switch)\b/i,
    mobile: /(Mobile|iOS|Android|iPhone|iPad|Google Play)\b/i,
  };
  const TYPE_RE = {
    releases: /\b(release|released|launch|launches|launching)\b/i,
  };

  async function fetchArticles(reset = false) {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const nextOffset = reset ? 0 : offset;

      // 👇 choose endpoint: use /api/reviews when Reviews tab is active
      const base = filter === "reviews" ? REVIEWS_BASE : API_BASE;
      const params = new URLSearchParams({ limit: 20, offset: nextOffset });

      // only send tag=... to /api/articles (server ignores it anyway);
      // do NOT send tag when using /api/reviews
      if (filter !== "all" && filter !== "reviews") params.set("tag", filter);

      const url = `${base}?${params}`;
      setLastUrl(url);

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { articles, paging: pg } = await res.json();

      // apply client filters only for /api/articles
      let list = articles || [];
      if (filter !== "reviews") {
        const haystack = (a) => [a.title, a.deck, a.link].filter(Boolean).join(" ");
        if (PLATFORM_RE[filter]) {
          const re = PLATFORM_RE[filter];
          list = list.filter((a) => re.test(haystack(a)));
        } else if (TYPE_RE[filter]) {
          const re = TYPE_RE[filter];
          list = list.filter((a) => re.test(haystack(a)));
        }
      }

      setItems(reset ? list : [...items, ...list]);
      setPaging(
        pg || {
          count: list.length,
          hasMore: list.length === 20,
        }
      );
      setOffset(nextOffset + (pg?.count || list.length || 0));
    } catch (e) {
      console.error("load fail", e);
      setError(e.message || "Failed to load articles");
    } finally {
      setLoading(false);
    }
  }

  // (re)load when filter or API base changes
  useEffect(() => {
    setItems([]);
    setOffset(0);
    setPaging({ count: 0, hasMore: true });
    fetchArticles(true);
  }, [filter, API_BASE, REVIEWS_BASE]); // eslint-disable-line

  // infinite scroll
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && paging.hasMore) fetchArticles();
      },
      { rootMargin: "600px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [paging.hasMore]); // eslint-disable-line

  // clicking chips updates URL
  const goToTag = (tag) =>
    navigate(tag === "all" ? "/articles" : `/articles?tag=${tag}`);

  return (
    <div className="articles-page">
      {/* Centered heading + filters */}
      <header
        className="page-head"
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 16px",
          textAlign: "center",
        }}
      >
        <h1 style={{ margin: "0 0 10px" }}>Latest Articles</h1>

        <div
          className="filters"
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {["all", "news", "reviews", "releases"].map((tag) => (
            <button
              key={tag}
              className={`chip ${filter === tag ? "is-active" : ""}`}
              onClick={() => goToTag(tag)}
            >
              {tag[0].toUpperCase() + tag.slice(1)}
            </button>
          ))}
        </div>
      </header>

      {/* Error + debug link */}
      {error && (
        <div
          className="card"
          style={{ maxWidth: 900, margin: "0 auto 16px", borderColor: "#fca5a5" }}
        >
          <strong>Couldn’t load feed.</strong>{" "}
          <span className="micro">({error})</span>
          {lastUrl && (
            <>
              <br />
              <a className="link" href={lastUrl} target="_blank" rel="noreferrer">
                Open last request
              </a>
            </>
          )}
        </div>
      )}

      {/* Cards */}
      <div className="articles-grid grid-3">
        {items.length === 0 && !loading && !error && (
          <p className="empty-msg">No items yet.</p>
        )}

        {items.length === 0 &&
          loading &&
          Array.from({ length: 6 }).map((_, i) => (
            <div className="article-card card skeleton" key={i}>
              <div className="article-thumb skeleton-box" style={{ aspectRatio: "16 / 9" }} />
              <h2 className="skeleton-box skeleton-text"></h2>
              <p className="skeleton-box skeleton-text"></p>
              <p className="skeleton-box skeleton-text short"></p>
            </div>
          ))}

        {items.map((a, i) => {
          const internalUrl = `/article-detail?url=${encodeURIComponent(a.link)}&title=${encodeURIComponent(a.title)}`;
          return (
            <article className="article-card card" key={i}>
              <a
                className="thumb-link"
                href={internalUrl}
                style={{ display: "block", borderRadius: 12, overflow: "hidden" }}
              >
                {a.image ? (
                  <img
                    loading="lazy"
                    src={a.image}
                    alt={a.title}
                    className="article-thumb"
                    style={{
                      width: "100%",
                      aspectRatio: "16 / 9",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                ) : (
                  <div className="article-thumb skeleton-box" style={{ aspectRatio: "16 / 9" }} />
                )}
              </a>
              <div className="article-body">
                <div className="article-meta">
                  <span className="badge">Posted</span>{" "}
                  {a.date && <time dateTime={a.date}>{timeAgo(a.date)}</time>}
                  {typeof a.score === "number" && (
                    <span className="badge" style={{ marginLeft: 8 }}>
                      ⭐ {a.score}
                    </span>
                  )}
                </div>
                <h2 className="article-title">
                  <a href={internalUrl}>{a.title}</a>
                </h2>
                {/* Optional deck */}
                {/* {a.deck && <p className="article-deck">{a.deck}</p>} */}
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


/* ================= Article Detail (Reader) ================= */
function ArticleDetailPage() {
  const readerBase = useReaderBase();
  const [sp] = useSearchParams();
  const url = sp.get("url");
  const title = sp.get("title") || "Article";
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(!!url);

  useEffect(() => {
    if (!url) return;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const r = await fetch(`${readerBase}?url=${encodeURIComponent(url)}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        setData(j);
      } catch (e) {
        console.error("reader error:", e);
        setErr(e.message || "Failed to load article");
      } finally {
        setLoading(false);
      }
    })();
  }, [readerBase, url]);

  return (
    <div className="page-hero" style={{ maxWidth: 900, margin: "24px auto", padding: "0 16px" }}>
      {!url && (
        <div className="card" style={{ borderColor: "#fca5a5" }}>
          <strong>Missing article URL.</strong>{" "}
          <span className="micro">
            This page expects <code>?url=</code> to be a full GameSpot link (e.g.
            <br />
            <code>https://www.gamespot.com/articles/…/1100-6534768/</code>).
          </span>
        </div>
      )}

      {url && (
        <>
          <h1>{data?.title || title}</h1>
          {data?.byline && <p className="micro">{data.byline}</p>}

          {loading && (
            <div className="card">
              <div className="skeleton-box" style={{ height: 180 }} />
            </div>
          )}

          {err && (
            <div className="card" style={{ borderColor: "#fca5a5" }}>
              <strong>Couldn’t load article.</strong> <span className="micro">({err})</span>
            </div>
          )}

          {data?.leadImage && (
            <div style={{ margin: "14px 0" }}>
              <img src={data.leadImage} alt="" style={{ width: "100%", borderRadius: 12 }} />
            </div>
          )}

          {data?.html && (
            <div className="card" style={{ padding: 16 }}>
              <div dangerouslySetInnerHTML={{ __html: data.html }} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ================= Blog ================= */
function BlogPage() {
  return (
    <div className="blog-page">
      <section className="page-hero">
        <h1>GMN News Blog</h1>
        <p>Deep-dives, interviews, and culture.</p>
      </section>
      <section className="blog-list">
        <article className="blog-post card">
          <h2 className="post-title">
            <a href="#">Gamescom 2025: What to Expect</a>
          </h2>
          <p className="post-meta">August 2025 • GMN News Editorial</p>
          <p className="post-excerpt">
            The world’s largest gaming event takes over Cologne with conferences, demos, and community celebrations…
          </p>
          <a href="#" className="read-more">Read More →</a>
        </article>
        <article className="blog-post card">
          <h2 className="post-title">
            <a href="#">PlayStation Plus Essential: August 2025</a>
          </h2>
          <p className="post-meta">August 6, 2025 • Daniel Garcia</p>
          <p className="post-excerpt">
            This week we explore the top monthly titles making it into PS Plus…
          </p>
          <a href="#" className="read-more">Read More →</a>
        </article>
      </section>
    </div>
  );
}

/* ================= About ================= */
function AboutPage() {
  return (
    <div className="about-page">
      <section className="page-hero">
        <h1>Welcome to GMN News</h1>
        <p>Powering your gaming passion, one headline at a time.</p>
      </section>
      <section className="about-content">
        <div className="card">
          <h2>🎯 Our Mission</h2>
          <p>From breaking news and patch notes to in-depth reviews and dev insights, GMN keeps you ahead.</p>
        </div>
        <div className="card">
          <h2>🤝 Our Community</h2>
          <p>Built by gamers, for gamers. Join and share your takes—because the best stories come from you.</p>
        </div>
        <div className="card">
          <h2>🚀 Our Promise</h2>
          <p>Fast. Reliable. Ad-light. No fluff—just signal.</p>
        </div>
      </section>
    </div>
  );
}

/* ================= Support ================= */
function SupportPage() {
  const loc = useLocation();
  const sent = new URLSearchParams(loc.search).get("sent") === "1";
  const redirectUrl =
    (typeof window !== "undefined"
      ? `${window.location.origin}/support?sent=1`
      : "/support?sent=1");

  return (
    <div className="support-page">
      <section className="page-hero" style={{ textAlign: "center" }}>
        <h1>Support</h1>
        <p>Found a bug or have feedback? Tell us below — we read everything.</p>
      </section>

      {sent && (
        <div
          className="card"
          style={{ maxWidth: 900, margin: "0 auto 16px", borderColor: "#86efac" }}
        >
          <strong>Thanks!</strong>{" "}
          <span className="micro">We got your message and will follow up if needed.</span>
        </div>
      )}

      <section className="card support-card">
        <form
          className="lead-form"
          action="https://formspree.io/f/mqaybeaw"
          method="POST"
        >
          {/* Formspree helpers */}
          <input type="hidden" name="_subject" value="[GMN Support] New submission" />
          <input type="hidden" name="_redirect" value={redirectUrl} />
          {/* Honeypot */}
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

          <input
            name="subject"
            placeholder='Short title (e.g., “Cards overlap on mobile”)'
            required
          />

          <div className="grid twocol">
            <textarea
              name="details"
              rows="6"
              required
              placeholder="What happened? Steps to reproduce, expected vs actual, device/OS, browser…"
            />
            <input
              name="screenshot"
              type="url"
              placeholder="Screenshot / video link (optional)"
            />
          </div>

          <label className="micro agree">
            By submitting, you agree we may contact you about this issue.
          </label>

          <button className="btn-primary" type="submit">Submit</button>
        </form>
      </section>

      {/* 🔒 Scoped styles: only affect .support-page */}
      <style>{`
        .support-page .support-card {
          max-width: 980px;
          margin: 0 auto 28px;
          padding: 22px;
          border-radius: 20px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 20px 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.02);
          backdrop-filter: blur(6px);
        }

        .support-page .lead-form {
          display: grid;
          gap: 14px;
        }

        .support-page .lead-form .grid.twocol {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        @media (max-width: 760px) {
          .support-page .lead-form .grid.twocol {
            grid-template-columns: 1fr;
          }
        }

        .support-page input,
        .support-page select,
        .support-page textarea {
          width: 100%;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(255,255,255,0.03);
          color: #e5e7eb;
          font-size: 16px;
          padding: 12px 14px;
          outline: none;
          transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
        }

        .support-page textarea {
          min-height: 160px;
          resize: vertical;
        }

        .support-page input::placeholder,
        .support-page textarea::placeholder {
          color: #9ca3af;
        }

        .support-page input:focus,
        .support-page select:focus,
        .support-page textarea:focus {
          border-color: #60a5fa;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.25);
          background: rgba(255,255,255,0.05);
        }

        .support-page select {
          appearance: none;
          background-image:
            linear-gradient(45deg, transparent 50%, #9ca3af 50%),
            linear-gradient(135deg, #9ca3af 50%, transparent 50%);
          background-position:
            calc(100% - 18px) calc(50% - 3px),
            calc(100% - 12px) calc(50% - 3px);
          background-size: 6px 6px, 6px 6px;
          background-repeat: no-repeat;
          padding-right: 36px;
        }

        .support-page .agree {
          color: #9aa3b2;
          margin-top: 2px;
        }

        .support-page .btn-primary {
          height: 46px;
          padding: 0 18px;
          border-radius: 12px;
          font-weight: 700;
          border: none;
          background: linear-gradient(180deg, #3b82f6, #2563eb);
          color: white;
          box-shadow: 0 8px 24px rgba(37,99,235,0.35);
          cursor: pointer;
          transition: transform .04s ease, box-shadow .15s ease, filter .15s ease;
        }
        .support-page .btn-primary:hover {
          filter: brightness(1.03);
          box-shadow: 0 10px 32px rgba(37,99,235,0.45);
        }
        .support-page .btn-primary:active {
          transform: translateY(1px);
        }
      `}</style>
    </div>
  );
}

/* ================= Privacy ================= */
function PrivacyPage() {
  const today = new Date().toLocaleDateString();

  return (
    <div className="privacy-page">
      <section className="page-hero" style={{ textAlign: "center" }}>
        <h1>Privacy Policy</h1>
        <p>We collect as little as possible, use it only to run GMN News, and never sell your data.</p>
      </section>

      <section className="card policy-card">
        <h2>Quick summary</h2>
        <ul className="bullets">
          <li>No accounts.</li>
          <li>Support/contact forms send us your name, email, and message via Formspree.</li>
          <li>Our server keeps minimal logs (IP, user agent) for security and debugging.</li>
          <li>We never sell your personal information.</li>
        </ul>

        <h2>What we collect</h2>
        <h3>Support & contact forms</h3>
        <p>
          When you submit a form on <Link to="/support">Support</Link> or our contact form,
          we receive the fields you provide (e.g., name, email, subject, details, and optional links).
          Submissions are delivered by Formspree and then routed to our inbox.
        </p>

        <h3>Server logs</h3>
        <p>
          Like most websites, our hosting environment records standard logs (IP address, user agent,
          referrer, timestamps) to operate the service, defend against abuse, and diagnose issues.
          We do not build personal profiles from these logs.
        </p>

        <h3>Content APIs</h3>
        <p>
          Articles are fetched from GameSpot’s public API; videos are listed via the YouTube Data API.
          We don’t send your personal data to these providers—requests are made from our server.
          If you follow a link to an external site (e.g., gamespot.com or youtube.com), their privacy
          policies apply.
        </p>

        <h2>Cookies & tracking</h2>
        <p>
          We don’t use advertising cookies or cross-site tracking. If we add basic first-party analytics
          in the future, we’ll update this page and keep it privacy-friendly.
        </p>

        <h2>How we use your information</h2>
        <ul className="bullets">
          <li>Respond to your support requests and feedback.</li>
          <li>Operate, maintain, and improve the site.</li>
          <li>Protect against fraud, abuse, and security incidents.</li>
        </ul>

        <h2>Sharing</h2>
        <p>
          We don’t sell your data. We share it only with service providers who help us run GMN News
          (for example: hosting and Formspree for form delivery) under appropriate agreements.
        </p>

        <h2>Data retention</h2>
        <p>
          Support emails and related correspondence are kept as long as reasonably necessary to
          handle your request and maintain service history. Server logs are kept for a limited period
          and then rotated or deleted.
        </p>

        <h2>Your choices & rights</h2>
        <p>
          You can request access to or deletion of support submissions that include your information.
          Email us at <a href="mailto:gmn.news.official@gmail.com">gmn.news.official@gmail.com</a>.
        </p>

        <h2>Children</h2>
        <p>
          GMN News is not directed to children under 13. If you believe a child provided us personal
          information, contact us and we’ll delete it.
        </p>

        <h2>Security</h2>
        <p>
          We use reasonable safeguards to protect your information. No method of transmission or storage
          is 100% secure, so we can’t guarantee absolute security.
        </p>

        <h2>Changes to this policy</h2>
        <p>
          We may update this page to reflect changes in our practices. We’ll revise the effective date
          below when that happens.
        </p>

        <h2>Contact</h2>
        <p>
          Questions? Email <a href="mailto:gmn.news.official@gmail.com">gmn.news.official@gmail.com</a>
        </p>

        <p className="micro">Effective date: {today}</p>
      </section>

      {/* Scoped styles so we don’t affect the rest of your site */}
      <style>{`
        .privacy-page .policy-card {
          max-width: 900px;
          margin: 0 auto 28px;
          padding: 22px;
          border-radius: 20px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 20px 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.02);
          backdrop-filter: blur(6px);
        }
        .privacy-page h2 {
          margin-top: 18px;
          margin-bottom: 8px;
          font-size: 20px;
        }
        .privacy-page h3 {
          margin-top: 14px;
          margin-bottom: 6px;
          font-size: 17px;
          opacity: .95;
        }
        .privacy-page p { line-height: 1.6; }
        .privacy-page .bullets {
          padding-left: 18px;
          margin: 8px 0 12px;
        }
        .privacy-page .bullets li {
          margin: 6px 0;
        }
        .privacy-page .micro {
          color: #9aa3b2;
          margin-top: 10px;
        }
      `}</style>
    </div>
  );
}

/* ================= Videos ================= */
function VideosPage() {
  const API_ORIGIN = useApiOrigin();
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [prevCursor, setPrevCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load(cursor = null) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: 12 });
      if (cursor) params.set("cursor", cursor);
      const r = await fetch(`${API_ORIGIN}/api/videos?${params}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();

      // Accept either {items: [...]} or {videos: [...]}
      const arr = Array.isArray(j.videos) ? j.videos : (Array.isArray(j.items) ? j.items : []);
      setItems(arr);

      const pg = j.paging || {};
      setNextCursor(pg.next ?? pg.nextCursor ?? pg.nextPageToken ?? null);
      setPrevCursor(pg.prev ?? pg.prevCursor ?? pg.prevPageToken ?? null);
    } catch (e) {
      console.error("videos load fail", e);
      setError(e.message || "Failed to load videos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(null); }, [API_ORIGIN]);

  return (
    <div className="videos-page">
      <section className="page-hero">
        <h1>Videos</h1>
        <p>Latest uploads from GMN News.</p>
      </section>

      {error && (
        <div className="card" style={{ maxWidth: 900, margin: "0 auto 16px", borderColor: "#fca5a5" }}>
          <strong>Couldn’t load videos.</strong> <span className="micro">({error})</span>
        </div>
      )}

      <div className="articles-grid grid-4">
        {loading &&
          Array.from({ length: 8 }).map((_, i) => (
            <div className="card" key={i}>
              <div className="article-thumb skeleton-box" style={{ aspectRatio: "16/9" }} />
              <div className="skeleton-box skeleton-text" style={{ margin: "12px" }} />
            </div>
          ))}

        {!loading && items.length === 0 && (
          <p className="empty-msg">No videos yet.</p>
        )}

        {!loading && items.map((v, i) => {
          // Normalize fields from API
          const id = v.id ?? i;
          const link = v.link ?? v.url ?? (v.id ? `https://www.youtube.com/watch?v=${v.id}` : "#");
          const thumb = v.thumbnail ?? v.thumb ?? v.thumbUrl ?? v.thumbs?.medium ?? v.thumbs?.default;
          const publishedAt = v.publishedAt ?? v.published_at;

          return (
            <article className="article-card card" key={id}>
              <a className="thumb-link" href={link} target="_blank" rel="noreferrer">
                {thumb ? (
                  <img className="article-thumb" src={thumb} alt={v.title} style={{ aspectRatio: "16/9" }} />
                ) : (
                  <div className="article-thumb skeleton-box" style={{ aspectRatio: "16/9" }} />
                )}
              </a>
              <div className="article-body">
                <div className="article-meta">
                  <span className="badge">YouTube</span>{" "}
                  {publishedAt && (
                    <time dateTime={publishedAt}>
                      {new Date(publishedAt).toLocaleDateString()}
                    </time>
                  )}
                </div>
                <h2 className="article-title">
                  <a href={link} target="_blank" rel="noreferrer">
                    {v.title}
                  </a>
                </h2>
              </div>
            </article>
          );
        })}
      </div>

      <div className="load-more-wrapper" style={{ gap: 12, display: "flex", justifyContent: "center" }}>
        <button className="btn-secondary" disabled={!prevCursor || loading} onClick={() => load(prevCursor)}>
          Prev
        </button>
        <button className="btn-secondary" disabled={!nextCursor || loading} onClick={() => load(nextCursor)}>
          Next
        </button>
      </div>
    </div>
  );
}

/* ================= Tech ================= */
function TechPage() {
  return (
    <div className="tech-page">
      <section className="page-hero">
        <h1>GMN Tech</h1>
        <p>Websites, apps, and AI—delivered with speed and quality.</p>
        <div className="hero-actions">
          <a className="btn-primary" href="#contact">Start project</a>
          <a className="btn-ghost" href="#pricing">See pricing</a>
        </div>
      </section>

      <section className="service-grid-wrap">
        <ul className="service-grid">
          <li className="card">
            <h3>Websites & Stores</h3>
            <p>React/Vite/Tailwind, CMS, SEO.</p>
          </li>
          <li className="card">
            <h3>Mobile Apps</h3>
            <p>SwiftUI, Kotlin, PWAs, store deploy.</p>
          </li>
          <li className="card">
            <h3>AI Solutions</h3>
            <p>Chatbots, RAG, analytics, automations.</p>
          </li>
          <li className="card">
            <h3>Support & Success</h3>
            <p>SLAs, monitoring, QA automation.</p>
          </li>
        </ul>
      </section>

      <section id="process" className="process">
        <h2>How we work</h2>
        <ol className="steps">
          <li className="card">
            <h3>1) Discover & Scope</h3>
            <p>We map goals, users, and constraints; you get a clear plan.</p>
          </li>
          <li className="card">
            <h3>2) Design & Build</h3>
            <p>Design system, dev sprints, weekly demos, and staging links.</p>
          </li>
          <li className="card">
            <h3>3) Launch & Support</h3>
            <p>Deploy, monitor, fix fast, and iterate with your feedback.</p>
          </li>
        </ol>
      </section>

      <section id="pricing" className="pricing">
        <h2>Flexible pricing</h2>
        <div className="pricing-grid">
          <article className="plan card">
            <h3>Starter</h3>
            <p className="price">$1.5k–$3k</p>
            <ul>
              <li>1–3 pages or MVP</li>
              <li>Brand styling</li>
              <li>Cloudflare Pages</li>
            </ul>
            <a className="btn-primary" href="#contact">Choose Starter</a>
          </article>
          <article className="plan card">
            <h3>Growth</h3>
            <p className="price">$5k–$12k</p>
            <ul>
              <li>Multi-page or module</li>
              <li>Design system + CMS</li>
              <li>Analytics + SEO</li>
            </ul>
            <a className="btn-primary" href="#contact">Choose Growth</a>
          </article>
          <article className="plan card best">
            <h3>Pro</h3>
            <p className="price">Custom</p>
            <ul>
              <li>Complex app or AI</li>
              <li>Integrations</li>
              <li>Support SLA</li>
            </ul>
            <a className="btn-primary" href="#contact">Talk to us</a>
          </article>
        </div>
        <p className="micro center">Final price after a quick discovery call.</p>
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
        <p className="micro">
          Prefer email? <a href="mailto:BigZ12123@gmail.com">BigZ12123@gmail.com</a>
        </p>
      </section>
    </div>
  );
}

/* ================= 404 ================= */
function NotFound() {
  return (
    <div className="page-hero" style={{ textAlign: "center" }}>
      <h1>404</h1>
      <p>That page is AFK.</p>
    </div>
  );
}
