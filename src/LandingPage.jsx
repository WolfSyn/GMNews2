// src/LandingPage.jsx — marketing landing page shown at "/".
// The live Billboard (Hot 50) lives at "/billboard" and in the top nav.
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import LandingHero, { AnalyticsPanel } from "./LandingHero";

const CSS = `
@import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap");
.lp {
  overflow-x: clip; padding-bottom: 56px; font-family: "Space Grotesk", var(--font-body, system-ui), sans-serif;
  background:
    radial-gradient(1100px 520px at 50% -60px, rgba(46,76,200,.34), transparent 65%),
    linear-gradient(#0b1226 0, #0b1020 620px, #0a0a0f 1300px);
}
.lp-sec { max-width: 1100px; margin: 0 auto; padding: 0 20px; }
.lp-block { margin-top: 84px; }
.lp-label { font-size: 12px; font-weight: 700; letter-spacing: 1.6px; color: var(--red, #ff3b3b); margin-bottom: 12px; }
.lp h2 { font-family: "Space Grotesk", system-ui, sans-serif; font-size: clamp(28px, 4vw, 40px); font-weight: 500; letter-spacing: -.5px; line-height: 1.1; margin: 0 0 14px; color: #f4f6ff; text-transform: none; }
.lp-lead { color: #a8b0d0; font-size: 17px; line-height: 1.65; max-width: 620px; margin: 0 0 26px; }

.lp-split { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; }

.lp-feats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.lp-feat { border: 1px solid rgba(255,255,255,.09); border-radius: 14px; padding: 22px; background: rgba(255,255,255,.03); text-decoration: none; color: inherit; transition: border-color .15s, transform .15s, background .15s; display: block; }
.lp-feat:hover { border-color: rgba(255,255,255,.28); background: rgba(255,255,255,.05); transform: translateY(-2px); }
.lp-feat h3 { font-size: 18px; font-weight: 600; margin: 0 0 8px; color: #fff; }
.lp-feat p { color: #a8b0d0; font-size: 14px; line-height: 1.6; margin: 0; }

.lp-news { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.lp-art { border: 1px solid rgba(255,255,255,.09); border-radius: 14px; overflow: hidden; background: rgba(255,255,255,.03); text-decoration: none; color: inherit; display: block; }
.lp-art:hover { border-color: rgba(255,255,255,.28); }
.lp-art img { width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block; background: #1b2033; }
.lp-art div { padding: 14px 16px 16px; }
.lp-art small { color: var(--red, #ff3b3b); font-weight: 700; font-size: 11px; letter-spacing: .8px; text-transform: uppercase; }
.lp-art p { margin: 6px 0 0; font-weight: 600; line-height: 1.35; font-size: 15px; color: #fff; }
.lp-more { display: inline-block; margin-top: 16px; font-weight: 600; font-size: 14px; color: #a8b0d0; text-decoration: none; }
.lp-more:hover { color: #fff; }

.lp-data { border: 1px solid rgba(255,255,255,.1); border-radius: 20px; padding: 44px 44px; display: grid; grid-template-columns: 1.2fr .8fr; gap: 34px; align-items: center;
  background: radial-gradient(700px 300px at 100% 0%, rgba(46,76,200,.25), transparent 60%), rgba(255,255,255,.03); }
.lp-data ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 12px; color: #c9cfe6; font-size: 15px; }
.lp-data li::before { content: "▸ "; color: var(--red, #ff3b3b); }

.lp-sub { border: 1px solid rgba(255,255,255,.1); border-radius: 20px; padding: 44px 40px; text-align: center; background: rgba(255,255,255,.03); }
.lp-sub .lp-lead { margin-left: auto; margin-right: auto; }
.lp-sub-form { max-width: 460px; margin: 0 auto; text-align: left; }

.lp-cta { text-align: center; }
.lp-cta .lp-lead { margin-left: auto; margin-right: auto; }

@media (max-width: 860px) {
  .lp-block { margin-top: 60px; }
  .lp-split, .lp-data { grid-template-columns: 1fr; gap: 26px; }
  .lp-feats, .lp-news { grid-template-columns: 1fr; }
  .lp-data { padding: 28px 22px; }
  .lp-sub { padding: 28px 20px; }
}
`;

