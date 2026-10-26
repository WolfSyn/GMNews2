// src/LandingHero.jsx — hero, game-card carousel and analytics panel for the
// marketing landing page ("/"). Self-contained styles, no extra libraries.
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const CSS = `
.lh { max-width: 1100px; margin: 0 auto; padding: 84px 20px 0; overflow-x: clip; }
.lh-eyebrow { font-size: 12px; font-weight: 700; letter-spacing: 1.6px; color: var(--red, #ff3b3b); margin-bottom: 18px; }
.lh h1 { font-family: "Space Grotesk", var(--font-display), system-ui, sans-serif; font-size: clamp(40px, 6.4vw, 70px); line-height: 1.04; font-weight: 400; letter-spacing: -1px; margin: 0 0 26px; max-width: 760px; color: #f4f6ff; text-transform: none; }
.lh-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 34px; }
.lh-lines { display: grid; gap: 12px; font-size: clamp(16px, 2vw, 21px); line-height: 1.35; color: #c9cfe6; max-width: 760px; }
.lh-lines b { color: #fff; font-weight: 700; }

/* carousel */
.lh-stage { position: relative; height: 430px; margin: 54px auto 0; max-width: 900px; --step: 240px; }
.lh-card { position: absolute; left: 50%; top: 0; width: 270px; border-radius: 16px; overflow: hidden; background: #1a1f31; border: 1px solid rgba(255,255,255,.08);
  box-shadow: 0 24px 60px rgba(0,0,0,.55); transition: transform .55s cubic-bezier(.2,.8,.2,1), opacity .4s; will-change: transform; }
.lh-card[data-d="0"]  { transform: translateX(-50%) scale(1); z-index: 3; opacity: 1; }
.lh-card[data-d="-1"] { transform: translateX(calc(-50% - var(--step))) translateY(26px) rotate(-7deg) scale(.92); z-index: 2; opacity: .75; }
.lh-card[data-d="1"]  { transform: translateX(calc(-50% + var(--step))) translateY(26px) rotate(7deg) scale(.92); z-index: 2; opacity: .75; }
.lh-card[data-d="x"]  { transform: translateX(-50%) scale(.8); z-index: 1; opacity: 0; pointer-events: none; }
.lh-art { height: 168px; background: linear-gradient(160deg, #2a3358, #151a2c); position: relative; }
.lh-art img { width: 100%; height: 100%; object-fit: cover; object-position: center 20%; display: block; }
.lh-rank { position: absolute; top: 10px; left: 10px; background: rgba(8,10,20,.82); border: 1px solid rgba(255,255,255,.14); color: #fff; font-weight: 700; font-size: 12px; padding: 4px 9px; border-radius: 999px; }
.lh-cbody { padding: 14px 16px 16px; }
.lh-cname { font-weight: 700; font-size: 16px; line-height: 1.25; margin-bottom: 4px; color: #fff; }
.lh-live { font-size: 12px; color: #9aa3c4; display: flex; align-items: center; gap: 6px; margin-bottom: 12px; }
.lh-live i { width: 7px; height: 7px; border-radius: 50%; background: #22c55e; display: inline-block; }
.lh-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.lh-stats small { display: block; font-size: 11px; color: #8b94b6; margin-bottom: 2px; }
.lh-stats b { font-size: 20px; font-weight: 700; color: #fff; }
.lh-dots { display: flex; gap: 12px; justify-content: center; margin-top: 18px; }
.lh-dot { all: unset; width: 9px; height: 9px; border-radius: 50%; background: rgba(255,255,255,.22); cursor: pointer; }
.lh-dot[aria-current="true"] { background: #fff; width: 22px; border-radius: 99px; }
.lh-dot:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }

/* sources strip */
.lh-sources { margin-top: 46px; border-top: 1px solid rgba(255,255,255,.08); border-bottom: 1px solid rgba(255,255,255,.08); }
.lh-sources-in { max-width: 1100px; margin: 0 auto; padding: 22px 20px; display: flex; gap: 20px 44px; justify-content: space-between; align-items: center; flex-wrap: wrap; }
.lh-sources span { font-weight: 800; letter-spacing: 2px; font-size: 15px; color: #8b94b6; }
.lh-sources em { font-style: normal; font-size: 11px; font-weight: 700; letter-spacing: 1.4px; color: #5d6689; }

/* analytics panel */
.lh-panel { border: 1px solid rgba(255,255,255,.1); border-radius: 16px; padding: 18px 20px 14px; background: rgba(12,16,32,.7); min-width: 0; }
.lh-tabs { display: flex; gap: 6px; margin-bottom: 14px; }
.lh-tab { all: unset; cursor: pointer; padding: 6px 12px; border-radius: 999px; font-size: 11px; font-weight: 800; letter-spacing: 1px; color: #a8b0d0; border: 1px solid rgba(255,255,255,.12); }
.lh-tab[aria-selected="true"] { background: var(--red, #ff3b3b); border-color: var(--red, #ff3b3b); color: #fff; }
.lh-tab:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.lh-title { font-family: "Space Grotesk", system-ui, sans-serif; font-size: 20px; font-weight: 600; line-height: 1.15; color: #fff; }
.lh-caption { color: #8b94b6; font-size: 12px; margin: 2px 0 10px; }
.lh-empty { color: #a8b0d0; font-size: 13px; line-height: 1.6; padding: 26px 4px; }
.lh-svg { width: 100%; height: auto; display: block; overflow: visible; }
.lh-svg text { fill: #8b94b6; font-size: 10px; font-family: inherit; }
.lh-bars { display: grid; gap: 9px; }
.lh-bar-row { display: grid; grid-template-columns: 18px 1fr; gap: 8px; align-items: center; }
.lh-brank { font-weight: 800; font-size: 14px; color: #a8b0d0; text-align: right; }
.lh-bar-top { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; margin-bottom: 4px; color: #fff; }
.lh-bar-top span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.lh-bar-top b { color: #a8b0d0; font-weight: 700; white-space: nowrap; }
.lh-bar-track { height: 7px; border-radius: 99px; background: rgba(255,255,255,.08); overflow: hidden; }
.lh-bar-fill { height: 100%; border-radius: 99px; background: linear-gradient(90deg, #b91c1c, var(--red, #ff3b3b)); }
.lh-pstats { display: flex; gap: 20px; margin-top: 10px; flex-wrap: wrap; }
.lh-pstat b { display: block; font-size: 20px; font-weight: 700; color: #fff; }
.lh-pstat span { font-size: 11px; color: #8b94b6; letter-spacing: .3px; }
.lh-foot { margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,.08); font-size: 11px; color: #6c7599; }

@media (max-width: 760px) {
  .lh { padding-top: 48px; }
  .lh-stage { height: 400px; --step: 150px; }
  .lh-card { width: 224px; }
  .lh-art { height: 140px; }
}
`;

