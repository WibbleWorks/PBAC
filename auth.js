// auth.js — Social login + server-side progress sync (Roadmap: Phase 14)
// ============================================================================
// WHAT THIS DOES
//
//   1. On boot, fetches `auth-config.json`. If absent → course runs in
//      localStorage-only mode (the existing behavior).
//   2. If config is present, loads the Supabase browser SDK from CDN and
//      shows a "Sign in" button in the header.
//   3. After sign-in (Google / GitHub / email OTP), the user's progress
//      is fetched from the Supabase `progress` table and merged into the
//      in-memory course state.
//   4. Every time the course calls `saveProgress()`, auth.js also pushes
//      the data to Supabase (if logged in), so progress is always backed up.
//   5. On sign-out, local progress is kept and the export/import bridge
//      remains available.
//
// SETUP
//
//   1. Create a free project at https://supabase.com
//   2. Run the SQL migration in docs/PROGRESS_ARCHITECTURE.md
//   3. Enable Google / GitHub OAuth in Auth > Providers
//   4. Create `auth-config.json` in the repo root:
//        { "supabaseUrl": "https://xxx.supabase.co", "supabaseAnonKey": "eyJ..." }
//   5. Add `auth-config.json` to .gitignore
//   6. The course auto-detects it and shows the login UI
//
// See docs/PROGRESS_ARCHITECTURE.md for the full architecture doc.