const FEATURES = [
  ["GMN Hot 50", "The most-watched games on Twitch right now, ranked by live viewers and enriched with Steam player counts.", "/billboard"],
  ["Daily history", "We snapshot the top 200 games every night, so you can see who is climbing, falling or new.", "/charts"],
  ["GMN Score", "Our monthly pick, scored across critics, players and our own take. No fluff, just signal.", "/billboard"],
  ["Gaming news", "Headlines from 12 outlets in one feed, filtered by PC, PlayStation, Xbox, Nintendo and mobile.", "/articles"],
  ["Movie ratings", "Critic scores from our team next to real community ratings.", "/movies"],
  ["Community", "Write reviews, comment, follow your games and build a profile.", "/reviews"],
];

export default function LandingPage({ apiOrigin, apiBase, NewsletterForm, decodeEntities = (s) => s }) {
  const [news, setNews] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${apiBase}?limit=3&offset=0`);
        if (!r.ok) return;
        const j = await r.json();
        if (alive) setNews((j.articles || []).slice(0, 3));
      } catch { /* section simply stays empty */ }
    })();
    return () => { alive = false; };
  }, [apiBase]);

  return (
    <div className="lp">
      <style>{CSS}</style>

      <LandingHero apiOrigin={apiOrigin} />

      <section className="lp-sec lp-block">
        <div className="lp-split">
          <div>
            <div className="lp-label">LIVE ANALYTICS</div>
            <h2>The numbers, not the press releases</h2>
            <p className="lp-lead">
              Every night we save the top 200 games with their Twitch viewers and Steam players,
              so you can see what is trending today and how it got there.
            </p>
            <Link className="btn-ghost" to="/charts">Explore the full Hot 50 →</Link>
          </div>
          <AnalyticsPanel apiOrigin={apiOrigin} />
        </div>
      </section>

      <section className="lp-sec lp-block">
        <div className="lp-label">WHAT YOU GET</div>
        <h2>Everything gaming, one place</h2>
        <p className="lp-lead">Live charts, daily history, news and a community, built on real data.</p>
        <div className="lp-feats">
          {FEATURES.map(([t, d, to]) => (
            <Link key={t} to={to} className="lp-feat"><h3>{t}</h3><p>{d}</p></Link>
          ))}
        </div>
      </section>

      {news.length > 0 && (
        <section className="lp-sec lp-block">
          <div className="lp-label">LATEST</div>
          <h2>Fresh from the newsroom</h2>
          <div className="lp-news" style={{ marginTop: 22 }}>
            {news.map(a => (
              <a key={a.link} className="lp-art"
                 href={`/article-detail?url=${encodeURIComponent(a.link)}&title=${encodeURIComponent(a.title)}`}>
                {a.image && <img src={a.image} alt="" loading="lazy" />}
                <div><small>{a.source}</small><p>{decodeEntities(a.title)}</p></div>
              </a>
            ))}
          </div>
          <Link className="lp-more" to="/articles">All gaming news →</Link>
        </section>
      )}

      <section className="lp-sec lp-block">
        <div className="lp-data">
          <div>
            <div className="lp-label">GMN DATA</div>
            <h2>Need the numbers behind the charts?</h2>
            <p className="lp-lead" style={{ marginBottom: 22 }}>
              Studios, publishers and agencies can get our daily history of the top 200 games:
              Twitch viewers, Steam players and ratings. Tell us what you need and we will get back to you.
            </p>
            <Link className="btn-primary" to="/data">Request GMN data →</Link>
          </div>
          <ul>
            <li>Daily snapshots of 200 games</li>
            <li>Twitch viewers and Steam players</li>
            <li>Rank history and biggest movers</li>
            <li>Reports and CSV exports on request</li>
          </ul>
        </div>
      </section>

      {NewsletterForm && (
        <section className="lp-sec lp-block">
          <div className="lp-sub">
            <div className="lp-label">NEWSLETTER</div>
            <h2>The weekly GMN digest</h2>
            <p className="lp-lead">One short email a week: the biggest movers on the Hot 50 and the stories that mattered.</p>
            <div className="lp-sub-form"><NewsletterForm source="landing" /></div>
          </div>
        </section>
      )}

      <section className="lp-sec lp-block lp-cta">
        <h2>See what the world is playing</h2>
        <p className="lp-lead">The Billboard is always live, and always free.</p>
        <Link className="btn-primary" to="/billboard">Enter the Billboard →</Link>
      </section>
    </div>
  );
}
