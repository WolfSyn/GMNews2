// src/Auth.jsx  —  GMN News Auth System
import React, { createContext, useContext, useEffect, useState } from "react";
import { useNavigate, useLocation, Link, useParams } from "react-router-dom";
import { supabase } from "./supabase";

/* ─────────────────────────────────────────
   AUTH CONTEXT  — wraps the whole app
───────────────────────────────────────── */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session (handles page refresh + OAuth redirect)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    // Listen for ALL auth state changes including OAuth callbacks
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("GMN Auth event:", event, session?.user?.email);
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          setUser(session?.user ?? null);
          if (session?.user) fetchProfile(session.user.id);
          else setLoading(false);
        }
        if (event === "SIGNED_OUT") {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId) {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      setProfile(data);
    } catch {}
    finally { setLoading(false); }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

/* ─────────────────────────────────────────
   FAVORITES HOOK
───────────────────────────────────────── */
export function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    if (!user) { setFavorites([]); return; }
    supabase
      .from("favorites")
      .select("*")
      .eq("user_id", user.id)
      .then(({ data }) => setFavorites(data || []));
  }, [user]);

  async function toggleFavorite(game) {
    if (!user) return;
    const already = favorites.some(f => f.game_name === game.name);
    if (already) {
      await supabase.from("favorites").delete()
        .eq("user_id", user.id).eq("game_name", game.name);
      setFavorites(f => f.filter(x => x.game_name !== game.name));
    } else {
      const newFav = { user_id: user.id, game_name: game.name, cover_url: game.coverUrl || null };
      const { data } = await supabase.from("favorites").insert(newFav).select().single();
      if (data) setFavorites(f => [...f, data]);
    }
  }

  function isFavorite(gameName) {
    return favorites.some(f => f.game_name === gameName);
  }

  return { favorites, toggleFavorite, isFavorite };
}



/* ─────────────────────────────────────────
   FOLLOWED GAMES HOOK
───────────────────────────────────────── */
export function useFollowedGames() {
  const { user } = useAuth();
  const [followedGames, setFollowedGames] = useState([]);

  useEffect(() => {
    if (!user) { setFollowedGames([]); return; }
    supabase.from("followed_games").select("*").eq("user_id", user.id)
      .then(({ data }) => setFollowedGames(data || []));
  }, [user]);

  async function toggleFollowGame(game) {
    if (!user) return;
    const already = followedGames.some(f => f.game_name === game.name);
    if (already) {
      await supabase.from("followed_games").delete().eq("user_id", user.id).eq("game_name", game.name);
      setFollowedGames(f => f.filter(x => x.game_name !== game.name));
    } else {
      const newFollow = { user_id: user.id, game_name: game.name, cover_url: game.coverUrl || null };
      const { data } = await supabase.from("followed_games").insert(newFollow).select().single();
      if (data) setFollowedGames(f => [...f, data]);
    }
  }

  function isFollowing(gameName) {
    return followedGames.some(f => f.game_name === gameName);
  }

  return { followedGames, toggleFollowGame, isFollowing };
}

/* ─────────────────────────────────────────
   NAV USER MENU  — shown in Header
───────────────────────────────────────── */
export function NavUserMenu() {
  const { user, profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  if (!user) {
    return (
      <div style={{ display: "flex", gap: 8 }}>
        <Link to="/login" style={{
          padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700,
          color: "var(--muted2)", border: "1px solid var(--ring-md)",
          background: "transparent", textDecoration: "none", transition: ".15s",
        }}>Log in</Link>
        <Link to="/signup" style={{
          padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700,
          color: "#000", background: "#fff", textDecoration: "none", transition: ".15s",
        }}>Sign up</Link>
      </div>
    );
  }

  const initials  = (profile?.username || user.email || "U").slice(0, 2).toUpperCase();
  const avatarUrl = profile?.avatar_url || null;

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: 34, height: 34, borderRadius: "50%",
          background: avatarUrl ? "transparent" : "var(--red)",
          border: avatarUrl ? "2px solid var(--ring-md)" : "none",
          color: "#fff", fontWeight: 800, fontSize: 13,
          cursor: "pointer", flexShrink: 0,
          overflow: "hidden", padding: 0,
        }}
      >
        {avatarUrl
          ? <img src={avatarUrl} alt={initials} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : initials
        }
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 100 }} />
          <div style={{
            position: "absolute", right: 0, top: 42, zIndex: 101,
            background: "var(--panel)", border: "1px solid var(--ring-md)",
            borderRadius: 12, minWidth: 180, boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            overflow: "hidden",
          }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--ring)" }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {profile?.username || "Gamer"}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                {user.email}
              </div>
            </div>
            {[
              { label: "My Profile", path: `/user/${profile?.username || user.id}` },
              { label: "Submit Review", path: "/reviews/submit" },
              { label: "Settings", path: "/settings" },
            ].map(item => (
              <button key={item.label} onClick={() => { setOpen(false); navigate(item.path); }}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "10px 16px", background: "transparent",
                  border: "none", color: "var(--text)", fontSize: 13,
                  fontWeight: 600, cursor: "pointer", transition: "background .12s",
                }}
                onMouseEnter={e => e.target.style.background = "rgba(255,255,255,0.05)"}
                onMouseLeave={e => e.target.style.background = "transparent"}
              >{item.label}</button>
            ))}
            <div style={{ borderTop: "1px solid var(--ring)", padding: 4 }}>
              <button onClick={() => { setOpen(false); signOut(); navigate("/"); }}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "10px 16px", background: "transparent",
                  border: "none", color: "var(--red)", fontSize: 13,
                  fontWeight: 700, cursor: "pointer",
                }}
              >Sign out</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   SHARED FORM STYLES
