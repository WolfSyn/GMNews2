// src/DataPage.jsx — "GMN Data" page: what we sell, a live sample, and a request form.
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { AnalyticsPanel } from "./LandingHero";

const CSS = `
.dp { max-width: 1100px; margin: 0 auto; padding: 64px 20px 72px; }
.dp-label { font-size: 12px; font-weight: 700; letter-spacing: 1.6px; color: var(--red, #ff3b3b); margin-bottom: 14px; }
.dp h1 { font-family: "Space Grotesk", var(--font-display), system-ui, sans-serif; font-size: clamp(36px, 5.4vw, 60px); font-weight: 400; letter-spacing: -1px; line-height: 1.05; margin: 0 0 18px; text-transform: none; max-width: 760px; }
.dp h2 { font-family: "Space Grotesk", var(--font-display), system-ui, sans-serif; font-size: clamp(24px, 3.4vw, 34px); font-weight: 500; letter-spacing: -.4px; margin: 0 0 12px; text-transform: none; }
.dp-lead { color: var(--muted2, #a1a1aa); font-size: 17px; line-height: 1.65; max-width: 640px; margin: 0 0 26px; }
.dp-actions { display: flex; gap: 10px; flex-wrap: wrap; }
.dp-sec { margin-top: 76px; }
.dp-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-top: 22px; }
.dp-card { border: 1px solid var(--border, #23232b); border-radius: 14px; padding: 20px; background: var(--surface, #12121a); }
.dp-card h3 { font-size: 17px; margin: 0 0 8px; }
.dp-card p { color: var(--muted2, #a1a1aa); font-size: 14px; line-height: 1.6; margin: 0; }
.dp-split { display: grid; grid-template-columns: 1fr 1fr; gap: 44px; align-items: center; }
.dp-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 22px; counter-reset: s; }
.dp-step { border: 1px solid var(--border, #23232b); border-radius: 14px; padding: 20px; background: var(--surface, #12121a); }
.dp-step::before { counter-increment: s; content: counter(s); display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: var(--red, #ff3b3b); color: #fff; font-weight: 800; font-size: 13px; margin-bottom: 12px; }
.dp-step h3 { font-size: 17px; margin: 0 0 6px; }
.dp-step p { color: var(--muted2, #a1a1aa); font-size: 14px; line-height: 1.6; margin: 0; }
.dp-form { border: 1px solid var(--border, #23232b); border-radius: 18px; padding: 32px; background: var(--surface, #12121a); max-width: 760px; }
.dp-form form { display: grid; gap: 12px; margin-top: 18px; }
.dp-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.dp-form input, .dp-form select, .dp-form textarea { width: 100%; padding: 12px 14px; border-radius: 10px; border: 1px solid #2c2c36; background: #0a0a0f; color: #fff; font: inherit; font-size: 15px; }
.dp-form textarea { resize: vertical; }
.dp-thanks { border: 1px solid #86efac; border-radius: 10px; padding: 12px 14px; margin: 14px 0 0; font-size: 14px; color: #dcfce7; background: rgba(34,197,94,.1); }
.dp-note { color: var(--muted, #71717a); font-size: 13px; margin-top: 14px; }
.dp-note a { color: var(--muted2, #a1a1aa); }
@media (max-width: 860px) {
  .dp { padding-top: 40px; }
  .dp-grid, .dp-steps, .dp-split, .dp-row { grid-template-columns: 1fr; }
  .dp-split { gap: 26px; }
  .dp-form { padding: 22px 18px; }
}
`;

export default function DataPage({ apiOrigin }) {
  const loc = useLocation();
  const sent = new URLSearchParams(loc.search).get("sent") === "1";
  const redirectUrl = typeof window !== "undefined"
    ? `${window.location.origin}/data?sent=1#request`
    : "/data?sent=1#request";
  return (
    <div className="dp">
      <style>{CSS}</style>

      <div className="dp-label">GMN DATA</div>
      <h1>The numbers behind the Hot 50.</h1>
      <p className="dp-lead">
        Every night we save the top 200 games with their Twitch viewers, Steam players and ratings.
        Studios, publishers and agencies can get that history for their own reports.
      </p>
      <div className="dp-actions">
        <a className="btn-primary" href="#request">Request GMN data →</a>
        <Link className="btn-ghost" to="/billboard">See the live Billboard</Link>
      </div>

      <section className="dp-sec">
        <h2>What you can get</h2>
        <div className="dp-grid">
          {[
            ["Daily snapshots", "The top 200 games, every night: rank, Twitch viewers, Steam players and IGDB rating."],
            ["Rank history", "How any game has climbed or fallen over time, with day-by-day numbers."],
            ["Movers and trends", "Which games are breaking out, which are fading, and total viewership across the top 200."],
            ["Custom reports", "A CSV export or a short written report built around the games you care about."],
          ].map(([t, d]) => (
            <div className="dp-card" key={t}><h3>{t}</h3><p>{d}</p></div>
          ))}
        </div>
      </section>

      <section className="dp-sec">
        <div className="dp-split">
          <div>
            <h2>See the data for yourself</h2>
            <p className="dp-lead" style={{ marginBottom: 0 }}>
              This is a live sample from the same daily snapshots you would receive. Switch between
              the most-watched games, total viewers and the biggest mover.
            </p>
          </div>
          <AnalyticsPanel apiOrigin={apiOrigin} />
        </div>
      </section>

      <section className="dp-sec">
        <h2>How it works</h2>
        <div className="dp-steps">
          {[
            ["Tell us what you need", "Which games, what time range, and how you want to receive it."],
            ["We send a sample", "You see a slice of the real data first, so you know it fits."],
            ["Get it on your schedule", "A one-time export, or a regular delivery of updated numbers."],
          ].map(([t, d]) => (
            <div className="dp-step" key={t}><h3>{t}</h3><p>{d}</p></div>
          ))}
        </div>
      </section>

      <section className="dp-sec" id="request">
        <div className="dp-form">
          <div className="dp-label">REQUEST DATA</div>
          <h2>Tell us what you need</h2>
          {sent && (
            <div className="dp-thanks"><strong>Thanks, we got your request.</strong> We will reply with next steps soon.</div>
          )}
          <p className="dp-lead" style={{ marginBottom: 0 }}>Pricing depends on what you ask for. We reply with next steps.</p>
          <form action="https://formspree.io/f/mqaybeaw" method="POST">
            <input type="hidden" name="_subject" value="[GMN Data] New data request" />
            <input type="hidden" name="_redirect" value={redirectUrl} />
            <input type="text" name="_gotcha" tabIndex="-1" autoComplete="off" style={{ display: "none" }} />
            <div className="dp-row">
              <input name="name" placeholder="Your name" required />
              <input name="email" type="email" placeholder="Work email" required />
            </div>
            <div className="dp-row">
              <input name="company" placeholder="Company" />
              <select name="interest" defaultValue="" required>
                <option value="" disabled>What are you interested in?</option>
                <option>Daily data export (CSV)</option>
                <option>Custom report</option>
                <option>One-time research</option>
                <option>Something else</option>
              </select>
            </div>
            <textarea name="message" rows="5" placeholder="Which games or time range do you care about?" required />
            <button className="btn-primary" type="submit" style={{ justifySelf: "start", border: 0, cursor: "pointer" }}>Send request</button>
          </form>
          <p className="dp-note">
            Prefer email? <a href="mailto:contact@gmnnews.org">contact@gmnnews.org</a>
          </p>
        </div>
      </section>
    </div>
  );
}