function fmt(n) {
  if (!n) return "0";
  if (n >= 1e6) return `${(n / 1e6).toFixed(2).replace(/0$/, "")}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}K`;
  return String(n);
}
function niceDate(d) {
  try { return new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
  catch { return d; }
}
function fixUrl(u) { return u && u.startsWith("//") ? `https:${u}` : u; }

// One shared request for everything on the page that needs analytics.
const inflight = new Map();
export function useAnalytics(apiOrigin) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    const url = `${apiOrigin}/api/charts/analytics`;
    if (!inflight.has(url)) {
      inflight.set(url, fetch(url).then(r => (r.ok ? r.json() : null)).catch(() => null)
        .finally(() => setTimeout(() => inflight.delete(url), 5000)));
    }
    inflight.get(url).then(d => { if (alive && d) setData(d); });
    return () => { alive = false; };
  }, [apiOrigin]);
  return data;
}

function LineChart({ points, invert = false, yFormat = (v) => String(v), label }) {
  const W = 320, H = 150, L = 38, R = 10, T = 12, B = 24;
  const vals = points.map(p => p.value);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.12;
  min -= pad; max += pad;
  const x = (i) => L + (points.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (points.length - 1));
  const y = (v) => { const t = (v - min) / (max - min); return T + (invert ? t : 1 - t) * (H - T - B); };
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${path} L${x(points.length - 1).toFixed(1)},${H - B} L${x(0).toFixed(1)},${H - B} Z`;
  const ticks = [max - pad, (max + min) / 2, min + pad];
  const showEvery = points.length > 7 ? Math.ceil(points.length / 5) : 1;
  return (
    <svg className="lh-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <defs>
        <linearGradient id="lhArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff3b3b" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ff3b3b" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,.08)" />
          <text x={L - 6} y={y(t) + 3} textAnchor="end">{yFormat(t)}</text>
        </g>
      ))}
      <path d={area} fill="url(#lhArea)" />
      <path d={path} fill="none" stroke="#ff3b3b" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 4 : 2.6} fill="#ff3b3b" stroke="#0c1020" strokeWidth="1.5" />
          {(i % showEvery === 0 || i === points.length - 1) && (
            <text x={x(i)} y={H - 6} textAnchor="middle">{niceDate(p.date)}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

export function AnalyticsPanel({ apiOrigin }) {
  const data = useAnalytics(apiOrigin);
  const [tab, setTab] = useState("top");
  const top5   = (data?.top || []).slice(0, 5);
  const totals = data?.totals || [];
  const mover  = data?.mover;
  if (!top5.length && !totals.length) return null;

  const maxTop = Math.max(1, ...top5.map(g => g.viewers));
  const last = totals[totals.length - 1], first = totals[0];
  const change = last && first && first.viewers && totals.length > 1
    ? Math.round(((last.viewers - first.viewers) / first.viewers) * 100) : null;

  return (
    <div className="lh-panel">
      <style>{CSS}</style>
      <div className="lh-tabs" role="tablist" aria-label="Analytics">
        {[["top", "TOP 5"], ["trend", "VIEWERS"], ["mover", "MOVER"]].map(([k, l]) => (
          <button key={k} className="lh-tab" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === "top" && (
        <div role="tabpanel">
          <div className="lh-title">Most watched right now</div>
          <div className="lh-caption">Twitch viewers · {niceDate(data.date)}</div>
          <div className="lh-bars">
            {top5.map(g => (
              <div className="lh-bar-row" key={g.name}>
                <div className="lh-brank">{g.rank}</div>
                <div>
                  <div className="lh-bar-top"><span>{g.name}</span><b>{fmt(g.viewers)}</b></div>
                  <div className="lh-bar-track"><div className="lh-bar-fill" style={{ width: `${Math.max(4, (g.viewers / maxTop) * 100)}%` }} /></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "trend" && (
        <div role="tabpanel">
          <div className="lh-title">Total viewers, top 200 games</div>
          <div className="lh-caption">Daily snapshot · last {totals.length} days</div>
          {totals.length > 1 ? (
            <>
              <LineChart points={totals.map(t => ({ date: t.date, value: t.viewers }))} yFormat={fmt}
                         label="Total Twitch viewers across the top 200 games per day" />
              <div className="lh-pstats">
                <div className="lh-pstat"><b>{fmt(last.viewers)}</b><span>LATEST</span></div>
                {change !== null && (
                  <div className="lh-pstat"><b>{change > 0 ? "+" : ""}{change}%</b><span>SINCE {niceDate(first.date).toUpperCase()}</span></div>
                )}
              </div>
            </>
          ) : <div className="lh-empty">The trend line fills in as more daily snapshots arrive.</div>}
        </div>
      )}

      {tab === "mover" && (
        <div role="tabpanel">
          {mover ? (
            <>
              <div className="lh-title">{mover.name}</div>
              <div className="lh-caption">Biggest climber in the Hot 50 · rank, last {mover.history?.length || 0} days</div>
              {mover.history?.length > 1 ? (
                <LineChart points={mover.history.map(h => ({ date: h.date, value: h.rank }))} invert
                           yFormat={(v) => `#${Math.round(v)}`} label={`${mover.name} rank over time`} />
              ) : <div className="lh-empty">Rank history builds as more daily snapshots arrive.</div>}
              <div className="lh-pstats">
                <div className="lh-pstat"><b>#{mover.prevRank} → #{mover.rank}</b><span>RANK</span></div>
                <div className="lh-pstat"><b>+{mover.gain}</b><span>SPOTS</span></div>
                <div className="lh-pstat"><b>{fmt(mover.viewers)}</b><span>VIEWERS</span></div>
              </div>
            </>
          ) : <div className="lh-empty">No climbers in the top 50 since the last snapshot.</div>}
        </div>
      )}
      <div className="lh-foot">Updated daily from GMN Hot 50 snapshots</div>
    </div>
  );
}

