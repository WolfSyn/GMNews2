// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Routes,
  Route,
  NavLink,
  useLocation,
  useNavigate,
  useSearchParams, // NEW
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
          {/* NEW: single-article reader route */}
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
    <NavLink to={href} className={`category-link ${active ? "active" : ""}`}>
      {label}
    </NavLink>
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

  return (
    <header className="header">
      {/* Top brand bar */}
      <nav className="site-nav">
        <div className="nav-inner">
          <NavLink to="/" className="logo" onClick={() => setOpen(false)}>
            <img
              src="/images/important_stuff.png"
              alt="GMN News"
              className="logo-img"
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
            <NavLink to="/articles">News</NavLink>
            <NavLink to="/articles?tag=reviews">Reviews</NavLink>
            <NavLink to="/articles?tag=releases">Releases</NavLink>
            <NavLink to="/blog">Features</NavLink>
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
    "PlayStation showcase rumored for next month",
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
          <a href="/privacy">Privacy Policy</a> · <a href="/support">Support</a>
        </p>
        <p>© {new Date().getFullYear()} GMN News • GMN Tech</p>
      </div>
    </footer>
  );
}

/* ================= Shared: API base ================= */
/* Accepts VITE_API_BASE as a domain, /api, or full /api/articles and normalizes it */
function useApiBase() {
  return useMemo(() => {
    const raw = import.meta.env.VITE_API_BASE?.trim(); // e.g. https://gmn-news-web.onrender.com
    const normalizeArticlesBase = (val) => {
      if (!val) return null;
      let v = val.replace(/\/+$/, ''); // strip trailing slashes
      if (/\/api\/articles$/i.test(v)) return v;        // already correct
      if (/\/api$/i.test(v)) return `${v}/articles`;     // ends with /api -> add /articles
      return `${v}/api/articles`;                        // just domain -> add /api/articles
    };

    const fromEnv = normalizeArticlesBase(raw);
    if (fromEnv) return fromEnv;

    // Fallbacks
    const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    return isLocal
      ? 'http://localhost:3000/api/articles'
      : 'https://gmn-news-web.onrender.com/api/articles';
  }, []);
}