───────────────────────────────────────── */
const inputStyle = {
  width: "100%", padding: "12px 16px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 10, color: "#edf0f6",
  fontSize: 15, fontFamily: "inherit", outline: "none",
  transition: "border-color .15s",
};
const labelStyle = {
  display: "block", fontSize: 12, fontWeight: 700,
  color: "#7a8599", marginBottom: 6, letterSpacing: "0.4px",
};
const errorStyle = {
  background: "rgba(255,50,50,0.12)", border: "1px solid rgba(255,50,50,0.25)",
  borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#ff6b6b", marginBottom: 16,
};
const successStyle = {
  background: "rgba(34,211,94,0.12)", border: "1px solid rgba(34,211,94,0.25)",
  borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#22d35e", marginBottom: 16,
};

function AuthCard({ children, title, subtitle }) {
  return (
    <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <img src="/important_stuff.png" alt="GMN" style={{ height: 36 }} />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 900, letterSpacing: "0.5px", textTransform: "uppercase", color: "#edf0f6" }}>
              GMN News
            </span>
          </Link>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 900, textTransform: "uppercase", margin: "16px 0 6px", color: "#edf0f6" }}>
            {title}
          </h1>
          {subtitle && <p style={{ color: "#7a8599", fontSize: 14, margin: 0 }}>{subtitle}</p>}
        </div>

        <div style={{
          background: "#111318", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 16, padding: "28px 28px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   SIGN UP PAGE
───────────────────────────────────────── */
export function SignUpPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm]     = useState({ username: "", email: "", password: "", confirm: "" });
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => { if (user) navigate("/"); }, [user]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirm) return setError("Passwords don't match.");
    if (form.password.length < 6) return setError("Password must be at least 6 characters.");
    if (form.username.length < 3) return setError("Username must be at least 3 characters.");
    if (!/^[a-zA-Z0-9_]+$/.test(form.username)) return setError("Username can only contain letters, numbers, and underscores.");

    setLoading(true);
    try {
      // Check username availability
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", form.username)
        .single();

      if (existing) return setError("That username is already taken.");

      // Sign up
      const { error: signUpErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { username: form.username } },
      });

      if (signUpErr) throw signUpErr;
      setSuccess(true);
    } catch (e) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally { setLoading(false); }
  }

  if (success) return (
    <AuthCard title="Check your email" subtitle="We sent you a confirmation link">
      <div style={successStyle}>
        Almost there! Check your email at <strong>{form.email}</strong> and click the confirmation link to activate your account.
      </div>
      <Link to="/login" style={{ display: "block", textAlign: "center", color: "#ff3232", fontWeight: 700, fontSize: 14 }}>
        Back to login
      </Link>
    </AuthCard>
  );

  return (
    <AuthCard title="Join GMN News" subtitle="The Billboard of Gaming awaits">
      {error && <div style={errorStyle}>{error}</div>}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={labelStyle}>GAMING HANDLE *</label>
          <input
            style={inputStyle} required value={form.username}
            onChange={e => set("username", e.target.value)}
            placeholder="e.g. ProGamer99"
            onFocus={e => e.target.style.borderColor = "#4da6ff"}
            onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"}
          />
          <div style={{ fontSize: 11, color: "#7a8599", marginTop: 4 }}>Letters, numbers, underscores only</div>
        </div>

        <div>
          <label style={labelStyle}>EMAIL *</label>
          <input
            style={inputStyle} type="email" required value={form.email}
            onChange={e => set("email", e.target.value)}
            placeholder="you@example.com"
            onFocus={e => e.target.style.borderColor = "#4da6ff"}
            onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"}
          />
        </div>

        <div>
          <label style={labelStyle}>PASSWORD *</label>
          <input
            style={inputStyle} type="password" required value={form.password}
            onChange={e => set("password", e.target.value)}
            placeholder="At least 6 characters"
            onFocus={e => e.target.style.borderColor = "#4da6ff"}
            onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"}
          />
        </div>

        <div>
          <label style={labelStyle}>CONFIRM PASSWORD *</label>
          <input
            style={inputStyle} type="password" required value={form.confirm}
            onChange={e => set("confirm", e.target.value)}
            placeholder="Repeat your password"
            onFocus={e => e.target.style.borderColor = "#4da6ff"}
            onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"}
          />
        </div>

        <button type="submit" disabled={loading} style={{
          padding: "13px", borderRadius: 10, background: "#ff3232",
          border: "none", color: "#fff", fontWeight: 800, fontSize: 15,
          cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
          fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.5px",
          textTransform: "uppercase",
        }}>
          {loading ? "Creating account…" : "Create Account"}
        </button>
      </form>

      <div style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#7a8599" }}>
        Already have an account?{" "}
        <Link to="/login" style={{ color: "#ff3232", fontWeight: 700 }}>Log in</Link>
      </div>
    </AuthCard>
  );
}