function GameCarousel({ games, date }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = games.length;

  useEffect(() => {
    if (paused || n < 2) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setActive(a => (a + 1) % n), 4500);
    return () => clearInterval(t);
  }, [paused, n]);

  if (!n) return null;
  const offset = (i) => {
    let d = i - active;
    if (d > n / 2) d -= n;
    if (d < -n / 2) d += n;
    return Math.abs(d) > 1 ? "x" : String(d);
  };

  return (
    <>
      <div className="lh-stage" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        {games.map((g, i) => (
          <div key={g.name} className="lh-card" data-d={offset(i)} aria-hidden={offset(i) !== "0"}>
            <div className="lh-art">
              {g.coverUrl && <img src={fixUrl(g.coverUrl)} alt="" loading="lazy" />}
              <span className="lh-rank">#{g.rank} on the Billboard</span>
            </div>
            <div className="lh-cbody">
              <div className="lh-cname">{g.name}</div>
              <div className="lh-live"><i /> Live on Twitch · {niceDate(date)}</div>
              <div className="lh-stats">
                <div><small>Twitch viewers</small><b>{fmt(g.viewers)}</b></div>
                {g.steamPlayers >= 100
                  ? <div><small>Steam players</small><b>{fmt(g.steamPlayers)}</b></div>
                  : g.igdbRating
                    ? <div><small>IGDB rating</small><b>{g.igdbRating}/100</b></div>
                    : <div><small>Billboard rank</small><b>#{g.rank}</b></div>}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="lh-dots" role="group" aria-label="Choose a game">
        {games.map((g, i) => (
          <button key={g.name} className="lh-dot" aria-label={g.name} aria-current={i === active} onClick={() => setActive(i)} />
        ))}
      </div>
    </>
  );
}

export default function LandingHero({ apiOrigin }) {
  const data = useAnalytics(apiOrigin);
  return (
    <>
      <style>{CSS}</style>
      <section className="lh" aria-label="Welcome to GMN News">
        <div className="lh-eyebrow">THE BILLBOARD OF GAMING</div>
        <h1>See what the world is playing.</h1>
        <div className="lh-actions">
          <Link className="btn-primary" to="/billboard">Enter the Billboard →</Link>
          <Link className="btn-ghost" to="/about">About GMN News</Link>
        </div>
        <div className="lh-lines">
          <div><b>Twitch:</b> live viewers for the top 200 games</div>
          <div><b>Steam:</b> concurrent players and ratings</div>
          <div><b>Hot 50:</b> ranked every day, with full history</div>
          <div><b>And much more:</b> GMN Scores, movie ratings, news &amp; community</div>
        </div>
        {data?.top?.length > 0 && <GameCarousel games={data.top} date={data.date} />}
      </section>

      <div className="lh-sources">
        <div className="lh-sources-in">
          <em>DATA FROM</em>
          <span>TWITCH</span><span>STEAM</span><span>IGDB</span><span>TMDB</span><span>12 NEWS OUTLETS</span>
        </div>
      </div>
    </>
  );
}
