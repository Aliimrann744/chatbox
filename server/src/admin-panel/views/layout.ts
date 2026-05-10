/**
 * Inline HTML layout for the admin panel. Tailwind via Play CDN + Chart.js
 * via jsdelivr — same lean pattern as the existing /delete-account page.
 * No build pipeline, no extra deps.
 */

export interface LayoutOptions {
  title: string;
  active:
    | 'dashboard'
    | 'api-keys'
    | 'users'
    | 'messages'
    | 'audit'
    | 'issue-key'
    | 'revoke-key'
    | 'detail';
  body: string;
  scripts?: string;
}

const NAV_ITEMS: Array<{ key: LayoutOptions['active']; href: string; label: string; icon: string }> = [
  {
    key: 'dashboard',
    href: '/admin-panel/dashboard',
    label: 'Dashboard',
    icon: 'M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10',
  },
  {
    key: 'issue-key',
    href: '/admin-panel/issue-key',
    label: 'Issue API Key',
    icon: 'M12 4v16m8-8H4',
  },
  {
    key: 'revoke-key',
    href: '/admin-panel/revoke-key',
    label: 'Revoke Key',
    icon: 'M6 18L18 6M6 6l12 12',
  },
  {
    key: 'api-keys',
    href: '/admin-panel/api-keys',
    label: 'API Keys',
    icon: 'M15 7a4 4 0 110 8 4 4 0 010-8zM3 13l4-4m0 0l4 4m-4-4v8',
  },
  {
    key: 'users',
    href: '/admin-panel/users',
    label: 'Owners',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  },
  {
    key: 'messages',
    href: '/admin-panel/messages',
    label: 'Messages Log',
    icon: 'M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z',
  },
  {
    key: 'audit',
    href: '/admin-panel/audit',
    label: 'Login Audit',
    icon: 'M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
];

export function renderLayout(opts: LayoutOptions): string {
  const navHtml = NAV_ITEMS.map((item) => {
    const isActive = item.key === opts.active;
    return `<a href="${item.href}" class="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
      isActive
        ? 'bg-indigo-600 text-white shadow-sm'
        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
    }">
      <svg class="h-5 w-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${item.icon}"/></svg>
      <span>${item.label}</span>
    </a>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex,nofollow" />
  <title>${escapeHtml(opts.title)} · Whatchat Admin</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
    .scrollbar-thin::-webkit-scrollbar { width: 8px; height: 8px; }
    .scrollbar-thin::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
  </style>
</head>
<body class="bg-slate-50 text-slate-800">
  <div class="flex min-h-screen">
    <aside class="hidden md:flex md:flex-col w-64 bg-slate-900 text-white">
      <div class="px-6 py-5 border-b border-slate-800">
        <div class="flex items-center gap-3">
          <div class="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white">W</div>
          <div>
            <div class="font-semibold tracking-tight">Whatchat</div>
            <div class="text-xs text-slate-400">Admin Console</div>
          </div>
        </div>
      </div>
      <nav class="flex-1 px-3 py-4 space-y-1">
        ${navHtml}
      </nav>
      <div class="px-4 py-4 border-t border-slate-800 text-xs text-slate-400">
        <form action="/admin-panel/logout" method="POST">
          <button type="submit" class="w-full rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 text-sm font-medium transition">
            Sign out
          </button>
        </form>
        <div class="mt-3 text-center">v1.0 · ${new Date().toISOString().slice(0, 10)}</div>
      </div>
    </aside>

    <main class="flex-1 min-w-0">
      <header class="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10 backdrop-blur">
        <div class="flex items-center justify-between">
          <h1 class="text-xl font-semibold tracking-tight">${escapeHtml(opts.title)}</h1>
          <div class="flex items-center gap-2 text-xs text-slate-500">
            <span class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span> live</span>
          </div>
        </div>
      </header>
      <div class="p-6">
        ${opts.body}
      </div>
    </main>
  </div>

  <script>
    // Shared helpers used across pages.
    window.fmtDate = function(iso) {
      if (!iso) return '—';
      const d = new Date(iso);
      return d.toLocaleString();
    };
    window.fmtRelative = function(iso) {
      if (!iso) return '—';
      const diff = Date.now() - new Date(iso).getTime();
      const s = Math.floor(diff / 1000);
      if (s < 60) return s + 's ago';
      const m = Math.floor(s / 60);
      if (m < 60) return m + 'm ago';
      const h = Math.floor(m / 60);
      if (h < 24) return h + 'h ago';
      return Math.floor(h / 24) + 'd ago';
    };
    window.fmtNumber = function(n) {
      return new Intl.NumberFormat().format(n || 0);
    };
    window.escapeHtml = function(s) {
      if (s == null) return '';
      return String(s).replace(/[&<>"']/g, function(c) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
      });
    };
    window.adminFetch = async function(path, opts) {
      const res = await fetch(path, Object.assign({ credentials: 'same-origin' }, opts || {}));
      if (res.status === 401) {
        window.location.href = '/admin-panel?adminError=session_expired';
        throw new Error('unauthorized');
      }
      if (!res.ok) throw new Error('Request failed: ' + res.status);
      return res.json();
    };
  </script>
  ${opts.scripts ?? ''}
</body>
</html>`;
}

export function renderLogin(error?: string): string {
  const errorBanner = error
    ? `<div class="rounded-md bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 mb-4">${escapeHtml(formatLoginError(error))}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex,nofollow" />
  <title>Sign in · Whatchat Admin</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}</style>
</head>
<body class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex items-center justify-center px-4">
  <div class="w-full max-w-md">
    <div class="text-center mb-6">
      <div class="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-2xl font-bold shadow-lg">W</div>
      <h1 class="mt-4 text-2xl font-semibold text-white tracking-tight">Whatchat Admin</h1>
      <p class="text-slate-400 text-sm">Sign in to manage public API access</p>
    </div>
    <div class="bg-white rounded-xl shadow-xl p-6">
      ${errorBanner}
      <form method="POST" action="/admin-panel/login" autocomplete="off" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Username</label>
          <input name="username" required autofocus type="text" class="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring focus:ring-indigo-100 outline-none" placeholder="superadmin" />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Password</label>
          <input name="password" required type="password" class="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:ring focus:ring-indigo-100 outline-none" />
        </div>
        <button type="submit" class="w-full rounded-md bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 text-sm font-semibold transition shadow-sm">
          Sign in
        </button>
      </form>
    </div>
    <p class="text-center text-xs text-slate-500 mt-4">Authorized personnel only · all attempts are logged</p>
  </div>
</body>
</html>`;
}

function formatLoginError(code: string): string {
  switch (code) {
    case 'invalid_credentials':
      return 'Invalid username or password.';
    case 'session_expired':
      return 'Your session has expired. Please sign in again.';
    case 'rate_limited':
      return 'Too many attempts. Please try again in a few minutes.';
    default:
      return 'Sign-in failed. Please try again.';
  }
}

export function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return map[c] ?? c;
  });
}