/* ─────────────────────────────────────────
   LOGIN PAGE
───────────────────────────────────────── */
export function LoginPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user }  = useAuth();
  const [form, setForm]       = useState({ email: "", password: "" });
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  const from = location.state?.from || "/";
  useEffect(() => { if (user) navigate(from, { replace: true }); }, [user]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: form.email, password: form.password,
      });
      if (err) throw err;
      navigate(from, { replace: true });
    } catch (e) {
      setError(e.message === "Invalid login credentials"
        ? "Incorrect email or password."
        : e.message || "Login failed.");
    } finally { setLoading(false); }
  }

  async function handleDiscord() {
    await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: `${window.location.origin}/`,
        scopes: "identify email",
      },
    });
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
  }

  return (
    <AuthCard title="Welcome back" subtitle="Log in to your GMN account">
      {error && <div style={errorStyle}>{error}</div>}

      {/* OAuth buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        <button onClick={handleGoogle} style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          padding: "11px", borderRadius: 10, background: "rgba(255,255,255,0.07)",
          border: "1px solid rgba(255,255,255,0.12)", color: "#edf0f6",
          fontWeight: 700, fontSize: 14, cursor: "pointer", transition: ".15s",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continue with Google
        </button>

        <button onClick={handleDiscord} style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          padding: "11px", borderRadius: 10, background: "rgba(88,101,242,0.15)",
          border: "1px solid rgba(88,101,242,0.35)", color: "#edf0f6",
          fontWeight: 700, fontSize: 14, cursor: "pointer", transition: ".15s",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#5865F2"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.032.056A19.9 19.9 0 0 0 6.1 21.025a.077.077 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
          Continue with Discord
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
        <span style={{ fontSize: 12, color: "#7a8599", fontWeight: 600 }}>OR</span>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={labelStyle}>EMAIL</label>
          <input
            style={inputStyle} type="email" required value={form.email}
            onChange={e => set("email", e.target.value)}
            placeholder="you@example.com"
            onFocus={e => e.target.style.borderColor = "#4da6ff"}
            onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"}
          />
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>PASSWORD</label>
            <Link to="/forgot-password" style={{ fontSize: 12, color: "#ff3232", fontWeight: 600 }}>Forgot?</Link>
          </div>
          <input
            style={inputStyle} type="password" required value={form.password}
            onChange={e => set("password", e.target.value)}
            placeholder="Your password"
            onFocus={e => e.target.style.borderColor = "#4da6ff"}
            onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"}
          />
        </div>

        <button type="submit" disabled={loading} style={{
          padding: "13px", borderRadius: 10, background: "#ff3232",
          border: "none", color: "#fff", fontWeight: 800, fontSize: 15,
          cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
          fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.5px",
          textTransform: "uppercase",
        }}>
          {loading ? "Logging in…" : "Log In"}
        </button>
      </form>

      <div style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#7a8599" }}>
        New to GMN?{" "}
        <Link to="/signup" style={{ color: "#ff3232", fontWeight: 700 }}>Create an account</Link>
      </div>
    </AuthCard>
  );
}

/* ─────────────────────────────────────────
   FORGOT PASSWORD PAGE
───────────────────────────────────────── */
export function ForgotPasswordPage() {
  const [email, setEmail]     = useState("");
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (err) throw err;
      setSent(true);
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally { setLoading(false); }
  }

  if (sent) return (
    <AuthCard title="Check your email" subtitle="Password reset link sent">
      <div style={successStyle}>
        We sent a password reset link to <strong>{email}</strong>. Check your inbox!
      </div>
      <Link to="/login" style={{ display: "block", textAlign: "center", color: "#ff3232", fontWeight: 700, fontSize: 14 }}>
        Back to login
      </Link>
    </AuthCard>
  );

  return (
    <AuthCard title="Reset password" subtitle="We'll send you a reset link">
      {error && <div style={errorStyle}>{error}</div>}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={labelStyle}>EMAIL</label>
          <input
            style={inputStyle} type="email" required value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            onFocus={e => e.target.style.borderColor = "#4da6ff"}
            onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"}
          />
        </div>
        <button type="submit" disabled={loading} style={{
          padding: "13px", borderRadius: 10, background: "#ff3232",
          border: "none", color: "#fff", fontWeight: 800, fontSize: 15,
          cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
          fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.5px", textTransform: "uppercase",
        }}>
          {loading ? "Sending…" : "Send Reset Link"}
        </button>
      </form>
      <div style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#7a8599" }}>
        <Link to="/login" style={{ color: "#ff3232", fontWeight: 700 }}>Back to login</Link>
      </div>
    </AuthCard>
  );
}

/* ─────────────────────────────────────────
   USER PROFILE PAGE
───────────────────────────────────────── */
export function UserProfilePage() {
  const { username } = useParams();
  const { user, profile: myProfile, fetchProfile } = useAuth();
  const [profile,  setProfile]  = useState(null);
  const [reviews,  setReviews]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState(false);
  const [bio,      setBio]      = useState("");
  const [favPlat,  setFavPlat]  = useState("");
  const [saving,   setSaving]   = useState(false);
  const [saveMsg,  setSaveMsg]  = useState("");

  const isOwn = myProfile?.username === username;
  const [favs,              setFavs]              = useState([]);
  const [followedGames,     setFollowedGames]     = useState([]);
  const [avatarUrl,         setAvatarUrl]         = useState(null);
  const [uploadingAvatar,   setUploadingAvatar]   = useState(false);
  const [showGameSearch,    setShowGameSearch]    = useState(false);
  const [gameSearchQuery,   setGameSearchQuery]   = useState("");
  const [gameSearchResults, setGameSearchResults] = useState([]);
  const [gameSearchLoading, setGameSearchLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: prof } = await supabase
          .from("profiles").select("*").eq("username", username).single();
        setProfile(prof);
        setBio(prof?.bio || "");
        setFavPlat(prof?.favorite_platform || "");
        setAvatarUrl(prof?.avatar_url || null);

        if (prof) {
          const [{ data: revs }, { data: favData }, { data: followData }] = await Promise.all([
            supabase.from("reviews").select("*").eq("user_id", prof.id).order("created_at", { ascending: false }),
            supabase.from("favorites").select("*").eq("user_id", prof.id).order("created_at", { ascending: false }),
            supabase.from("followed_games").select("*").eq("user_id", prof.id).order("created_at", { ascending: false }),
          ]);
          setReviews(revs || []);
          setFavs(favData || []);
          setFollowedGames(followData || []);
        }
      } catch {} finally { setLoading(false); }
    })();
  }, [username]);

  async function searchGames(q) {
    if (!q.trim()) { setGameSearchResults([]); return; }
    setGameSearchLoading(true);
    try {
      // Build base URL from env — works both locally and in production
      let base = "http://localhost:3000";
      if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) {
        base = import.meta.env.VITE_API_BASE.replace("/api/articles", "").replace(/\/$/, "");
      }
      const url = `${base}/api/games/search?q=${encodeURIComponent(q)}`;
      const r = await fetch(url);
      if (r.ok) {
        const data = await r.json();
        setGameSearchResults(data);
      } else {
        setGameSearchResults([]);
      }
    } catch (e) {
      console.error("Game search error:", e);
      setGameSearchResults([]);
    } finally { setGameSearchLoading(false); }
  }

  async function followGame(game) {
    if (!user) return;
    const already = followedGames.some(f => f.game_name === game.name);
    if (already) return;
    const { data } = await supabase.from("followed_games")
      .insert({ user_id: user.id, game_name: game.name, cover_url: game.coverUrl || null })
      .select().single();
    if (data) setFollowedGames(f => [...f, data]);
    setShowGameSearch(false);
    setGameSearchQuery("");
    setGameSearchResults([]);
  }

  async function unfollowGame(gameName) {
    await supabase.from("followed_games").delete().eq("user_id", user.id).eq("game_name", gameName);
    setFollowedGames(f => f.filter(x => x.game_name !== gameName));
  }

  async function saveProfile() {
    setSaving(true);
    try {
      await supabase.from("profiles").update({ bio, favorite_platform: favPlat }).eq("id", user.id);
      setProfile(p => ({ ...p, bio, favorite_platform: favPlat }));
      if (fetchProfile) fetchProfile(user.id);
      setSaveMsg("Saved!"); setTimeout(() => setSaveMsg(""), 2000);
      setEditing(false);
    } catch {} finally { setSaving(false); }
  }

  async function deleteReview(id) {
    if (!window.confirm("Delete this review? This cannot be undone.")) return;
    // Remove from UI immediately so it feels instant
    setReviews(prev => prev.filter(x => x.id !== id));
    // Then delete from database
    const { error } = await supabase
      .from("reviews")
      .delete()
      .eq("id", id)
      .eq("user_id", profile?.id);
    if (error) {
      // If it failed, put it back
      console.error("Delete failed:", error.message);
      alert("Could not delete: " + error.message);
      const { data } = await supabase
        .from("reviews")
        .select("*")
        .eq("user_id", profile?.id)
        .order("created_at", { ascending: false });
      setReviews(data || []);
    }
  }

  async function uploadAvatar(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return alert("Image must be under 2MB.");
    const ext  = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    setUploadingAvatar(true);
    try {
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);
      // Add cache-busting so it refreshes immediately
      const urlWithBust = publicUrl + "?t=" + Date.now();
      await supabase.from("profiles").update({ avatar_url: urlWithBust }).eq("id", user.id);
      setAvatarUrl(urlWithBust);
      setProfile(p => ({ ...p, avatar_url: urlWithBust }));
      if (fetchProfile) fetchProfile(user.id);
    } catch (e) {
      alert("Upload failed: " + e.message);
    } finally { setUploadingAvatar(false); }
  }

  if (loading) return (
    <div style={{ maxWidth: 700, margin: "60px auto", padding: "0 20px" }}>
      <div className="skeleton-box" style={{ height: 120, borderRadius: 16 }} />
    </div>
  );

  if (!profile) return (
    <div style={{ maxWidth: 700, margin: "60px auto", padding: "0 20px", textAlign: "center" }}>
      <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 32, fontWeight: 900, textTransform: "uppercase" }}>User not found</h1>
      <Link to="/" style={{ color: "#ff3232", fontWeight: 700 }}>Back to Home</Link>
    </div>
  );

  const initials = profile.username.slice(0, 2).toUpperCase();
  const joinDate = new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "32px 20px 60px" }}>

      {/* Profile header */}
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", marginBottom: 28 }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          {/* Avatar circle */}
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: avatarUrl ? "transparent" : "var(--red)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 26, fontWeight: 900, color: "#fff",
            overflow: "hidden", border: "2px solid var(--ring-md)",
          }}>
            {avatarUrl
              ? <img src={avatarUrl} alt={profile.username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : initials
            }
          </div>
          {/* Upload button — only for own profile */}
          {isOwn && (
            <label style={{
              position: "absolute", bottom: 0, right: 0,
              width: 24, height: 24, borderRadius: "50%",
              background: "var(--red)", border: "2px solid var(--bg)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", fontSize: 12,
            }} title="Change avatar">
              {uploadingAvatar ? "…" : "✎"}
              <input type="file" accept="image/*" onChange={uploadAvatar}
                style={{ display: "none" }} />
            </label>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 32, fontWeight: 900, textTransform: "uppercase", margin: 0 }}>
              {profile.username}
            </h1>
            {isOwn && (
              <button onClick={() => setEditing(e => !e)} style={{
                padding: "4px 12px", borderRadius: 8, background: "transparent",
                border: "1px solid var(--ring-md)", color: "var(--muted2)",
                fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}>
                {editing ? "Cancel" : "Edit Profile"}
              </button>
            )}
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
            Joined {joinDate}
            {profile.favorite_platform && ` · ${profile.favorite_platform} gamer`}
          </div>
          {profile.bio && !editing && (
            <p style={{ fontSize: 14, color: "var(--muted2)", marginTop: 8, lineHeight: 1.5 }}>{profile.bio}</p>
          )}
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div style={{ background: "var(--panel)", border: "1px solid var(--ring)", borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>BIO</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
              placeholder="Tell the community about yourself..."
              style={{ ...inputStyle, resize: "vertical" }}
              onFocus={e => e.target.style.borderColor = "#4da6ff"}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>FAVORITE PLATFORM</label>
            <select value={favPlat} onChange={e => setFavPlat(e.target.value)}
              style={{ ...inputStyle, appearance: "none" }}>
              <option value="">Select platform</option>
              {["PC", "PlayStation", "Xbox", "Nintendo Switch", "Mobile"].map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={saveProfile} disabled={saving} style={{
              padding: "9px 20px", borderRadius: 8, background: "#ff3232",
              border: "none", color: "#fff", fontWeight: 700, cursor: "pointer",
            }}>
              {saving ? "Saving…" : "Save Changes"}
            </button>
            {saveMsg && <span style={{ color: "#22d35e", fontSize: 13, fontWeight: 700 }}>{saveMsg}</span>}
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 28 }}>
        {[
          { label: "Reviews",  value: reviews.length },
          { label: "Platform", value: profile.favorite_platform || "—" },
          { label: "Member",   value: joinDate },
        ].map(s => (
          <div key={s.label} style={{ background: "var(--panel)", border: "1px solid var(--ring)", borderRadius: 12, padding: "14px 16px", textAlign: "center" }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 900 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4, fontWeight: 600, letterSpacing: "0.4px", textTransform: "uppercase" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Reviews */}
      <div style={{ marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 900, textTransform: "uppercase", margin: 0 }}>
          Reviews
        </h2>
        {isOwn && (
          <Link to="/reviews/submit" style={{ fontSize: 13, fontWeight: 700, color: "#ff3232" }}>+ New Review</Link>
        )}
      </div>

      {reviews.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>
          {isOwn ? "You haven't written any reviews yet." : `${profile.username} hasn't written any reviews yet.`}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {reviews.map(r => (
            <div key={r.id} style={{ background: "var(--panel)", border: "1px solid var(--ring)", borderRadius: 12, padding: 18, position: "relative" }}>
              {isOwn && (
                <button onClick={() => deleteReview(r.id)}
                  style={{
                    position: "absolute", top: 14, right: 14,
                    background: "transparent", border: "1px solid var(--ring-md)",
                    borderRadius: 6, color: "var(--muted)", fontSize: 11,
                    fontWeight: 700, cursor: "pointer", padding: "3px 10px",
                    transition: ".15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--red)"; e.currentTarget.style.color = "var(--red)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--ring-md)"; e.currentTarget.style.color = "var(--muted)"; }}
                >Delete</button>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, paddingRight: isOwn ? 64 : 0 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{r.game_name}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 900, color: "#f5a623", lineHeight: 1 }}>{r.score}</span>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>/100</span>
                </div>
              </div>
              <p style={{ color: "var(--muted2)", fontSize: 14, lineHeight: 1.5, margin: "0 0 10px" }}>{r.body}</p>
              <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--muted)" }}>
                {r.gameplay && <span>Gameplay: <strong style={{ color: "var(--text)" }}>{r.gameplay}</strong></span>}
                {r.story    && <span>Story: <strong style={{ color: "var(--text)" }}>{r.story}</strong></span>}
                {r.value    && <span>Value: <strong style={{ color: "var(--text)" }}>{r.value}</strong></span>}
                <span style={{ marginLeft: "auto" }}>{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Favorite Games */}
      {favs.length > 0 && (
        <>
          <div style={{ margin: "28px 0 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 900, textTransform: "uppercase", margin: 0 }}>
              ♥ Favorite Games
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 12 }}>
            {favs.map(f => (
              <a key={f.id} href={`/game/${encodeURIComponent(f.game_name)}`}
                style={{ textDecoration: "none", color: "var(--text)" }}>
                <div style={{ background: "var(--panel)", border: "1px solid var(--ring)", borderRadius: 12, overflow: "hidden", transition: "border-color .15s" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "var(--ring-md)"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "var(--ring)"}
                >
                  {f.cover_url
                    ? <img src={f.cover_url} alt={f.game_name} style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", display: "block" }} />
                    : <div style={{ width: "100%", aspectRatio: "3/4", background: "var(--panel2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>🎮</div>
                  }
                  <div style={{ padding: "8px 10px", fontSize: 11, fontWeight: 700, lineHeight: 1.3 }}>
                    {f.game_name}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </>
      )}

      {/* Followed Games */}
      {(isOwn || followedGames.length > 0) && (
        <div style={{ marginTop: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 900, textTransform: "uppercase", margin: 0 }}>
              🔔 Followed Games
            </h2>
            {isOwn && (
              <button onClick={() => setShowGameSearch(s => !s)} style={{
                padding: "6px 14px", borderRadius: 8,
                background: showGameSearch ? "var(--panel2)" : "var(--red)",
                border: "none", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer",
              }}>
                {showGameSearch ? "Cancel" : "+ Follow a Game"}
              </button>
            )}
          </div>

          {isOwn && showGameSearch && (
            <div style={{ marginBottom: 16, background: "var(--panel)", border: "1px solid var(--ring)", borderRadius: 12, padding: 16 }}>
              <div style={{ position: "relative", marginBottom: 10 }}>
                <input
                  value={gameSearchQuery}
                  onChange={e => { setGameSearchQuery(e.target.value); searchGames(e.target.value); }}
                  placeholder="Search any game... e.g. Brawlhalla, Hollow Knight, Celeste"
                  autoFocus
                  style={{
                    width: "100%", padding: "10px 14px",
                    background: "var(--panel2)", border: "1px solid var(--ring-md)",
                    borderRadius: 8, color: "var(--text)", fontSize: 14,
                    fontFamily: "inherit", outline: "none",
                  }}
                  onFocus={e => e.target.style.borderColor = "var(--blue)"}
                  onBlur={e => e.target.style.borderColor = "var(--ring-md)"}
                />
                {gameSearchLoading && (
                  <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", fontSize: 12 }}>
                    Searching...
                  </div>
                )}
              </div>
              {gameSearchResults.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflowY: "auto" }}>
                  {gameSearchResults.map((g, i) => {
                    const alreadyFollowing = followedGames.some(f => f.game_name === g.name);
                    return (
                      <div key={i} onClick={() => !alreadyFollowing && followGame(g)} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "8px 10px", borderRadius: 8,
                        background: "var(--panel2)", border: "1px solid var(--ring)",
                        cursor: alreadyFollowing ? "default" : "pointer",
                        opacity: alreadyFollowing ? 0.5 : 1,
                      }}>
                        <div style={{ width: 36, height: 36, borderRadius: 6, overflow: "hidden", background: "var(--panel)", flexShrink: 0 }}>
                          {g.coverUrl
                            ? <img src={g.coverUrl} alt={g.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🎮</div>
                          }
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{g.name}</div>
                          {(g.platforms || g.year) && (
                            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                              {[g.year, g.platforms].filter(Boolean).join(" · ")}
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: alreadyFollowing ? "var(--green)" : "var(--red)" }}>
                          {alreadyFollowing ? "Following" : "+ Follow"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {gameSearchQuery.length > 1 && !gameSearchLoading && gameSearchResults.length === 0 && (
                <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>No games found for "{gameSearchQuery}"</p>
              )}
            </div>
          )}

          {followedGames.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 14 }}>
              {isOwn
                ? "You are not following any games yet. Click + Follow a Game to get started!"
                : `${profile.username} is not following any games yet.`}
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 12 }}>
              {followedGames.map(f => (
                <div key={f.id} style={{ position: "relative" }}>
                  <a href={`/game/${encodeURIComponent(f.game_name)}`}
                    style={{ textDecoration: "none", color: "var(--text)", display: "block" }}>
                    <div style={{ background: "var(--panel)", border: "1px solid var(--ring)", borderRadius: 12, overflow: "hidden", transition: "border-color .15s" }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = "var(--ring-md)"}
                      onMouseLeave={e => e.currentTarget.style.borderColor = "var(--ring)"}
                    >
                      {f.cover_url
                        ? <img src={f.cover_url} alt={f.game_name} style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", display: "block" }} />
                        : <div style={{ width: "100%", aspectRatio: "3/4", background: "var(--panel2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>🎮</div>
                      }
                      <div style={{ padding: "8px 10px" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.3 }}>{f.game_name}</div>
                        <div style={{ fontSize: 10, color: "var(--red)", fontWeight: 700, marginTop: 2 }}>🔔 Following</div>
                      </div>
                    </div>
                  </a>
                  {isOwn && (
                    <button onClick={() => unfollowGame(f.game_name)} title="Unfollow" style={{
                      position: "absolute", top: 6, right: 6,
                      width: 22, height: 22, borderRadius: "50%",
                      background: "rgba(0,0,0,0.7)", border: "none",
                      color: "#fff", fontSize: 10, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 900, lineHeight: 1,
                    }}>x</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   SETTINGS PAGE
───────────────────────────────────────── */
export function SettingsPage() {
  const { user, profile, signOut, fetchProfile } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername]   = useState(profile?.username || "");
  const [saving,   setSaving]     = useState(false);
  const [msg,      setMsg]        = useState("");
  const [error,    setError]      = useState("");

  useEffect(() => { if (!user) navigate("/login"); }, [user]);
  useEffect(() => { if (profile) setUsername(profile.username); }, [profile]);

  async function saveUsername() {
    if (username === profile?.username) return;
    if (username.length < 3) return setError("Username must be at least 3 characters.");
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return setError("Letters, numbers, underscores only.");

    setSaving(true); setError(""); setMsg("");
    try {
      const { data: existing } = await supabase.from("profiles").select("id").eq("username", username).single();
      if (existing) return setError("That username is already taken.");
      await supabase.from("profiles").update({ username }).eq("id", user.id);
      if (fetchProfile) fetchProfile(user.id);
      setMsg("Username updated!");
    } catch (e) {
      setError(e.message || "Failed to update username.");
    } finally { setSaving(false); }
  }

  async function handleDeleteAccount() {
    if (!window.confirm("Are you sure? This cannot be undone.")) return;
    await supabase.from("profiles").delete().eq("id", user.id);
    await supabase.auth.signOut();
    navigate("/");
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "32px 20px 60px" }}>
      <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 36, fontWeight: 900, textTransform: "uppercase", marginBottom: 28 }}>
        Account Settings
      </h1>

      {/* Username */}
      <div style={{ background: "var(--panel)", border: "1px solid var(--ring)", borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.4px" }}>Username</h2>
        {error && <div style={errorStyle}>{error}</div>}
        {msg   && <div style={successStyle}>{msg}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <input value={username} onChange={e => setUsername(e.target.value)} style={{ ...inputStyle, flex: 1 }}
            onFocus={e => e.target.style.borderColor = "#4da6ff"}
            onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.12)"}
          />
          <button onClick={saveUsername} disabled={saving} style={{
            padding: "12px 20px", borderRadius: 10, background: "#ff3232",
            border: "none", color: "#fff", fontWeight: 700, cursor: "pointer", flexShrink: 0,
          }}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* Email */}
      <div style={{ background: "var(--panel)", border: "1px solid var(--ring)", borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.4px" }}>Email</h2>
        <p style={{ color: "var(--muted2)", fontSize: 14, margin: 0 }}>{user?.email}</p>
      </div>

      {/* Sign out */}
      <div style={{ background: "var(--panel)", border: "1px solid var(--ring)", borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.4px" }}>Session</h2>
        <button onClick={() => { signOut(); navigate("/"); }} style={{
          padding: "9px 20px", borderRadius: 8, background: "transparent",
          border: "1px solid var(--ring-md)", color: "var(--muted2)",
          fontWeight: 700, fontSize: 13, cursor: "pointer",
        }}>Sign out</button>
      </div>

      {/* Danger zone */}
      <div style={{ background: "rgba(255,50,50,0.06)", border: "1px solid rgba(255,50,50,0.2)", borderRadius: 12, padding: 20 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.4px", color: "#ff3232" }}>Danger Zone</h2>
        <p style={{ color: "var(--muted2)", fontSize: 13, margin: "0 0 12px" }}>Permanently delete your account and all data.</p>
        <button onClick={handleDeleteAccount} style={{
          padding: "9px 20px", borderRadius: 8, background: "rgba(255,50,50,0.15)",
          border: "1px solid rgba(255,50,50,0.3)", color: "#ff3232",
          fontWeight: 700, fontSize: 13, cursor: "pointer",
        }}>Delete Account</button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   COMMENTS SECTION
───────────────────────────────────────── */
export function CommentsSection({ articleUrl, articleTitle }) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [comments, setComments] = useState([]);
  const [body, setBody]         = useState("");
  const [loading, setLoading]   = useState(true);
  const [posting, setPosting]   = useState(false);
  const [error, setError]       = useState("");

  useEffect(() => {
    fetchComments();
  }, [articleUrl]);

  async function fetchComments() {
    try {
      const { data } = await supabase
        .from("comments")
        .select("*, profiles(username, avatar_url)")
        .eq("article_url", articleUrl)
        .order("created_at", { ascending: false });
      setComments(data || []);
    } catch (e) {
      console.error("Failed to load comments", e);
    } finally { setLoading(false); }
  }

  async function postComment(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setPosting(true); setError("");
    try {
      const { error: err } = await supabase.from("comments").insert({
        user_id:       user.id,
        article_url:   articleUrl,
        article_title: articleTitle,
        body:          body.trim(),
      });
      if (err) throw err;
      setBody("");
      fetchComments();
    } catch (e) {
      setError(e.message || "Failed to post comment.");
    } finally { setPosting(false); }
  }

  async function deleteComment(id) {
    await supabase.from("comments").delete().eq("id", id);
    setComments(c => c.filter(x => x.id !== id));
  }

  function timeAgo(iso) {
    if (!iso) return "";
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    const m = Math.floor(diff / 60);
    if (m < 1)  return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  return (
    <div style={{ marginTop: 32 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, paddingBottom: 14, borderBottom: "1px solid var(--ring)" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 900, textTransform: "uppercase", margin: 0 }}>
          Discussion
        </h2>
        <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>
          {comments.length} {comments.length === 1 ? "comment" : "comments"}
        </span>
      </div>

      {/* Comment form */}
      {user ? (
        <form onSubmit={postComment} style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            {/* Avatar */}
            <div style={{
              width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
              background: profile?.avatar_url ? "transparent" : "var(--red)",
              border: profile?.avatar_url ? "1px solid var(--ring)" : "none",
              overflow: "hidden",
              display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#fff",
            }}>
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="you" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : (profile?.username || user.email || "U").slice(0, 2).toUpperCase()
              }
            </div>
            <div style={{ flex: 1 }}>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Share your thoughts..."
                rows={3}
                style={{
                  width: "100%", padding: "10px 14px",
                  background: "var(--panel2)", border: "1px solid var(--ring-md)",
                  borderRadius: 10, color: "var(--text)", fontSize: 14,
                  fontFamily: "var(--font-body)", outline: "none",
                  resize: "vertical", minHeight: 80, transition: "border-color .15s",
                }}
                onFocus={e => e.target.style.borderColor = "var(--blue)"}
                onBlur={e => e.target.style.borderColor = "var(--ring-md)"}
              />
              {error && <div style={{ fontSize: 12, color: "var(--red)", marginTop: 4 }}>{error}</div>}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button type="submit" disabled={posting || !body.trim()} style={{
                  padding: "8px 20px", borderRadius: 8, background: "var(--red)",
                  border: "none", color: "#fff", fontWeight: 700, fontSize: 13,
                  cursor: posting || !body.trim() ? "not-allowed" : "pointer",
                  opacity: posting || !body.trim() ? 0.6 : 1, transition: ".15s",
                }}>
                  {posting ? "Posting…" : "Post Comment"}
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div style={{
          padding: "16px 20px", background: "var(--panel)",
          border: "1px solid var(--ring)", borderRadius: 12,
          marginBottom: 28, textAlign: "center",
        }}>
          <p style={{ color: "var(--muted2)", fontSize: 14, margin: "0 0 10px" }}>
            Join the discussion — log in to comment
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button onClick={() => navigate("/login")} style={{
              padding: "7px 18px", borderRadius: 8, background: "var(--red)",
              border: "none", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}>Log in</button>
            <button onClick={() => navigate("/signup")} style={{
              padding: "7px 18px", borderRadius: 8, background: "transparent",
              border: "1px solid var(--ring-md)", color: "var(--text)",
              fontWeight: 700, fontSize: 13, cursor: "pointer",
            }}>Sign up</button>
          </div>
        </div>
      )}

      {/* Comments list */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ display: "flex", gap: 12 }}>
              <div className="skeleton-box" style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton-box" style={{ height: 12, width: "30%", borderRadius: 6, marginBottom: 8 }} />
                <div className="skeleton-box" style={{ height: 10, borderRadius: 6, marginBottom: 4 }} />
                <div className="skeleton-box" style={{ height: 10, width: "70%", borderRadius: 6 }} />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 14, textAlign: "center", padding: "20px 0" }}>
          No comments yet. Be the first to share your thoughts!
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {comments.map(c => {
            const username = c.profiles?.username || "Unknown";
            const initials = username.slice(0, 2).toUpperCase();
            const isOwn = user?.id === c.user_id;
            return (
              <div key={c.id} style={{ display: "flex", gap: 12 }}>
                {/* Avatar */}
                <a href={`/user/${username}`} style={{
                  width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                  background: c.profiles?.avatar_url ? "transparent" : "var(--panel2)",
                  border: "1px solid var(--ring)", overflow: "hidden",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 800, color: "var(--muted2)",
                  textDecoration: "none", transition: ".15s",
                }}>
                  {c.profiles?.avatar_url
                    ? <img src={c.profiles.avatar_url} alt={username} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : initials
                  }
                </a>

                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <a href={`/user/${username}`} style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", textDecoration: "none" }}>
                      {username}
                    </a>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{timeAgo(c.created_at)}</span>
                    {isOwn && (
                      <button onClick={() => deleteComment(c.id)} style={{
                        marginLeft: "auto", background: "transparent", border: "none",
                        color: "var(--muted)", fontSize: 11, cursor: "pointer",
                        padding: "2px 6px", borderRadius: 4, transition: ".15s",
                      }}
                      onMouseEnter={e => e.target.style.color = "var(--red)"}
                      onMouseLeave={e => e.target.style.color = "var(--muted)"}
                      >Delete</button>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: 14, color: "var(--muted2)", lineHeight: 1.6 }}>
                    {c.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