(function () {
  'use strict';

  const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
  // We also try the UMD build first since ESM import() inside an inline
  // script can be tricky depending on CSP.
  const SUPABASE_CDN_UMD = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';

  // --- State -----------------------------------------------------------------
  let supabase = null;
  let currentUser = null;
  let authEnabled = false;

  // --- Boot ------------------------------------------------------------------
  window.addEventListener('DOMContentLoaded', async () => {
    try {
      const resp = await fetch('auth-config.json');
      if (!resp.ok) {
        console.log('[auth] No auth-config.json found — running in localStorage-only mode.');
        return;
      }
      const cfg = await resp.json();
      if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
        console.warn('[auth] auth-config.json is missing supabaseUrl or supabaseAnonKey.');
        return;
      }

      authEnabled = true;
      await loadSupabaseSDK(cfg);
      await checkSession();
    } catch (e) {
      // 404 is expected when auth-config.json doesn't exist
      if (e.message && !e.message.includes('404')) {
        console.warn('[auth] Init failed:', e.message);
      }
    }
  });

  async function loadSupabaseSDK(cfg) {
    // Try UMD build first (reliable across CSP policies)
    if (!window.supabase) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = SUPABASE_CDN_UMD;
        s.onload = resolve;
        s.onerror = () => reject(new Error('Failed to load Supabase SDK'));
        document.head.appendChild(s);
      });
    }
    const factory = window.supabase ? window.supabase.createClient
      : null;

    if (!factory) {
      // Fallback: dynamic import the ESM build
      const mod = await import(SUPABASE_CDN);
      const fn = mod.createClient || (mod.default && mod.default.createClient);
      if (!fn) throw new Error('Could not find createClient on Supabase SDK');
      supabase = fn(cfg.supabaseUrl, cfg.supabaseAnonKey);
    } else {
      supabase = factory(cfg.supabaseUrl, cfg.supabaseAnonKey);
    }

    console.log('[auth] Supabase SDK loaded.');
  }

  async function checkSession() {
    if (!supabase) return;
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
      showLoginButton();
      return;
    }
    currentUser = data.session.user;
    await syncProgressFromServer();
    showUserControls();
  }

  // --- UI --------------------------------------------------------------------

  function showLoginButton() {
    const header = document.querySelector('.user-stats');
    if (!header) return;

    let btn = document.getElementById('signInBtn');
    if (btn) return; // already rendered

    btn = document.createElement('button');
    btn.id = 'signInBtn';
    btn.style.cssText = 'padding: 0.3rem 0.75rem; background: var(--ai-blue); color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 500;';
    btn.innerHTML = '👤 Sign in';
    btn.addEventListener('click', openLoginModal);
    header.appendChild(btn);
  }

  function showUserControls() {
    const header = document.querySelector('.user-stats');
    if (!header) return;

    // Replace "Sign in" button with user avatar + sign-out
    const btn = document.getElementById('signInBtn');
    if (btn) btn.remove();

    let container = document.getElementById('userControls');
    if (container) return;
    container = document.createElement('div');
    container.id = 'userControls';
    container.style.cssText = 'display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem;';

    const email = currentUser?.email || 'Unknown';
    let initials = '<span style="background:var(--ai-purple);color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:600;">' + email[0].toUpperCase() + '</span>';

    const nameSpan = document.createElement('span');
    nameSpan.style.cssText = 'color: #c5d4e3; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
    nameSpan.textContent = email.split('@')[0];

    const signOutBtn = document.createElement('button');
    signOutBtn.textContent = 'Sign out';
    signOutBtn.style.cssText = 'padding: 0.2rem 0.5rem; background: var(--surface-color); color: #c5d4e3; border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; font-size: 0.8rem;';
    signOutBtn.addEventListener('click', signOut);

    const avatar = document.createElement('span');
    avatar.innerHTML = initials;

    container.appendChild(avatar);
    container.appendChild(nameSpan);
    container.appendChild(signOutBtn);
    header.appendChild(container);
  }

  function openLoginModal() {
    const overlay = document.createElement('div');
    overlay.id = 'authOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.95);display:flex;align-items:center;justify-content:center;z-index:30000;padding:1rem;';
    overlay.innerHTML = `
      <div style="background:var(--surface-color);border-radius:12px;padding:2rem;max-width:340px;text-align:center;box-shadow:var(--shadow-lg);">
        <h2 style="color:var(--ai-blue);margin-bottom:1.5rem;">👤 Sign in to sync</h2>
        <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:1.5rem;">Sign in to save your progress in the cloud. You can use any browser or device — progress follows you.</p>
        <div style="display:flex;flex-direction:column;gap:0.75rem;">
          <button id="authGoogleBtn" style="padding:0.75rem;background:#fff;color:#333;border:1px solid var(--border-color);border-radius:8px;cursor:pointer;font-size:0.95rem;font-weight:500;font-family:var(--font-sans);">🔴 Continue with Google</button>
          <button id="authGithubBtn" style="padding:0.75rem;background:#fff;color:#333;border:1px solid var(--border-color);border-radius:8px;cursor:pointer;font-size:0.95rem;font-weight:500;font-family:var(--font-sans);">🐙 Continue with GitHub</button>
          <div style="border-top:1px solid var(--border-color);padding-top:0.75rem;">
            <input id="authEmail" type="email" placeholder="your@email.com" style="width:100%;padding:0.6rem;background:var(--primary-bg);color:var(--text-primary);border:1px solid var(--border-color);border-radius:6px;font-size:0.9rem;margin-bottom:0.5rem;box-sizing:border-box;" />
            <button id="authEmailBtn" style="width:100%;padding:0.6rem;background:var(--ai-blue);color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:0.9rem;font-weight:500;">✉️ Send magic link</button>
          </div>
          <button id="authCancelBtn" style="width:100%;padding:0.5rem;background:transparent;color:var(--text-muted);border:none;cursor:pointer;font-size:0.9rem;">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#authGoogleBtn').addEventListener('click', () => signInWith('google'));
    overlay.querySelector('#authGithubBtn').addEventListener('click', () => signInWith('github'));
    overlay.querySelector('#authEmailBtn').addEventListener('click', () => signInWithEmail(overlay.querySelector('#authEmail').value, overlay));
    overlay.querySelector('#authCancelBtn').addEventListener('click', () => overlay.remove());
  }

  function closeLoginModal() {
    document.getElementById('authOverlay')?.remove();
  }

  // --- Auth ------------------------------------------------------------------

  async function signInWith(provider) {
    if (!supabase) return;
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider });
      if (error) throw error;
      // The browser will redirect to the OAuth provider — no JS needed.
      // After the OAuth dance, the user returns to this page and checkSession()
      // picks up the session automatically (runs on DOMContentLoaded).
    } catch (e) {
      alert('Sign-in failed: ' + e.message);
    }
  }

  async function signInWithEmail(email, overlay) {
    if (!supabase || !email) {
      if (!email) alert('Please enter your email address.');
      return;
    }
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      // Show success message
      overlay.innerHTML = `
        <div style="background:var(--surface-color);border-radius:12px;padding:2rem;max-width:340px;text-align:center;box-shadow:var(--shadow-lg);">
          <h2 style="color:var(--ai-green);margin-bottom:1rem;">✓ Check your inbox</h2>
          <p style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:1.5rem;">We sent a magic link to <strong>${email}</strong>. Click the link in the email to sign in.</p>
          <button id="authDoneBtn" style="padding:0.6rem 1.5rem;background:var(--ai-blue);color:#fff;border:none;border-radius:6px;cursor:pointer;">OK</button>
        </div>
      `;
      overlay.querySelector('#authDoneBtn').addEventListener('click', () => overlay.remove());
    } catch (e) {
      alert('Email sign-in failed: ' + e.message);
    }
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    currentUser = null;
    document.getElementById('userControls')?.remove();
    showLoginButton();
    console.log('[auth] Signed out. Local progress is retained.');
  }

  // --- Progress sync ---------------------------------------------------------

  async function syncProgressFromServer() {
    if (!supabase || !currentUser) return;
    try {
      const { data, error } = await supabase
        .from('progress')
        .select('data')
        .eq('user_id', currentUser.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = "no rows found"
        throw error;
      }

      if (data && data.data) {
        const serverProgress = data.data;
        // Merge: server progress replaces local (because it's the
        // source of truth). If local is newer, saveProgress() below
        // will push the local version on the next write.
        const course = window.course;
        if (course) {
          course.completedLessons = new Set(serverProgress.completedLessons || []);
          course.scores = serverProgress.scores || {};
          course.weakAreas = serverProgress.weakAreas || [];
          course.timeSpent = serverProgress.timeSpent || 0;
          course.confidenceLevels = serverProgress.confidenceLevels || {};
          course.currentLessonId = serverProgress.currentLessonId || null;

          if (serverProgress.learningPath) {
            course.setLearningPath(serverProgress.learningPath);
          }

          course.saveProgress();
          course.buildNavigation();
          course.updateProgress();

          // Resume the lesson
          const resumeId = course.currentLessonId && course.findLesson(course.currentLessonId)
            ? course.currentLessonId
            : (course.getFirstLesson() ? course.getFirstLesson().id : null);
          if (resumeId) course.showLesson(resumeId);

          console.log('[auth] Progress loaded from server:', serverProgress.completedLessons.length, 'lessons completed.');
        }
      }
    } catch (e) {
      console.warn('[auth] Failed to load progress from server:', e.message);
    }
  }

  async function syncProgressToServer() {
    if (!supabase || !currentUser) return;
    const course = window.course;
    if (!course) return;
    try {
      const data = {
        completedLessons: Array.from(course.completedLessons),
        scores: course.scores,
        weakAreas: course.weakAreas,
        timeSpent: course.timeSpent,
        confidenceLevels: course.confidenceLevels,
        currentLessonId: course.currentLessonId,
        learningPath: course.learningPath,
      };
      const { error } = await supabase
        .from('progress')
        .upsert({ user_id: currentUser.id, data });

      if (error) throw error;
      // console.log('[auth] Progress synced to server.');
    } catch (e) {
      console.warn('[auth] Failed to sync progress to server:', e.message);
      // Non-fatal: localStorage still has the data.
    }
  }

  // Expose the sync function so main.js can call it after every saveProgress()
  window.authSync = {
    syncToServer: syncProgressToServer,
    isEnabled: () => authEnabled && !!currentUser,
  };
})();