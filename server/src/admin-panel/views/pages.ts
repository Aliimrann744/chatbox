import { renderLayout } from './layout';

// Safely embed a string in an inline <script> — JSON.stringify alone is not
// XSS-safe because a `</script>` substring would close our script tag.
function safeJsonString(value: string): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/-->/g, '--\\u003e');
}

// ─────────────────────────── Dashboard ───────────────────────────

export function renderDashboard(): string {
  const body = `
    <div class="space-y-6">
      <div id="overview-cards" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        ${cardSkeleton()}${cardSkeleton()}${cardSkeleton()}${cardSkeleton()}
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-base font-semibold text-slate-900">Messages over time</h2>
              <p class="text-xs text-slate-500">Last 30 days · success vs. failed</p>
            </div>
            <select id="ts-range" class="text-xs border border-slate-200 rounded-md px-2 py-1">
              <option value="7">7d</option>
              <option value="30" selected>30d</option>
              <option value="90">90d</option>
            </select>
          </div>
          <div class="relative w-full" style="height: 280px;">
            <canvas id="ts-chart"></canvas>
          </div>
        </div>

        <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 class="text-base font-semibold text-slate-900 mb-1">Top API keys</h2>
          <p class="text-xs text-slate-500 mb-4">By message volume</p>
          <div class="relative w-full" style="height: 280px;">
            <canvas id="top-chart"></canvas>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 class="text-base font-semibold text-slate-900">Active right now</h2>
            <p class="text-xs text-slate-500" id="active-window-label">Keys used in the last 5 min</p>
          </div>
          <span class="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
            <span class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span id="active-count">0</span> live
          </span>
        </div>
        <div class="overflow-x-auto scrollbar-thin">
          <table class="min-w-full text-sm">
            <thead class="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th class="text-left px-5 py-3 font-medium">Key</th>
                <th class="text-left px-5 py-3 font-medium">Owner</th>
                <th class="text-left px-5 py-3 font-medium">Last used</th>
                <th class="text-right px-5 py-3 font-medium">Recent</th>
              </tr>
            </thead>
            <tbody id="active-tbody" class="divide-y divide-slate-100"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const scripts = `<script>
    const overviewEl = document.getElementById('overview-cards');
    const tsRangeEl = document.getElementById('ts-range');
    const activeTbody = document.getElementById('active-tbody');
    const activeCount = document.getElementById('active-count');
    const activeWindowLabel = document.getElementById('active-window-label');
    let tsChart, topChart;

    function metricCard(label, value, sub, accent) {
      const accents = {
        indigo: 'from-indigo-500 to-indigo-600',
        emerald: 'from-emerald-500 to-emerald-600',
        amber: 'from-amber-500 to-amber-600',
        rose: 'from-rose-500 to-rose-600',
      };
      return \`<div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <p class="text-xs uppercase tracking-wide text-slate-500 font-medium">\${escapeHtml(label)}</p>
          <span class="inline-block h-8 w-8 rounded-lg bg-gradient-to-br \${accents[accent] || accents.indigo}"></span>
        </div>
        <p class="mt-2 text-3xl font-semibold text-slate-900">\${fmtNumber(value)}</p>
        <p class="text-xs text-slate-500 mt-1">\${escapeHtml(sub)}</p>
      </div>\`;
    }

    async function loadOverview() {
      const data = await adminFetch('/admin-panel/api/overview');
      overviewEl.innerHTML = [
        metricCard('Total API keys', data.totalKeys, data.activeKeys + ' active · ' + data.revokedKeys + ' revoked', 'indigo'),
        metricCard('Active right now', data.activeNow, 'In the last ' + data.activeWindowMinutes + ' min', 'emerald'),
        metricCard('Messages today', data.messagesToday, fmtNumber(data.messagesLast24h) + ' in last 24h · ' + fmtNumber(data.messagesFailedToday) + ' failed', 'amber'),
        metricCard('Total messages sent', data.totalMessages, data.uniqueOwners + ' key owners', 'rose'),
      ].join('');
      activeWindowLabel.textContent = 'Keys used in the last ' + data.activeWindowMinutes + ' min';
    }

    async function loadTimeseries() {
      const days = tsRangeEl.value;
      const data = await adminFetch('/admin-panel/api/timeseries?days=' + days);
      const labels = data.points.map(p => p.day.slice(5));
      const success = data.points.map(p => p.success);
      const failed = data.points.map(p => p.failed);

      if (tsChart) { tsChart.destroy(); }
      tsChart = new Chart(document.getElementById('ts-chart'), {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'Success', data: success, borderColor: '#4f46e5', backgroundColor: 'rgba(79,70,229,0.12)', fill: true, tension: 0.35, borderWidth: 2, pointRadius: 0 },
            { label: 'Failed', data: failed, borderColor: '#e11d48', backgroundColor: 'rgba(225,29,72,0.10)', fill: true, tension: 0.35, borderWidth: 2, pointRadius: 0 },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          resizeDelay: 200,
          animation: false,
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 } } },
            y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 }, precision: 0 } },
          },
        },
      });
    }

    async function loadTopKeys() {
      const data = await adminFetch('/admin-panel/api/top-keys?limit=8');
      if (topChart) topChart.destroy();
      topChart = new Chart(document.getElementById('top-chart'), {
        type: 'bar',
        data: {
          labels: data.map(k => (k.label || '(no label)') + ' · ' + (k.ownerName || '')),
          datasets: [{ label: 'Messages', data: data.map(k => k.total), backgroundColor: '#6366f1', borderRadius: 4 }],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          resizeDelay: 200,
          animation: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 }, precision: 0 } },
            y: { grid: { display: false }, ticks: { font: { size: 10 } } },
          },
        },
      });
    }

    async function loadActive() {
      const data = await adminFetch('/admin-panel/api/active');
      activeCount.textContent = data.items.length;
      if (data.items.length === 0) {
        activeTbody.innerHTML = '<tr><td colspan="4" class="px-5 py-8 text-center text-sm text-slate-400">No keys are sending messages right now.</td></tr>';
        return;
      }
      activeTbody.innerHTML = data.items.map(k => \`
        <tr class="hover:bg-slate-50">
          <td class="px-5 py-3">
            <a href="/admin-panel/api-keys/\${encodeURIComponent(k.id)}" class="font-medium text-indigo-600 hover:underline">\${escapeHtml(k.label)}</a>
            <div class="text-xs text-slate-500 font-mono">\${escapeHtml(k.keyPrefix)}…</div>
          </td>
          <td class="px-5 py-3">
            <a href="/admin-panel/users/\${encodeURIComponent(k.owner.id)}" class="text-slate-700 hover:underline">\${escapeHtml(k.owner.name || '(no name)')}</a>
            <div class="text-xs text-slate-500">\${escapeHtml(k.owner.phone || '')}</div>
          </td>
          <td class="px-5 py-3 text-slate-600">\${fmtRelative(k.lastUsedAt)}</td>
          <td class="px-5 py-3 text-right font-medium">\${fmtNumber(k.recentMessages)}</td>
        </tr>
      \`).join('');
    }

    async function refreshAll() {
      await Promise.all([loadOverview(), loadActive()]);
    }

    tsRangeEl.addEventListener('change', loadTimeseries);

    // Self-rescheduling poll. Using setTimeout (not setInterval) so a slow
    // request never causes another to fire on top of it, and we pause while
    // the tab is hidden so a backgrounded admin tab doesn't keep hitting
    // the server.
    function schedule(fn, intervalMs) {
      let cancelled = false;
      async function tick() {
        if (cancelled) return;
        if (document.visibilityState === 'visible') {
          try { await fn(); } catch (e) { /* keep polling on transient errors */ }
        }
        if (!cancelled) setTimeout(tick, intervalMs);
      }
      setTimeout(tick, intervalMs);
      return () => { cancelled = true; };
    }

    refreshAll();
    loadTimeseries();
    loadTopKeys();
    schedule(refreshAll, 10_000);
    schedule(loadTopKeys, 60_000);
  </script>`;

  return renderLayout({ title: 'Dashboard', active: 'dashboard', body, scripts });
}

function cardSkeleton(): string {
  return `<div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm animate-pulse">
    <div class="h-3 w-20 bg-slate-200 rounded"></div>
    <div class="mt-4 h-7 w-24 bg-slate-200 rounded"></div>
    <div class="mt-2 h-3 w-32 bg-slate-200 rounded"></div>
  </div>`;
}

// ─────────────────────────── API Keys list ───────────────────────────

export function renderApiKeysList(): string {
  const body = `
    <div class="space-y-4">
      <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div class="flex flex-wrap items-center gap-3">
          <input id="search" type="text" placeholder="Search by label, prefix, owner name/phone/email…" class="flex-1 min-w-[240px] rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring focus:ring-indigo-100 outline-none" />
          <select id="status-filter" class="rounded-md border border-slate-200 px-3 py-2 text-sm">
            <option value="all">All keys</option>
            <option value="active">Active only</option>
            <option value="revoked">Revoked only</option>
          </select>
          <select id="page-size" class="rounded-md border border-slate-200 px-3 py-2 text-sm">
            <option value="25">25 / page</option>
            <option value="50">50 / page</option>
            <option value="100">100 / page</option>
          </select>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="overflow-x-auto scrollbar-thin">
          <table class="min-w-full text-sm">
            <thead class="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th class="text-left px-5 py-3 font-medium">Label / Prefix</th>
                <th class="text-left px-5 py-3 font-medium">Owner</th>
                <th class="text-left px-5 py-3 font-medium">Permissions</th>
                <th class="text-left px-5 py-3 font-medium">Status</th>
                <th class="text-right px-5 py-3 font-medium">Messages</th>
                <th class="text-left px-5 py-3 font-medium">Last used</th>
                <th class="text-left px-5 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody id="keys-tbody" class="divide-y divide-slate-100"></tbody>
          </table>
        </div>
        <div id="pager" class="border-t border-slate-200 px-5 py-3 flex items-center justify-between text-sm text-slate-600"></div>
      </div>
    </div>
  `;

  const scripts = `<script>
    let page = 1, pageSize = 25, debounceTimer;
    const tbody = document.getElementById('keys-tbody');
    const pager = document.getElementById('pager');
    const search = document.getElementById('search');
    const statusFilter = document.getElementById('status-filter');
    const pageSizeEl = document.getElementById('page-size');

    function badge(text, color) {
      const colors = {
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        rose: 'bg-rose-50 text-rose-700 border-rose-200',
        slate: 'bg-slate-50 text-slate-700 border-slate-200',
        indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        amber: 'bg-amber-50 text-amber-700 border-amber-200',
      };
      return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ' + (colors[color] || colors.slate) + '">' + escapeHtml(text) + '</span>';
    }

    async function load() {
      tbody.innerHTML = '<tr><td colspan="7" class="px-5 py-6 text-center text-sm text-slate-400">Loading…</td></tr>';
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        status: statusFilter.value,
        search: search.value || '',
      });
      const data = await adminFetch('/admin-panel/api/api-keys?' + params.toString());
      if (data.items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="px-5 py-8 text-center text-sm text-slate-400">No API keys match.</td></tr>';
      } else {
        tbody.innerHTML = data.items.map(function(k) {
          const status = k.revokedAt ? badge('Revoked', 'rose') : (k.isActiveNow ? badge('Active now', 'emerald') : badge('Idle', 'slate'));
          const perms = [
            k.canSendText ? badge('Text', 'indigo') : '',
            k.canSendVoice ? badge('Voice', 'amber') : '',
          ].join(' ');
          return \`<tr class="hover:bg-slate-50">
            <td class="px-5 py-3">
              <a href="/admin-panel/api-keys/\${encodeURIComponent(k.id)}" class="font-medium text-indigo-600 hover:underline">\${escapeHtml(k.label)}</a>
              <div class="text-xs font-mono text-slate-500">\${escapeHtml(k.keyPrefix)}…</div>
            </td>
            <td class="px-5 py-3">
              <a href="/admin-panel/users/\${encodeURIComponent(k.owner.id)}" class="text-slate-800 hover:underline font-medium">\${escapeHtml(k.owner.name || '(no name)')}</a>
              <div class="text-xs text-slate-500">\${escapeHtml(k.owner.phone || k.owner.email || '')}</div>
            </td>
            <td class="px-5 py-3">\${perms}</td>
            <td class="px-5 py-3">\${status}</td>
            <td class="px-5 py-3 text-right">
              <div class="font-semibold text-slate-900">\${fmtNumber(k.totalMessages)}</div>
              <div class="text-xs text-slate-500">\${fmtNumber(k.successCount)} ok · \${fmtNumber(k.failedCount)} fail</div>
            </td>
            <td class="px-5 py-3 text-slate-600">\${fmtRelative(k.lastUsedAt)}</td>
            <td class="px-5 py-3 text-slate-600">\${fmtDate(k.createdAt)}</td>
          </tr>\`;
        }).join('');
      }
      pager.innerHTML = \`
        <div>Showing \${((data.page - 1) * data.pageSize) + 1}–\${Math.min(data.page * data.pageSize, data.total)} of \${fmtNumber(data.total)}</div>
        <div class="flex items-center gap-1">
          <button id="prev" class="px-3 py-1.5 rounded-md border border-slate-200 disabled:opacity-40" \${data.page <= 1 ? 'disabled' : ''}>Prev</button>
          <span class="px-2 text-xs">Page \${data.page} / \${data.totalPages}</span>
          <button id="next" class="px-3 py-1.5 rounded-md border border-slate-200 disabled:opacity-40" \${data.page >= data.totalPages ? 'disabled' : ''}>Next</button>
        </div>\`;
      const prevBtn = document.getElementById('prev');
      const nextBtn = document.getElementById('next');
      if (prevBtn) prevBtn.addEventListener('click', function() { page--; load(); });
      if (nextBtn) nextBtn.addEventListener('click', function() { page++; load(); });
    }

    search.addEventListener('input', function() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function() { page = 1; load(); }, 250);
    });
    statusFilter.addEventListener('change', function() { page = 1; load(); });
    pageSizeEl.addEventListener('change', function() {
      pageSize = parseInt(pageSizeEl.value, 10) || 25;
      page = 1;
      load();
    });

    load();
  </script>`;

  return renderLayout({ title: 'API Keys', active: 'api-keys', body, scripts });
}

// ─────────────────────────── API key detail ───────────────────────────

export function renderApiKeyDetail(id: string): string {
  const body = `
    <div id="key-content" class="space-y-6">
      <div class="text-sm text-slate-400">Loading…</div>
    </div>
  `;
  const scripts = `<script>
    const KEY_ID = ${safeJsonString(id)};
    const root = document.getElementById('key-content');

    function statBlock(label, value, sub) {
      return \`<div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <p class="text-xs uppercase tracking-wide text-slate-500 font-medium">\${escapeHtml(label)}</p>
        <p class="mt-2 text-2xl font-semibold text-slate-900">\${fmtNumber(value)}</p>
        \${sub ? '<p class="text-xs text-slate-500 mt-1">' + escapeHtml(sub) + '</p>' : ''}
      </div>\`;
    }

    function pill(text, color) {
      const c = { emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200', rose: 'bg-rose-50 text-rose-700 border-rose-200', slate: 'bg-slate-50 text-slate-700 border-slate-200', indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ' + (c[color] || c.slate) + '">' + escapeHtml(text) + '</span>';
    }

    async function load() {
      const data = await adminFetch('/admin-panel/api/api-keys/' + encodeURIComponent(KEY_ID));
      if (!data) {
        root.innerHTML = '<div class="text-rose-600">API key not found.</div>';
        return;
      }
      const status = data.revokedAt ? pill('Revoked', 'rose') : (data.isActiveNow ? pill('Active now', 'emerald') : pill('Idle', 'slate'));
      const perms = [
        data.canSendText ? pill('Send text', 'indigo') : '',
        data.canSendVoice ? pill('Send voice', 'indigo') : '',
      ].join(' ');

      root.innerHTML = \`
        <div class="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div class="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 class="text-xl font-semibold text-slate-900">\${escapeHtml(data.label)}</h2>
              <p class="text-sm font-mono text-slate-500">\${escapeHtml(data.keyPrefix)}…</p>
              <div class="mt-2 flex flex-wrap gap-2">\${status} \${perms}</div>
            </div>
            <a href="/admin-panel/api-keys" class="text-sm text-indigo-600 hover:underline">← Back to list</a>
          </div>
          <dl class="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div><dt class="text-slate-500 text-xs uppercase tracking-wide">Created</dt><dd class="text-slate-800">\${fmtDate(data.createdAt)}</dd></div>
            <div><dt class="text-slate-500 text-xs uppercase tracking-wide">Last used</dt><dd class="text-slate-800">\${fmtDate(data.lastUsedAt)} <span class="text-slate-500">(\${fmtRelative(data.lastUsedAt)})</span></dd></div>
            <div><dt class="text-slate-500 text-xs uppercase tracking-wide">Revoked</dt><dd class="text-slate-800">\${data.revokedAt ? fmtDate(data.revokedAt) : '—'}</dd></div>
          </dl>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          \${statBlock('Total messages', data.stats.total)}
          \${statBlock('Successful', data.stats.success)}
          \${statBlock('Failed', data.stats.failed)}
          \${statBlock('Text vs Voice', data.stats.text, data.stats.text + ' text · ' + data.stats.voice + ' voice')}
        </div>

        <div class="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 class="text-base font-semibold text-slate-900 mb-4">Owner</h3>
          <div class="flex items-center gap-4">
            <div class="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold">\${escapeHtml((data.owner.name || '?').slice(0,1).toUpperCase())}</div>
            <div>
              <a class="font-medium text-indigo-600 hover:underline" href="/admin-panel/users/\${encodeURIComponent(data.owner.id)}">\${escapeHtml(data.owner.name || '(no name)')}</a>
              <div class="text-sm text-slate-500">\${escapeHtml((data.owner.countryCode || '') + ' ' + (data.owner.phone || ''))} \${data.owner.email ? '· ' + escapeHtml(data.owner.email) : ''}</div>
              <div class="text-xs text-slate-500 mt-0.5">Joined \${fmtDate(data.owner.createdAt)} \${data.owner.isOnline ? '· <span class=\"text-emerald-600\">online</span>' : '· offline'}</div>
            </div>
          </div>
          \${data.owner.about ? '<p class="mt-3 text-sm text-slate-600 italic">“' + escapeHtml(data.owner.about) + '”</p>' : ''}
        </div>

        <div class="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div class="px-5 py-4 border-b border-slate-200">
            <h3 class="text-base font-semibold text-slate-900">Recent message log</h3>
            <p class="text-xs text-slate-500">Last 50 attempts through this key</p>
          </div>
          <div class="overflow-x-auto scrollbar-thin">
            <table class="min-w-full text-sm">
              <thead class="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                <tr>
                  <th class="text-left px-5 py-3 font-medium">Time</th>
                  <th class="text-left px-5 py-3 font-medium">Type</th>
                  <th class="text-left px-5 py-3 font-medium">Status</th>
                  <th class="text-left px-5 py-3 font-medium">To phone</th>
                  <th class="text-left px-5 py-3 font-medium">Preview / Error</th>
                  <th class="text-right px-5 py-3 font-medium">Latency</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                \${data.recentMessages.length === 0 ? '<tr><td colspan="6" class="px-5 py-8 text-center text-sm text-slate-400">No messages yet.</td></tr>' :
                  data.recentMessages.map(m => \`<tr class="hover:bg-slate-50">
                    <td class="px-5 py-3 text-slate-600 whitespace-nowrap">\${fmtDate(m.createdAt)}</td>
                    <td class="px-5 py-3">\${pill(m.type, 'indigo')}</td>
                    <td class="px-5 py-3">\${pill(m.status, m.status === 'SUCCESS' ? 'emerald' : 'rose')}</td>
                    <td class="px-5 py-3 font-mono text-xs">\${escapeHtml(m.recipientPhone || '—')}</td>
                    <td class="px-5 py-3 text-slate-600 max-w-xs truncate">\${escapeHtml(m.contentPreview || m.errorReason || '—')}</td>
                    <td class="px-5 py-3 text-right text-slate-600">\${m.requestDurationMs ? m.requestDurationMs + 'ms' : '—'}</td>
                  </tr>\`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      \`;
    }

    load();
    setInterval(load, 15_000);
  </script>`;
  return renderLayout({ title: 'API Key Detail', active: 'detail', body, scripts });
}

// ─────────────────────────── Users list ───────────────────────────

export function renderUsersList(): string {
  const body = `
    <div class="space-y-4">
      <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <input id="search" type="text" placeholder="Search by name, phone or email…" class="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring focus:ring-indigo-100 outline-none" />
      </div>
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="overflow-x-auto scrollbar-thin">
          <table class="min-w-full text-sm">
            <thead class="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th class="text-left px-5 py-3 font-medium">User</th>
                <th class="text-left px-5 py-3 font-medium">Contact</th>
                <th class="text-right px-5 py-3 font-medium">Keys</th>
                <th class="text-right px-5 py-3 font-medium">Messages sent</th>
                <th class="text-left px-5 py-3 font-medium">Last seen</th>
                <th class="text-left px-5 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody id="users-tbody" class="divide-y divide-slate-100"></tbody>
          </table>
        </div>
        <div id="pager" class="border-t border-slate-200 px-5 py-3 flex items-center justify-between text-sm text-slate-600"></div>
      </div>
    </div>
  `;

  const scripts = `<script>
    let page = 1, pageSize = 25, debounceTimer;
    const tbody = document.getElementById('users-tbody');
    const pager = document.getElementById('pager');
    const search = document.getElementById('search');

    async function load() {
      tbody.innerHTML = '<tr><td colspan="6" class="px-5 py-6 text-center text-sm text-slate-400">Loading…</td></tr>';
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), search: search.value || '' });
      const data = await adminFetch('/admin-panel/api/users?' + params.toString());
      if (data.items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-5 py-8 text-center text-sm text-slate-400">No matching key owners.</td></tr>';
      } else {
        tbody.innerHTML = data.items.map(u => \`<tr class="hover:bg-slate-50">
          <td class="px-5 py-3">
            <a href="/admin-panel/users/\${encodeURIComponent(u.id)}" class="font-medium text-indigo-600 hover:underline">\${escapeHtml(u.name || '(no name)')}</a>
            <div class="text-xs text-slate-500 \${u.isOnline ? 'text-emerald-600' : ''}">\${u.isOnline ? '● online' : 'offline'}</div>
          </td>
          <td class="px-5 py-3">
            <div class="text-slate-700">\${escapeHtml((u.countryCode || '') + ' ' + (u.phone || ''))}</div>
            <div class="text-xs text-slate-500">\${escapeHtml(u.email || '')}</div>
          </td>
          <td class="px-5 py-3 text-right font-medium">\${fmtNumber(u.keyCount)}</td>
          <td class="px-5 py-3 text-right">
            <div class="font-semibold">\${fmtNumber(u.successCount + u.failedCount)}</div>
            <div class="text-xs text-slate-500">\${fmtNumber(u.successCount)} ok · \${fmtNumber(u.failedCount)} fail</div>
          </td>
          <td class="px-5 py-3 text-slate-600">\${fmtRelative(u.lastSeen)}</td>
          <td class="px-5 py-3 text-slate-600">\${fmtDate(u.createdAt)}</td>
        </tr>\`).join('');
      }
      pager.innerHTML = \`<div>Showing \${((data.page - 1) * data.pageSize) + 1}–\${Math.min(data.page * data.pageSize, data.total)} of \${fmtNumber(data.total)}</div>
        <div class="flex items-center gap-1">
          <button id="prev" class="px-3 py-1.5 rounded-md border border-slate-200 disabled:opacity-40" \${data.page <= 1 ? 'disabled' : ''}>Prev</button>
          <span class="px-2 text-xs">Page \${data.page} / \${data.totalPages}</span>
          <button id="next" class="px-3 py-1.5 rounded-md border border-slate-200 disabled:opacity-40" \${data.page >= data.totalPages ? 'disabled' : ''}>Next</button>
        </div>\`;
      const prevBtn = document.getElementById('prev');
      const nextBtn = document.getElementById('next');
      if (prevBtn) prevBtn.addEventListener('click', function() { page--; load(); });
      if (nextBtn) nextBtn.addEventListener('click', function() { page++; load(); });
    }

    search.addEventListener('input', function() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function() { page = 1; load(); }, 250);
    });

    load();
  </script>`;
  return renderLayout({ title: 'Key Owners', active: 'users', body, scripts });
}

// ─────────────────────────── User detail ───────────────────────────

export function renderUserDetail(id: string): string {
  const body = `<div id="user-content" class="space-y-6"><div class="text-sm text-slate-400">Loading…</div></div>`;
  const scripts = `<script>
    const USER_ID = ${safeJsonString(id)};
    const root = document.getElementById('user-content');

    function pill(text, color) {
      const c = { emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200', rose: 'bg-rose-50 text-rose-700 border-rose-200', slate: 'bg-slate-50 text-slate-700 border-slate-200', indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ' + (c[color] || c.slate) + '">' + escapeHtml(text) + '</span>';
    }
    function statBlock(label, value, sub) {
      return \`<div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <p class="text-xs uppercase tracking-wide text-slate-500 font-medium">\${escapeHtml(label)}</p>
        <p class="mt-2 text-2xl font-semibold text-slate-900">\${fmtNumber(value)}</p>
        \${sub ? '<p class="text-xs text-slate-500 mt-1">' + escapeHtml(sub) + '</p>' : ''}
      </div>\`;
    }

    async function load() {
      const u = await adminFetch('/admin-panel/api/users/' + encodeURIComponent(USER_ID));
      if (!u) { root.innerHTML = '<div class="text-rose-600">User not found.</div>'; return; }
      root.innerHTML = \`
        <div class="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div class="flex items-start justify-between gap-4 flex-wrap">
            <div class="flex items-center gap-4">
              <div class="h-14 w-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-semibold">\${escapeHtml((u.name || '?').slice(0,1).toUpperCase())}</div>
              <div>
                <h2 class="text-xl font-semibold text-slate-900">\${escapeHtml(u.name || '(no name)')}</h2>
                <div class="text-sm text-slate-500">\${escapeHtml((u.countryCode || '') + ' ' + (u.phone || ''))} \${u.email ? '· ' + escapeHtml(u.email) : ''}</div>
                <div class="text-xs text-slate-500 mt-1">Joined \${fmtDate(u.createdAt)} · \${u.isOnline ? pill('Online', 'emerald') : pill('Offline · last seen ' + fmtRelative(u.lastSeen), 'slate')}</div>
              </div>
            </div>
            <a href="/admin-panel/users" class="text-sm text-indigo-600 hover:underline">← Back to list</a>
          </div>
          \${u.about ? '<p class="mt-3 text-sm text-slate-600 italic">“' + escapeHtml(u.about) + '”</p>' : ''}
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          \${statBlock('Total messages', u.stats.total)}
          \${statBlock('Successful', u.stats.success)}
          \${statBlock('Failed', u.stats.failed)}
        </div>

        <div class="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div class="px-5 py-4 border-b border-slate-200">
            <h3 class="text-base font-semibold text-slate-900">API keys (\${u.publicApiKeys.length})</h3>
          </div>
          <div class="overflow-x-auto scrollbar-thin">
            <table class="min-w-full text-sm">
              <thead class="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                <tr>
                  <th class="text-left px-5 py-3 font-medium">Label</th>
                  <th class="text-left px-5 py-3 font-medium">Prefix</th>
                  <th class="text-left px-5 py-3 font-medium">Status</th>
                  <th class="text-right px-5 py-3 font-medium">Messages</th>
                  <th class="text-left px-5 py-3 font-medium">Last used</th>
                  <th class="text-left px-5 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                \${u.publicApiKeys.length === 0 ? '<tr><td colspan="6" class="px-5 py-8 text-center text-sm text-slate-400">No API keys.</td></tr>' :
                  u.publicApiKeys.map(k => \`<tr class="hover:bg-slate-50">
                    <td class="px-5 py-3"><a href="/admin-panel/api-keys/\${encodeURIComponent(k.id)}" class="font-medium text-indigo-600 hover:underline">\${escapeHtml(k.label)}</a></td>
                    <td class="px-5 py-3 font-mono text-xs">\${escapeHtml(k.keyPrefix)}…</td>
                    <td class="px-5 py-3">\${k.revokedAt ? pill('Revoked', 'rose') : pill('Active', 'emerald')}</td>
                    <td class="px-5 py-3 text-right font-medium">\${fmtNumber(k._count.messageLogs)}</td>
                    <td class="px-5 py-3 text-slate-600">\${fmtRelative(k.lastUsedAt)}</td>
                    <td class="px-5 py-3 text-slate-600">\${fmtDate(k.createdAt)}</td>
                  </tr>\`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      \`;
    }
    load();
  </script>`;
  return renderLayout({ title: 'User Detail', active: 'users', body, scripts });
}

// ─────────────────────────── Messages log ───────────────────────────

export function renderMessagesLog(): string {
  const body = `
    <div class="space-y-4">
      <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div class="flex flex-wrap items-center gap-3">
          <select id="status" class="rounded-md border border-slate-200 px-3 py-2 text-sm">
            <option value="all">All statuses</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILED">Failed</option>
          </select>
          <select id="type" class="rounded-md border border-slate-200 px-3 py-2 text-sm">
            <option value="all">All types</option>
            <option value="TEXT">Text</option>
            <option value="VOICE">Voice</option>
          </select>
          <input id="from" type="datetime-local" class="rounded-md border border-slate-200 px-3 py-2 text-sm" />
          <input id="to" type="datetime-local" class="rounded-md border border-slate-200 px-3 py-2 text-sm" />
          <input id="apiKey" type="text" placeholder="Filter by api key id" class="rounded-md border border-slate-200 px-3 py-2 text-sm" />
        </div>
      </div>
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="overflow-x-auto scrollbar-thin">
          <table class="min-w-full text-sm">
            <thead class="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th class="text-left px-5 py-3 font-medium">Time</th>
                <th class="text-left px-5 py-3 font-medium">Key / Owner</th>
                <th class="text-left px-5 py-3 font-medium">Type</th>
                <th class="text-left px-5 py-3 font-medium">Status</th>
                <th class="text-left px-5 py-3 font-medium">Recipient</th>
                <th class="text-left px-5 py-3 font-medium">Preview / Error</th>
                <th class="text-right px-5 py-3 font-medium">Latency</th>
              </tr>
            </thead>
            <tbody id="msgs-tbody" class="divide-y divide-slate-100"></tbody>
          </table>
        </div>
        <div id="pager" class="border-t border-slate-200 px-5 py-3 flex items-center justify-between text-sm text-slate-600"></div>
      </div>
    </div>
  `;
  const scripts = `<script>
    let page = 1, pageSize = 50;
    const tbody = document.getElementById('msgs-tbody');
    const pager = document.getElementById('pager');
    const status = document.getElementById('status');
    const type = document.getElementById('type');
    const fromEl = document.getElementById('from');
    const toEl = document.getElementById('to');
    const apiKey = document.getElementById('apiKey');

    function pill(text, color) {
      const c = { emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200', rose: 'bg-rose-50 text-rose-700 border-rose-200', slate: 'bg-slate-50 text-slate-700 border-slate-200', indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ' + (c[color] || c.slate) + '">' + escapeHtml(text) + '</span>';
    }

    async function load() {
      tbody.innerHTML = '<tr><td colspan="7" class="px-5 py-6 text-center text-sm text-slate-400">Loading…</td></tr>';
      const params = new URLSearchParams({
        page: String(page), pageSize: String(pageSize),
        status: status.value, type: type.value,
      });
      if (fromEl.value) params.set('from', new Date(fromEl.value).toISOString());
      if (toEl.value) params.set('to', new Date(toEl.value).toISOString());
      if (apiKey.value) params.set('apiKeyId', apiKey.value);
      const data = await adminFetch('/admin-panel/api/messages?' + params.toString());
      if (data.items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="px-5 py-8 text-center text-sm text-slate-400">No messages match the filters.</td></tr>';
      } else {
        tbody.innerHTML = data.items.map(m => \`<tr class="hover:bg-slate-50">
          <td class="px-5 py-3 text-slate-600 whitespace-nowrap">\${fmtDate(m.createdAt)}</td>
          <td class="px-5 py-3">
            <a href="/admin-panel/api-keys/\${encodeURIComponent(m.apiKey.id)}" class="font-medium text-indigo-600 hover:underline">\${escapeHtml(m.apiKey.label)}</a>
            <div class="text-xs text-slate-500"><a class="hover:underline" href="/admin-panel/users/\${encodeURIComponent(m.apiKey.owner.id)}">\${escapeHtml(m.apiKey.owner.name || '(no name)')}</a></div>
          </td>
          <td class="px-5 py-3">\${pill(m.type, 'indigo')}</td>
          <td class="px-5 py-3">\${pill(m.status, m.status === 'SUCCESS' ? 'emerald' : 'rose')}</td>
          <td class="px-5 py-3 font-mono text-xs">\${escapeHtml(m.recipientPhone || '—')}</td>
          <td class="px-5 py-3 text-slate-600 max-w-md truncate">\${escapeHtml(m.contentPreview || m.errorReason || '—')}</td>
          <td class="px-5 py-3 text-right text-slate-600">\${m.requestDurationMs ? m.requestDurationMs + 'ms' : '—'}</td>
        </tr>\`).join('');
      }
      pager.innerHTML = \`<div>Showing \${((data.page - 1) * data.pageSize) + 1}–\${Math.min(data.page * data.pageSize, data.total)} of \${fmtNumber(data.total)}</div>
        <div class="flex items-center gap-1">
          <button id="prev" class="px-3 py-1.5 rounded-md border border-slate-200 disabled:opacity-40" \${data.page <= 1 ? 'disabled' : ''}>Prev</button>
          <span class="px-2 text-xs">Page \${data.page} / \${data.totalPages}</span>
          <button id="next" class="px-3 py-1.5 rounded-md border border-slate-200 disabled:opacity-40" \${data.page >= data.totalPages ? 'disabled' : ''}>Next</button>
        </div>\`;
      const p = document.getElementById('prev'); if (p) p.addEventListener('click', function() { page--; load(); });
      const n = document.getElementById('next'); if (n) n.addEventListener('click', function() { page++; load(); });
    }

    [status, type, fromEl, toEl, apiKey].forEach(el =>
      el.addEventListener('change', function() { page = 1; load(); }));
    apiKey.addEventListener('input', function() { /* allow typing without flooding */ });

    load();
  </script>`;
  return renderLayout({ title: 'Messages Log', active: 'messages', body, scripts });
}

// ─────────────────────────── Login audit ───────────────────────────

export function renderAuditPage(): string {
  const body = `
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div class="px-5 py-4 border-b border-slate-200">
        <h2 class="text-base font-semibold text-slate-900">Admin login audit</h2>
        <p class="text-xs text-slate-500">Last 200 attempts (success and failure)</p>
      </div>
      <div class="overflow-x-auto scrollbar-thin">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
            <tr>
              <th class="text-left px-5 py-3 font-medium">Time</th>
              <th class="text-left px-5 py-3 font-medium">Username</th>
              <th class="text-left px-5 py-3 font-medium">Result</th>
              <th class="text-left px-5 py-3 font-medium">Reason</th>
              <th class="text-left px-5 py-3 font-medium">IP</th>
              <th class="text-left px-5 py-3 font-medium">User agent</th>
            </tr>
          </thead>
          <tbody id="audit-tbody" class="divide-y divide-slate-100"></tbody>
        </table>
      </div>
    </div>
  `;
  const scripts = `<script>
    function pill(text, color) {
      const c = { emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200', rose: 'bg-rose-50 text-rose-700 border-rose-200', slate: 'bg-slate-50 text-slate-700 border-slate-200' };
      return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ' + (c[color] || c.slate) + '">' + escapeHtml(text) + '</span>';
    }
    async function load() {
      const items = await adminFetch('/admin-panel/api/audit?limit=200');
      const tbody = document.getElementById('audit-tbody');
      if (!items.length) { tbody.innerHTML = '<tr><td colspan="6" class="px-5 py-8 text-center text-sm text-slate-400">No login attempts yet.</td></tr>'; return; }
      tbody.innerHTML = items.map(e => \`<tr class="hover:bg-slate-50">
        <td class="px-5 py-3 text-slate-600 whitespace-nowrap">\${fmtDate(e.createdAt)}</td>
        <td class="px-5 py-3 font-mono text-xs">\${escapeHtml(e.username)}</td>
        <td class="px-5 py-3">\${e.success ? pill('Success', 'emerald') : pill('Failed', 'rose')}</td>
        <td class="px-5 py-3 text-slate-600">\${escapeHtml(e.reason || '—')}</td>
        <td class="px-5 py-3 font-mono text-xs">\${escapeHtml(e.ipAddress || '—')}</td>
        <td class="px-5 py-3 text-xs text-slate-500 max-w-md truncate">\${escapeHtml(e.userAgent || '')}</td>
      </tr>\`).join('');
    }
    load();
    setInterval(load, 30_000);
  </script>`;
  return renderLayout({ title: 'Login Audit', active: 'audit', body, scripts });
}

// ─────────────────────────── Issue API key (3-step workflow) ───────────────────────────

export function renderIssueKeyPage(): string {
  const body = `
    <div class="space-y-6 max-w-4xl">
      <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div class="flex items-start gap-3">
          <span class="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 text-sm font-semibold">i</span>
          <div class="text-sm text-slate-600">
            <p class="font-medium text-slate-800">How this works</p>
            <p class="mt-1">As superadmin you can issue an API key on a user's behalf without going through OTP. Step 1 returns an access token (15 min). Steps 2 &amp; 3 reuse that token to call the same <code class="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">/api/public-api-keys</code> endpoints the user themselves would call.</p>
          </div>
        </div>
      </div>

      <!-- ───────────── Step 1 ───────────── -->
      <section class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-200 flex items-center gap-3">
          <span class="h-7 w-7 rounded-full bg-indigo-600 text-white text-xs font-semibold flex items-center justify-center">1</span>
          <h2 class="text-base font-semibold text-slate-900">Identify the user &amp; issue access token</h2>
        </div>
        <div class="p-5">
          <form id="step1-form" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="sm:col-span-1">
              <label class="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input id="s1-name" required type="text" placeholder="Ali Imran" class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring focus:ring-indigo-100 outline-none" />
            </div>
            <div class="sm:col-span-1">
              <label class="block text-sm font-medium text-slate-700 mb-1">Phone number</label>
              <input id="s1-phone" required type="text" placeholder="+92 300 1234567" class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring focus:ring-indigo-100 outline-none" />
            </div>
            <div class="sm:col-span-2 flex items-center gap-3">
              <button id="s1-submit" type="submit" class="rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed">Verify &amp; issue access token</button>
              <span id="s1-status" class="text-sm text-slate-500"></span>
            </div>
          </form>

          <div id="s1-result" class="hidden mt-5 border border-emerald-200 bg-emerald-50 rounded-lg p-4">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p class="text-xs uppercase tracking-wide text-emerald-700 font-semibold">User found</p>
                <p id="s1-user" class="text-sm font-medium text-slate-900 mt-1"></p>
                <p id="s1-userMeta" class="text-xs text-slate-600"></p>
              </div>
              <span id="s1-expiry" class="text-xs text-slate-600"></span>
            </div>
            <label class="block mt-4 text-xs font-medium text-slate-600">Access token</label>
            <textarea id="s1-token" readonly rows="3" class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-mono break-all focus:outline-none"></textarea>
            <button type="button" data-copy-target="s1-token" class="copy-btn mt-2 inline-flex items-center gap-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 text-xs font-medium transition">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
              <span class="copy-label">Copy token</span>
            </button>
          </div>
        </div>
      </section>

      <!-- ───────────── Step 2 ───────────── -->
      <section class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-200 flex items-center gap-3">
          <span class="h-7 w-7 rounded-full bg-indigo-600 text-white text-xs font-semibold flex items-center justify-center">2</span>
          <h2 class="text-base font-semibold text-slate-900">Create the API key</h2>
        </div>
        <div class="p-5">
          <form id="step2-form" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Access token (paste from step 1)</label>
              <textarea id="s2-token" required rows="2" placeholder="eyJhbGciOi…" class="w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-mono focus:border-indigo-500 focus:ring focus:ring-indigo-100 outline-none"></textarea>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div class="sm:col-span-3">
                <label class="block text-sm font-medium text-slate-700 mb-1">Label</label>
                <input id="s2-label" type="text" placeholder="Support bot" class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring focus:ring-indigo-100 outline-none" />
              </div>
              <label class="inline-flex items-center gap-2 text-sm text-slate-700">
                <input id="s2-canText" type="checkbox" checked class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-200" />
                Can send text
              </label>
              <label class="inline-flex items-center gap-2 text-sm text-slate-700">
                <input id="s2-canVoice" type="checkbox" checked class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-200" />
                Can send voice
              </label>
            </div>
            <div class="flex items-center gap-3">
              <button type="submit" id="s2-submit" class="rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed">Create API key</button>
              <span id="s2-status" class="text-sm text-slate-500"></span>
            </div>
          </form>

          <div id="s2-result" class="hidden mt-5 border border-amber-200 bg-amber-50 rounded-lg p-4">
            <p class="text-xs uppercase tracking-wide text-amber-700 font-semibold">Key created — shown only once</p>
            <p id="s2-forUser" class="text-xs text-slate-700 mt-1"></p>
            <label class="block mt-3 text-xs font-medium text-slate-600">Raw key (give this to the user, then they store it)</label>
            <textarea id="s2-rawKey" readonly rows="2" class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-mono break-all"></textarea>
            <div class="mt-2 flex flex-wrap gap-2 items-center text-xs text-slate-700">
              <button type="button" data-copy-target="s2-rawKey" class="copy-btn inline-flex items-center gap-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 font-medium transition">
                <span class="copy-label">Copy key</span>
              </button>
              <span>Prefix: <code id="s2-prefix" class="font-mono"></code></span>
              <span>Key id: <code id="s2-id" class="font-mono"></code></span>
            </div>
          </div>
        </div>
      </section>

      <!-- ───────────── Step 3 ───────────── -->
      <section class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-200 flex items-center gap-3">
          <span class="h-7 w-7 rounded-full bg-indigo-600 text-white text-xs font-semibold flex items-center justify-center">3</span>
          <h2 class="text-base font-semibold text-slate-900">List the user's keys</h2>
        </div>
        <div class="p-5">
          <form id="step3-form" class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Access token</label>
              <textarea id="s3-token" required rows="2" placeholder="eyJhbGciOi…" class="w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-mono focus:border-indigo-500 focus:ring focus:ring-indigo-100 outline-none"></textarea>
            </div>
            <div class="flex items-center gap-3">
              <button type="submit" id="s3-submit" class="rounded-md bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed">List keys</button>
              <span id="s3-status" class="text-sm text-slate-500"></span>
            </div>
          </form>

          <div id="s3-result" class="hidden mt-5">
            <p id="s3-summary" class="text-sm text-slate-700 mb-3"></p>
            <div class="overflow-x-auto scrollbar-thin border border-slate-200 rounded-lg">
              <table class="min-w-full text-sm">
                <thead class="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                  <tr>
                    <th class="text-left px-4 py-2 font-medium">Label</th>
                    <th class="text-left px-4 py-2 font-medium">Prefix</th>
                    <th class="text-left px-4 py-2 font-medium">Permissions</th>
                    <th class="text-left px-4 py-2 font-medium">Status</th>
                    <th class="text-left px-4 py-2 font-medium">Last used</th>
                    <th class="text-left px-4 py-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody id="s3-tbody" class="divide-y divide-slate-100"></tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  `;

  const scripts = `<script>
    function pill(text, color) {
      const c = { emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200', rose: 'bg-rose-50 text-rose-700 border-rose-200', slate: 'bg-slate-50 text-slate-700 border-slate-200', indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200', amber: 'bg-amber-50 text-amber-700 border-amber-200' };
      return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ' + (c[color] || c.slate) + '">' + escapeHtml(text) + '</span>';
    }

    async function postJson(path, body) {
      const res = await fetch(path, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        window.location.href = '/admin-panel?adminError=session_expired';
        throw new Error('unauthorized');
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || ('Request failed: ' + res.status));
      }
      return data;
    }

    function setStatus(el, text, kind) {
      el.textContent = text || '';
      el.className = 'text-sm ' + (kind === 'error' ? 'text-rose-600' : kind === 'ok' ? 'text-emerald-600' : 'text-slate-500');
    }

    // Copy button delegation — works for any element with data-copy-target.
    document.addEventListener('click', async function(e) {
      const btn = e.target.closest('.copy-btn');
      if (!btn) return;
      const targetId = btn.getAttribute('data-copy-target');
      const el = document.getElementById(targetId);
      if (!el) return;
      try {
        await navigator.clipboard.writeText(el.value || el.textContent || '');
        const label = btn.querySelector('.copy-label');
        if (label) {
          const original = label.textContent;
          label.textContent = 'Copied!';
          setTimeout(function() { label.textContent = original; }, 1400);
        }
      } catch (err) {
        // Fallback: select text so the admin can Ctrl+C
        if (el.select) el.select();
      }
    });

    // ───── Step 1 ─────
    const s1Form = document.getElementById('step1-form');
    const s1Submit = document.getElementById('s1-submit');
    const s1Status = document.getElementById('s1-status');
    const s1Result = document.getElementById('s1-result');
    const s1User = document.getElementById('s1-user');
    const s1UserMeta = document.getElementById('s1-userMeta');
    const s1Token = document.getElementById('s1-token');
    const s1Expiry = document.getElementById('s1-expiry');

    s1Form.addEventListener('submit', async function(e) {
      e.preventDefault();
      s1Submit.disabled = true;
      setStatus(s1Status, 'Verifying user…', '');
      s1Result.classList.add('hidden');
      try {
        const data = await postJson('/admin-panel/api/impersonate/issue-token', {
          name: document.getElementById('s1-name').value.trim(),
          phone: document.getElementById('s1-phone').value.trim(),
        });
        s1Token.value = data.accessToken;
        s1User.textContent = data.user.name;
        s1UserMeta.textContent = (data.user.countryCode || '') + ' ' + (data.user.phone || '') + (data.user.email ? ' · ' + data.user.email : '');
        s1Expiry.textContent = 'Valid for ' + (data.expiresIn || '15m');
        s1Result.classList.remove('hidden');
        setStatus(s1Status, 'Token issued', 'ok');
      } catch (err) {
        setStatus(s1Status, err.message || 'Failed', 'error');
      } finally {
        s1Submit.disabled = false;
      }
    });

    // ───── Step 2 ─────
    const s2Form = document.getElementById('step2-form');
    const s2Submit = document.getElementById('s2-submit');
    const s2Status = document.getElementById('s2-status');
    const s2Result = document.getElementById('s2-result');

    s2Form.addEventListener('submit', async function(e) {
      e.preventDefault();
      s2Submit.disabled = true;
      setStatus(s2Status, 'Creating key…', '');
      s2Result.classList.add('hidden');
      try {
        const data = await postJson('/admin-panel/api/impersonate/create-key', {
          accessToken: document.getElementById('s2-token').value.trim(),
          label: document.getElementById('s2-label').value.trim() || undefined,
          canSendText: document.getElementById('s2-canText').checked,
          canSendVoice: document.getElementById('s2-canVoice').checked,
        });
        document.getElementById('s2-rawKey').value = data.key;
        document.getElementById('s2-prefix').textContent = data.keyPrefix + '…';
        document.getElementById('s2-id').textContent = data.id;
        document.getElementById('s2-forUser').textContent = 'For user: ' + (data.forUser?.name || '') + ' (' + (data.forUser?.phone || '') + ')';
        s2Result.classList.remove('hidden');
        setStatus(s2Status, 'Key created', 'ok');
      } catch (err) {
        setStatus(s2Status, err.message || 'Failed', 'error');
      } finally {
        s2Submit.disabled = false;
      }
    });

    // ───── Step 3 ─────
    const s3Form = document.getElementById('step3-form');
    const s3Submit = document.getElementById('s3-submit');
    const s3Status = document.getElementById('s3-status');
    const s3Result = document.getElementById('s3-result');
    const s3Summary = document.getElementById('s3-summary');
    const s3Tbody = document.getElementById('s3-tbody');

    s3Form.addEventListener('submit', async function(e) {
      e.preventDefault();
      s3Submit.disabled = true;
      setStatus(s3Status, 'Fetching keys…', '');
      s3Result.classList.add('hidden');
      try {
        const data = await postJson('/admin-panel/api/impersonate/list-keys', {
          accessToken: document.getElementById('s3-token').value.trim(),
        });
        s3Summary.innerHTML = 'Listed <strong>' + data.total + '</strong> key(s) for <strong>' + escapeHtml(data.forUser.name) + '</strong> (' + escapeHtml(data.forUser.phone || '') + ')';
        if (data.total === 0) {
          s3Tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-center text-sm text-slate-400">User has no API keys yet.</td></tr>';
        } else {
          s3Tbody.innerHTML = data.items.map(function(k) {
            var status = k.revokedAt ? pill('Revoked', 'rose') : pill('Active', 'emerald');
            var perms = (k.canSendText ? pill('Text', 'indigo') : '') + ' ' + (k.canSendVoice ? pill('Voice', 'amber') : '');
            return '<tr class="hover:bg-slate-50">' +
              '<td class="px-4 py-2">' + escapeHtml(k.label) + '</td>' +
              '<td class="px-4 py-2 font-mono text-xs">' + escapeHtml(k.keyPrefix) + '…</td>' +
              '<td class="px-4 py-2">' + perms + '</td>' +
              '<td class="px-4 py-2">' + status + '</td>' +
              '<td class="px-4 py-2 text-slate-600">' + fmtRelative(k.lastUsedAt) + '</td>' +
              '<td class="px-4 py-2 text-slate-600">' + fmtDate(k.createdAt) + '</td>' +
            '</tr>';
          }).join('');
        }
        s3Result.classList.remove('hidden');
        setStatus(s3Status, 'API key is listed now', 'ok');
      } catch (err) {
        setStatus(s3Status, err.message || 'Failed', 'error');
      } finally {
        s3Submit.disabled = false;
      }
    });
  </script>`;

  return renderLayout({ title: 'Issue API Key', active: 'issue-key', body, scripts });
}

// ─────────────────────────── Revoke API key ───────────────────────────

export function renderRevokeKeyPage(): string {
  const body = `
    <div class="space-y-6 max-w-4xl">
      <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div class="flex items-start gap-3">
          <span class="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600 text-sm font-semibold">!</span>
          <div class="text-sm text-slate-600">
            <p class="font-medium text-slate-800">Revoking is immediate</p>
            <p class="mt-1">Once revoked, the public messaging API will start returning <code class="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">403 API key has been revoked</code> on every send. There is no un-revoke — the user has to mint a new key.</p>
          </div>
        </div>
      </div>

      <section class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-200">
          <h2 class="text-base font-semibold text-slate-900">Lookup user's keys by access token</h2>
          <p class="text-xs text-slate-500 mt-0.5">Paste the access token issued in step 1 of the Issue page (or any valid user JWT).</p>
        </div>
        <div class="p-5">
          <form id="rev-form" class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Access token</label>
              <textarea id="rev-token" required rows="2" placeholder="eyJhbGciOi…" class="w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-mono focus:border-indigo-500 focus:ring focus:ring-indigo-100 outline-none"></textarea>
            </div>
            <div class="flex items-center gap-3">
              <button type="submit" id="rev-lookup" class="rounded-md bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed">Lookup keys</button>
              <span id="rev-status" class="text-sm text-slate-500"></span>
            </div>
          </form>

          <div id="rev-result" class="hidden mt-5">
            <div class="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <p id="rev-summary" class="text-sm text-slate-700"></p>
              <button id="rev-all" type="button" class="hidden rounded-md bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 text-xs font-semibold transition">Revoke ALL active keys</button>
            </div>
            <div class="overflow-x-auto scrollbar-thin border border-slate-200 rounded-lg">
              <table class="min-w-full text-sm">
                <thead class="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
                  <tr>
                    <th class="text-left px-4 py-2 font-medium">Label</th>
                    <th class="text-left px-4 py-2 font-medium">Prefix</th>
                    <th class="text-left px-4 py-2 font-medium">Status</th>
                    <th class="text-left px-4 py-2 font-medium">Last used</th>
                    <th class="text-left px-4 py-2 font-medium">Created</th>
                    <th class="text-right px-4 py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody id="rev-tbody" class="divide-y divide-slate-100"></tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  `;

  const scripts = `<script>
    function pill(text, color) {
      const c = { emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200', rose: 'bg-rose-50 text-rose-700 border-rose-200', slate: 'bg-slate-50 text-slate-700 border-slate-200' };
      return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ' + (c[color] || c.slate) + '">' + escapeHtml(text) + '</span>';
    }
    async function postJson(path, body) {
      const res = await fetch(path, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 401) { window.location.href = '/admin-panel?adminError=session_expired'; throw new Error('unauthorized'); }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || ('Request failed: ' + res.status));
      return data;
    }
    function setStatus(text, kind) {
      const el = document.getElementById('rev-status');
      el.textContent = text || '';
      el.className = 'text-sm ' + (kind === 'error' ? 'text-rose-600' : kind === 'ok' ? 'text-emerald-600' : 'text-slate-500');
    }

    let currentKeys = [];

    function render() {
      const tbody = document.getElementById('rev-tbody');
      const all = document.getElementById('rev-all');
      const activeCount = currentKeys.filter(function(k){ return !k.revokedAt; }).length;
      all.classList.toggle('hidden', activeCount === 0);
      if (currentKeys.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-6 text-center text-sm text-slate-400">User has no API keys.</td></tr>';
        return;
      }
      tbody.innerHTML = currentKeys.map(function(k) {
        var status = k.revokedAt ? pill('Revoked', 'rose') : pill('Active', 'emerald');
        var btn = k.revokedAt
          ? '<span class="text-xs text-slate-400">already revoked</span>'
          : '<button data-key-id="' + escapeHtml(k.id) + '" class="rev-one rounded-md bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 text-xs font-medium transition">Revoke</button>';
        return '<tr class="hover:bg-slate-50">' +
          '<td class="px-4 py-2">' + escapeHtml(k.label) + '</td>' +
          '<td class="px-4 py-2 font-mono text-xs">' + escapeHtml(k.keyPrefix) + '…</td>' +
          '<td class="px-4 py-2">' + status + '</td>' +
          '<td class="px-4 py-2 text-slate-600">' + fmtRelative(k.lastUsedAt) + '</td>' +
          '<td class="px-4 py-2 text-slate-600">' + fmtDate(k.createdAt) + '</td>' +
          '<td class="px-4 py-2 text-right">' + btn + '</td>' +
        '</tr>';
      }).join('');
    }

    async function lookup() {
      const token = document.getElementById('rev-token').value.trim();
      if (!token) return;
      setStatus('Fetching keys…', '');
      try {
        const data = await postJson('/admin-panel/api/impersonate/list-keys', { accessToken: token });
        currentKeys = data.items || [];
        document.getElementById('rev-summary').innerHTML = 'Showing <strong>' + data.total + '</strong> key(s) for <strong>' + escapeHtml(data.forUser.name) + '</strong> (' + escapeHtml(data.forUser.phone || '') + ')';
        document.getElementById('rev-result').classList.remove('hidden');
        render();
        setStatus('', 'ok');
      } catch (err) {
        setStatus(err.message || 'Failed', 'error');
      }
    }

    document.getElementById('rev-form').addEventListener('submit', function(e) {
      e.preventDefault();
      lookup();
    });

    // Per-key revoke (event delegation).
    document.getElementById('rev-tbody').addEventListener('click', async function(e) {
      const btn = e.target.closest('.rev-one');
      if (!btn) return;
      const keyId = btn.getAttribute('data-key-id');
      const target = currentKeys.find(function(k){ return k.id === keyId; });
      if (!target) return;
      const ok = window.confirm('Revoke key "' + (target.label || keyId) + '" (' + (target.keyPrefix || '') + '…)? This stops all messages from this key immediately.');
      if (!ok) return;
      btn.disabled = true;
      btn.textContent = 'Revoking…';
      try {
        const token = document.getElementById('rev-token').value.trim();
        await postJson('/admin-panel/api/impersonate/revoke-key', { accessToken: token, keyId: keyId });
        target.revokedAt = new Date().toISOString();
        render();
        setStatus('Key revoked', 'ok');
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Revoke';
        setStatus(err.message || 'Failed to revoke', 'error');
      }
    });

    // Revoke ALL active keys.
    document.getElementById('rev-all').addEventListener('click', async function() {
      const active = currentKeys.filter(function(k){ return !k.revokedAt; });
      if (active.length === 0) return;
      const ok = window.confirm('Revoke ALL ' + active.length + ' active key(s) for this user? This stops all messages from them immediately.');
      if (!ok) return;
      setStatus('Revoking ' + active.length + ' key(s)…', '');
      const token = document.getElementById('rev-token').value.trim();
      let failed = 0;
      for (const k of active) {
        try {
          await postJson('/admin-panel/api/impersonate/revoke-key', { accessToken: token, keyId: k.id });
          k.revokedAt = new Date().toISOString();
        } catch (err) {
          failed++;
        }
      }
      render();
      setStatus(failed === 0 ? 'All active keys revoked' : (failed + ' of ' + active.length + ' failed'), failed === 0 ? 'ok' : 'error');
    });
  </script>`;

  return renderLayout({ title: 'Revoke API Key', active: 'revoke-key', body, scripts });
}