/* Derive /api/article reader from the normalized /api/articles */
function useReaderBase() {
  const articlesBase = useApiBase();
  return useMemo(
    () => articlesBase.replace(/\/api\/articles$/i, '/api/article'),
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
        <div
          className="card"
          style={{ maxWidth: 900, margin: "12px auto", borderColor: "#fca5a5" }}
        >
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
              href={`/article-detail?url=${encodeURIComponent(
                Main.link
              )}&title=${encodeURIComponent(Main.title)}`}
            >
              {Main.image ? (
                <img src={Main.image} alt={Main.title} />
              ) : (
                <div className="hero-media placeholder" />
              )}
            </a>
          )}
          <div className="story-body">
            <span className="kicker">FEATURED</span>
            <h2 className="story-title">{Main ? Main.title : "Loading…"}</h2>
            <p className="story-deck">
              {Main?.deck || "A big headline space for the day’s top story."}
            </p>
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
                    ? `/article-detail?url=${encodeURIComponent(
                        s.link
                      )}&title=${encodeURIComponent(s.title)}`
                    : "#"
                }
              >
                {s?.image ? (
                  <img src={s.image} alt={s.title} />
                ) : (
                  <div className="thumb placeholder skeleton-box" />
                )}
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
          <NavLink className="link" to="/articles">
            See all →
          </NavLink>
        </div>
        <div className="articles-grid grid-3">
          {(loading ? Array.from({ length: 9 }) : latest).map((a, i) => (
            <article className="article-card card" key={i}>
              <a
                className="thumb-link"
                href={
                  a
                    ? `/article-detail?url=${encodeURIComponent(
                        a.link
                      )}&title=${encodeURIComponent(a.title)}`
                    : "#"
                }
              >
                {a?.image ? (
                  <img className="article-thumb" src={a.image} alt={a.title} />
                ) : (
                  <div className="article-thumb skeleton-box" />
                )}
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
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    const m = Math.floor(diff / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    return `${days}d ago`;
  };

  async function fetchArticles(reset = false) {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const nextOffset = reset ? 0 : offset;
      const params = new URLSearchParams({ limit: 20, offset: nextOffset });
      if (filter !== "all") params.set("tag", filter); // safe if server ignores
      const url = `${API_BASE}?${params}`;
      setLastUrl(url);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { articles, paging: pg } = await res.json();
      setItems(reset ? articles : [...items, ...articles]);
      setPaging(
        pg || {
          count: articles?.length ?? 0,
          hasMore: (articles?.length ?? 0) === 20,
        }
      );
      setOffset(nextOffset + (pg?.count || articles?.length || 0));
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
  }, [filter, API_BASE]); // eslint-disable-line

  // infinite scroll
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && paging.hasMore)
          fetchArticles();
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
      <header className="page-head">
        <h1>Latest Articles</h1>
        <div className="filters">
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
          style={{
            maxWidth: 900,
            margin: "0 auto 16px",
            borderColor: "#fca5a5",
          }}
        >
          <strong>Couldn’t load articles.</strong>{" "}
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

      <div className="articles-grid">
        {items.length === 0 && !loading && !error && (
          <p className="empty-msg">No articles yet.</p>
        )}

        {items.length === 0 &&
          loading &&
          Array.from({ length: 6 }).map((_, i) => (
            <div className="article-card skeleton" key={i}>
              <div className="article-thumb skeleton-box"></div>
              <h2 className="skeleton-box skeleton-text"></h2>
              <p className="skeleton-box skeleton-text"></p>
              <p className="skeleton-box skeleton-text short"></p>
            </div>
          ))}

        {items.map((a, i) => {
          const internalUrl = `/article-detail?url=${encodeURIComponent(
            a.link
          )}&title=${encodeURIComponent(a.title)}`;
          return (
            <article className="article-card" key={i}>
              {a.image && (
                <a className="thumb-link" href={internalUrl}>
                  <img
                    loading="lazy"
                    src={a.image}
                    alt={a.title}
                    className="article-thumb"
                  />
                </a>
              )}
              <div className="article-body">
                <div className="article-meta">
                  <span className="badge">Posted</span>{" "}
                  <time dateTime={a.date}>{timeAgo(a.date)}</time>
                </div>
                <h2 className="article-title">
                  <a href={internalUrl}>{a.title}</a>
                </h2>
                {a.deck && <p className="article-deck">{a.deck}</p>}
              </div>
            </article>
          );
        })}
      </div>

      {paging.hasMore && (
        <div className="load-more-wrapper">
          <button
            className="btn-secondary"
            disabled={loading}
            onClick={() => fetchArticles()}
          >
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

          {loading && <div className="card"><div className="skeleton-box" style={{height:180}}/></div>}

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
            The world’s largest gaming event takes over Cologne with conferences,
            demos, and community celebrations…
          </p>
          <a href="#" className="read-more">
            Read More →
          </a>
        </article>
        <article className="blog-post card">
          <h2 className="post-title">
            <a href="#">PlayStation Plus Essential: August 2025</a>
          </h2>
          <p className="post-meta">August 6, 2025 • Daniel Garcia</p>
          <p className="post-excerpt">
            This week we explore the top monthly titles making it into PS Plus…
          </p>
          <a href="#" className="read-more">
            Read More →
          </a>
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
          <p>
            From breaking news and patch notes to in-depth reviews and dev
            insights, GMN keeps you ahead.
          </p>
        </div>
        <div className="card">
          <h2>🤝 Our Community</h2>
          <p>
            Built by gamers, for gamers. Join and share your takes—because the
            best stories come from you.
          </p>
        </div>
        <div className="card">
          <h2>🚀 Our Promise</h2>
          <p>Fast. Reliable. Ad-light. No fluff—just signal.</p>
        </div>
      </section>
    </div>
  );
}

/* ================= Videos (stub) ================= */
function VideosPage() {
  return (
    <div className="videos-page">
      <section className="page-hero">
        <h1>Videos</h1>
        <p>Weekly recaps & interviews. Hook me to your YouTube API when ready.</p>
      </section>
      <div className="articles-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div className="card" key={i}>
            <div
              className="article-thumb skeleton-box"
              style={{ height: 160 }}
            ></div>
            <div className="micro" style={{ marginTop: 8 }}>
              Video placeholder {i + 1}
            </div>
          </div>
        ))}
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
          <a className="btn-primary" href="#contact">
            Start project
          </a>
          <a className="btn-ghost" href="#pricing">
            See pricing
          </a>
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
            <a className="btn-primary" href="#contact">
              Choose Starter
            </a>
          </article>
          <article className="plan card">
            <h3>Growth</h3>
            <p className="price">$5k–$12k</p>
            <ul>
              <li>Multi-page or module</li>
              <li>Design system + CMS</li>
              <li>Analytics + SEO</li>
            </ul>
            <a className="btn-primary" href="#contact">
              Choose Growth
            </a>
          </article>
          <article className="plan card best">
            <h3>Pro</h3>
            <p className="price">Custom</p>
            <ul>
              <li>Complex app or AI</li>
              <li>Integrations</li>
              <li>Support SLA</li>
            </ul>
            <a className="btn-primary" href="#contact">
              Talk to us
            </a>
          </article>
        </div>
        <p className="micro center">Final price after a quick discovery call.</p>
      </section>

      <section id="contact" className="contact card">
        <h2>Start a project</h2>
        <form
          className="lead-form"
          action="https://formspree.io/f/mzbldqoq"
          method="POST"
        >
          <div className="grid">
            <input name="name" placeholder="Your name" required />
            <input name="email" type="email" placeholder="Email" required />
          </div>
          <textarea
            name="message"
            rows="5"
            placeholder="What do you want to build?"
            required
          />
          <button className="btn-primary" type="submit">
            Send inquiry
          </button>
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
