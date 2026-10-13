// main.js — Reino de Colombia (DiplomaticaMC)
// Live roster + stats with fallbacks, directory search/filter, map chips, grant form.
// Requires roster-core.js (window.RosterCore). No framework, no build step.
'use strict';

(function () {
  // ------------------------------------------------------------------
  // CONFIG — edit these to retarget the page without touching logic.
  // ------------------------------------------------------------------
  const CONFIG = {
    nation: 'Colombia',                     // %nation% value on the Dynmap markers
    mapBase: 'https://map.diplomaticamc.com',
    world: 'minecraft_overworld',           // used in /tiles/{world}/markers.json
    rosterUrl: 'roster.json',               // last known good snapshot served from this site
    webhookUrl: 'https://discord.com/api/webhooks/REPLACE_WITH_YOUR_WEBHOOK_TOKEN',
    serverIp: 'diplomaticamc.com',
    capitalCoords: { x: -17560, z: -2824 }, // Maicao
    cacheKey: 'colombia-roster-cache-v1',   // localStorage key for the last good live pull
    maxCacheAgeMs: 1000 * 60 * 60 * 24 * 7  // ignore caches older than a week
  };

  // Baked-in fallback so the page NEVER shows zeros or an endless loader,
  // even fully offline. Regenerated alongside roster.json by the sync script.
  const FALLBACK_TOWNS = [{"name": "Aldama", "region": "Colombia & South", "residents": [{"username": "Crowlia"}]}, {"name": "Bismuna Tara", "region": "Colombia & South", "residents": [{"username": "Bosi45"}]}, {"name": "Cabada Vera", "region": "Colombia & South", "residents": [{"username": "Fishy_Fosh43"}]}, {"name": "Cali", "region": "Colombia & South", "residents": [{"username": "LukasKung"}]}, {"name": "Canollia", "region": "Colombia & South", "residents": [{"username": "Respawn34"}, {"username": "Xmantatwin"}]}, {"name": "Caracas", "region": "Caribbean Coast", "residents": [{"username": "INeedBagels"}]}, {"name": "Cordoba", "region": "Colombia & South", "residents": [{"username": "zattercal"}]}, {"name": "Dominican Republic", "region": "Caribbean Coast", "residents": [{"username": "Amismash82"}]}, {"name": "El Estrella", "region": "Colombia & South", "residents": [{"username": "jakke_mugen"}, {"username": "xnd"}]}, {"name": "El Salvador", "region": "Central America", "residents": [{"username": "ThyCoolio"}]}, {"name": "Esteli", "region": "Central America", "residents": [{"username": "IcyStraw9509602"}]}, {"name": "George Town", "region": "Caribbean Coast", "residents": [{"username": "Carstendb"}, {"username": "Gregordb"}, {"username": "OFVDEB"}]}, {"name": "Goiania", "region": "Colombia & South", "residents": [{"username": "NewSweetTea"}, {"username": "GiorgioJGZ"}]}, {"name": "Golopigi", "region": "Caribbean Coast", "residents": [{"username": "ProdigyMster100"}]}, {"name": "Guatape", "region": "Colombia & South", "residents": [{"username": "Pokeframe"}]}, {"name": "Guatemala", "region": "Central America", "residents": [{"username": "StormChaser234"}, {"username": "JustinReality"}, {"username": "LDude2345"}]}, {"name": "Intuto", "region": "Central America", "residents": [{"username": "catboyHoratio"}]}, {"name": "Iza", "region": "Colombia & South", "residents": [{"username": "OliveTree316"}, {"username": "VickyVenus9416"}]}, {"name": "Jardin", "region": "Colombia & South", "residents": [{"username": "Mrspancake4343"}]}, {"name": "Maicao", "region": "Caribbean Coast", "residents": [{"username": "9_88"}, {"username": "_PinkLuna_"}, {"username": "sarcasticbox"}, {"username": "sapinzinho"}, {"username": "Addychi01"}, {"username": "Scarioh"}, {"username": "FutureLemon"}, {"username": "TheKrieger6774"}, {"username": "hecolator27"}, {"username": "AudioCrescent83"}, {"username": "pato541"}, {"username": "Aquilla_AQ"}]}, {"name": "Managua", "region": "Central America", "residents": [{"username": "BoscGIaa"}]}, {"name": "Medellin Antioquia", "region": "Colombia & South", "residents": [{"username": "birdyboa"}, {"username": "c0rrupt_Jelly"}]}, {"name": "Mexico City", "region": "Central America", "residents": [{"username": "Cryolyte"}]}, {"name": "New Bahamas", "region": "Caribbean Coast", "residents": [{"username": "AnythingIsFinee"}]}, {"name": "Panama", "region": "Central America", "residents": [{"username": "__Jyro__"}]}, {"name": "Paramaribo", "region": "Colombia & South", "residents": [{"username": "OnlyADonut"}, {"username": "Zericef"}]}, {"name": "Puerto Lempira", "region": "Caribbean Coast", "residents": [{"username": "pikagamer55"}]}, {"name": "Quito", "region": "Colombia & South", "residents": [{"username": "foxphor"}]}, {"name": "Santa Ana", "region": "Central America", "residents": [{"username": "Menacingsquid"}]}, {"name": "Santa Maria", "region": "Colombia & South", "residents": [{"username": "Novum_Vetus"}, {"username": "Qulipzz"}, {"username": "stonebigman"}, {"username": "Tim0thyPlayzz"}]}, {"name": "Santa Marta", "region": "Caribbean Coast", "residents": [{"username": "tigerm354"}]}, {"name": "Tegucigalpa", "region": "Central America", "residents": [{"username": "Zaity1"}, {"username": "ItsEnes"}, {"username": "Atrocizzare_"}, {"username": "FabioVortex"}, {"username": "Lunes2015"}, {"username": "talety"}]}, {"name": "Trinidad", "region": "Caribbean Coast", "residents": [{"username": "DianJ"}]}, {"name": "Zircon", "region": "Colombia & South", "residents": [{"username": "wewakm2"}]}];

  // Display override for "Mayor" tags in the directory (marker data only
  // exposes resident lists; roster-core already puts the mayor first,
  // this covers the featured towns we know the mayors of).
  const MAYOR_OVERRIDE = {
    'Maicao': '9_88',
    'Cordoba': 'zattercal',   // zattercal runs the Salento-style builds from Córdoba
    'Medellin Antioquia': 'birdyboa',
    'Guatape': 'Pokeframe',
    'New Bahamas': 'AnythingIsFinee',
    'Tegucigalpa': 'Zaity1'
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------
  let towns = [];            // [{ name, region, residents:[{username}], x?, z? }]
  let lastSyncedAt = null;   // ISO string of whatever data is on screen
  let stateSource = 'init';  // 'live' | 'cache' | 'snapshot' | 'fallback'

  const sourceLabel = {
    live: 'live from the map',
    cache: 'cached copy',
    snapshot: 'last synced snapshot',
    fallback: 'built-in snapshot'
  };

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------
  function relTime(iso) {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    if (isNaN(diff) || diff < 0) return '';
    const min = Math.round(diff / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return min + ' minute' + (min === 1 ? '' : 's') + ' ago';
    const hr = Math.round(min / 60);
    if (hr < 24) return hr + ' hour' + (hr === 1 ? '' : 's') + ' ago';
    const day = Math.round(hr / 24);
    return day + ' day' + (day === 1 ? '' : 's') + ' ago';
  }

  function readCache() {
    try {
      const raw = localStorage.getItem(CONFIG.cacheKey);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.towns) || !data.towns.length) return null;
      if (data.syncedAt && Date.now() - new Date(data.syncedAt).getTime() > CONFIG.maxCacheAgeMs) return null;
      return data;
    } catch (e) { return null; }
  }

  function writeCache(data) {
    try { localStorage.setItem(CONFIG.cacheKey, JSON.stringify(data)); } catch (e) { /* private mode */ }
  }

  // Animated count-up that respects reduced motion and never lands on 0 by accident.
  function setStat(node, value) {
    if (!node) return;
    const prev = parseInt(node.dataset.value || '0', 10) || 0;
    node.dataset.value = String(value);
    if (prefersReducedMotion || prev === value) { node.textContent = String(value); return; }
    const dur = 550, t0 = performance.now();
    (function tick(t) {
      const p = Math.min(1, (t - t0) / dur);
      node.textContent = String(Math.round(prev + (value - prev) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }

  // Region tagging for live pulls (marker data has no region field).
  function guessRegion(name) {
    const central = ['Tegucigalpa','Guatemala','El Salvador','Managua','Esteli','Panama','Intuto','Mexico City','Santa Ana','Puerto Lempira'];
    const caribbean = ['Maicao','Santa Marta','New Bahamas','George Town','Trinidad','Golopigi','Dominican Republic','Caracas'];
    if (central.includes(name)) return 'Central America';
    if (caribbean.includes(name)) return 'Caribbean Coast';
    return 'Colombia & South';
  }

  // ------------------------------------------------------------------
  // Rendering
  // ------------------------------------------------------------------
  function totals(list) {
    return {
      towns: list.length,
      citizens: list.reduce((n, t) => n + t.residents.length, 0),
      leaders: list.filter(t => t.residents.length).length
    };
  }

  function renderStats() {
    const t = totals(towns);
    setStat($('#statTowns'), t.towns);
    setStat($('#statCitizens'), t.citizens);
    setStat($('#statLeaders'), t.leaders);
    const stamp = $('#heroUpdated');
    if (stamp) {
      stamp.textContent = 'Updated ' + (relTime(lastSyncedAt) || 'recently') +
        ' · ' + (sourceLabel[stateSource] || 'last known data');
    }
  }

  function renderMapChips() {
    const box = $('#mapChips');
    if (!box) return;
    box.innerHTML = '';
    towns.forEach(t => {
      const b = el('button', 'chip', t.name);
      b.type = 'button';
      b.addEventListener('click', () => {
        $$('#mapChips .chip').forEach(c => c.classList.toggle('is-active', c === b));
        const frame = $('#dynmapFrame');
        if (frame) {
          frame.src = CONFIG.mapBase + '/?worldname=' + CONFIG.world +
            '&mapname=surface&zoom=5' +
            '&x=' + (Number.isFinite(t.x) ? t.x : CONFIG.capitalCoords.x) +
            '&z=' + (Number.isFinite(t.z) ? t.z : CONFIG.capitalCoords.z);
        }
      });
      box.appendChild(b);
    });
  }

  function renderDirectory() {
    const list = $('#dirList');
    if (!list) return;
    list.innerHTML = '';

    towns.forEach(t => {
      const row = el('article', 'dir-row');
      row.dataset.town = t.name.toLowerCase();
      row.dataset.search = (t.name + ' ' + t.residents.map(r => r.username).join(' ') + ' ' + (t.region || '')).toLowerCase();

      const head = el('button', 'dir-head');
      head.type = 'button';
      head.setAttribute('aria-expanded', 'false');

      const hName = el('span', 'dir-name', t.name);
      if (t.name === 'Maicao') hName.appendChild(el('span', 'dir-capital', 'Capital'));

      const hMeta = el('span', 'dir-count',
        t.residents.length + ' resident' + (t.residents.length === 1 ? '' : 's') +
        (t.region ? ' · ' + t.region : ''));

      head.append(hName, hMeta, el('span', 'dir-caret', '+'));

      const body = el('div', 'dir-body');
      body.hidden = true;
      const ul = el('ul', 'dir-residents');
      const mayorName = MAYOR_OVERRIDE[t.name] || (t.residents[0] && t.residents[0].username);
      t.residents.forEach(r => {
        const li = el('li', 'resident');
        const img = document.createElement('img');
        img.src = 'https://mc-heads.net/avatar/' + encodeURIComponent(r.username) + '/32';
        img.alt = ''; img.width = 32; img.height = 32; img.loading = 'lazy'; img.decoding = 'async';
        img.addEventListener('error', () => img.remove());
        const who = el('span', 'resident-name', r.username);
        if (r.username === mayorName) who.appendChild(el('span', 'resident-tag', 'Mayor'));
        li.append(img, who);
        ul.appendChild(li);
      });
      body.appendChild(ul);

      head.addEventListener('click', () => {
        const open = !body.hidden;
        body.hidden = open;
        head.setAttribute('aria-expanded', String(!open));
        head.classList.toggle('is-open', !open);
      });

      row.append(head, body);
      list.appendChild(row);
    });

    applyFilter();
  }

  function fillRegionSelect() {
    const sel = $('#dirRegion');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '';
    sel.appendChild(el('option', null, 'All regions'));
    const seen = new Set();
    towns.forEach(t => {
      if (t.region && !seen.has(t.region)) {
        seen.add(t.region);
        const o = el('option', null, t.region);
        o.value = t.region;
        sel.appendChild(o);
      }
    });
    sel.value = current;
  }

  function applyFilter() {
    const q = ($('#dirSearch')?.value || '').trim().toLowerCase();
    const region = $('#dirRegion')?.value || '';
    const terms = q.split(/\s+/).filter(Boolean);
    let visible = 0;

    $$('#dirList .dir-row').forEach(row => {
      const hay = row.dataset.search || '';
      const show = terms.every(term => hay.includes(term)) &&
        (!region || hay.includes(region.toLowerCase()));
      row.hidden = !show;
      if (show) visible++;
    });

    const count = $('#dirCount');
    if (count) {
      const t = totals(towns);
      count.textContent = visible === t.towns
        ? t.towns + ' towns · ' + t.citizens + ' citizens'
        : visible + ' of ' + t.towns + ' towns · ' + t.citizens + ' citizens';
    }
    const src = $('#dirSource');
    if (src) src.textContent = '· ' + (sourceLabel[stateSource] || 'checking live data');
    const empty = $('#dirEmpty');
    if (empty) empty.hidden = visible !== 0;
  }

  // Deep link from town cards ("See residents →") opens that town in the directory.
  function jumpToTown(name) {
    const target = name.toLowerCase();
    const row = $$('#dirList .dir-row').find(r => r.dataset.town === target);
    if (!row) return false;
    const search = $('#dirSearch');
    if (search) search.value = '';
    const region = $('#dirRegion');
    if (region) region.value = '';
    applyFilter();
    if (row.querySelector('.dir-body')?.hidden) row.querySelector('.dir-head').click();
    row.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center' });
    row.classList.add('flash');
    setTimeout(() => row.classList.remove('flash'), 1400);
    return true;
  }

  function renderAll() {
    renderStats();
    renderMapChips();
    fillRegionSelect();
    renderDirectory();
  }

  // ------------------------------------------------------------------
  // Data pipeline: live map → localStorage cache → roster.json → baked fallback
  // The page always shows real numbers from one of these four sources.
  // ------------------------------------------------------------------
  async function loadRoster() {
    // 1) Cached live pull from a previous visit — instant, feels alive.
    const cached = readCache();
    if (cached) {
      towns = cached.towns;
      lastSyncedAt = cached.syncedAt;
      stateSource = 'cache';
      renderAll();
    }

    // 2) Try the live map (single request; Dynmap serves markers.json per world).
    try {
      if (!window.RosterCore) throw new Error('roster-core.js missing');
      const fetched = await window.RosterCore.fetchNationTowns(fetch, {
        mapBase: CONFIG.mapBase, world: CONFIG.world, nation: CONFIG.nation
      });
      const now = new Date().toISOString();
      towns = fetched.map(t => ({ ...t, region: guessRegion(t.name) }));
      lastSyncedAt = now;
      stateSource = 'live';
      writeCache({ towns, syncedAt: now });
      renderAll();
      return;
    } catch (e) {
      console.warn('[roster] live fetch failed:', e.message);
    }

    // 3) Fall back to the committed snapshot file (updated by GitHub Actions).
    try {
      const res = await fetch(CONFIG.rosterUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error('roster.json responded ' + res.status);
      const snap = await res.json();
      if (!Array.isArray(snap.towns) || !snap.towns.length) throw new Error('empty snapshot');
      towns = snap.towns.map(t => ({ ...t, region: t.region || guessRegion(t.name) }));
      lastSyncedAt = snap.updatedAt || null;
      stateSource = 'snapshot';
      renderAll();
      return;
    } catch (e) {
      console.warn('[roster] snapshot failed:', e.message);
    }

    // 4) Last resort: data baked into main.js. Never zero, never stuck loading.
    towns = FALLBACK_TOWNS;
    lastSyncedAt = null;
    stateSource = 'fallback';
    renderAll();
  }

  // ------------------------------------------------------------------
  // UI wiring
  // ------------------------------------------------------------------
  function initNav() {
    const nav = $('#siteNav');
    const toggle = $('#navToggle');
    const links = $('#navLinks');
    if (toggle && links) {
      toggle.addEventListener('click', () => {
        const open = links.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', String(open));
      });
      links.addEventListener('click', (e) => {
        if (e.target.tagName === 'A') {
          links.classList.remove('is-open');
          toggle.setAttribute('aria-expanded', 'false');
        }
      });
    }
    if (nav) {
      const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 24);
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
  }

  function initTabs() {
    $$('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        $$('.tab').forEach(t => {
          const active = t === tab;
          t.classList.toggle('is-active', active);
          t.setAttribute('aria-selected', String(active));
        });
        $$('.tab-panel').forEach(p => p.classList.toggle('is-active', p.id === tab.dataset.tab));
      });
    });
  }

  function initCopyIp() {
    const btn = $('#copyIpBtn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const label = $('#copyIpLabel');
      if (!label) return;
      try {
        await navigator.clipboard.writeText(CONFIG.serverIp);
        label.textContent = 'Copied! See you in-game';
      } catch (e) {
        label.textContent = CONFIG.serverIp;
      }
      clearTimeout(btn._t);
      btn._t = setTimeout(() => { label.textContent = 'Copy IP · ' + CONFIG.serverIp; }, 2500);
    });
  }

  function initServerStatus() {
    // Best effort via mcstatus.io (CORS-friendly). If it fails we say so honestly —
    // no fake green dots.
    const dot = $('#serverDot'), text = $('#serverText');
    if (!dot || !text) return;
    fetch('https://api.mcstatus.io/v2/status/java/diplomaticamc.com')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
      .then(d => {
        dot.className = 'dot ' + (d.online ? 'dot-online' : 'dot-offline');
        text.textContent = d.online
          ? 'Server online · ' + ((d.players && d.players.online) ?? '?') + ' playing'
          : 'Server offline right now';
      })
      .catch(() => {
        dot.className = 'dot dot-waiting';
        text.textContent = 'Server status unavailable';
      });
  }

  function initDirectoryControls() {
    const search = $('#dirSearch');
    const region = $('#dirRegion');
    if (search) search.addEventListener('input', applyFilter);
    if (region) region.addEventListener('change', applyFilter);

    $$('[data-jump-town]').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        if (!jumpToTown(a.dataset.jumpTown)) {
          $('#directory')?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
        }
      });
    });
  }

  function initGrantForm() {
    const form = $('#grantForm');
    if (!form) return;
    const feedback = $('#formFeedback');
    const submit = $('#grantSubmit');

    const fields = [
      { id: 'gName', test: v => /^[A-Za-z0-9_]{3,16}$/.test(v.trim()), msg: 'Use your exact Minecraft name — 3 to 16 letters, numbers or _.' },
      { id: 'gTown', test: v => v.trim().length >= 3, msg: 'Give the town a real name (3+ characters).' },
      { id: 'gPlan', test: v => v.trim().length >= 20, msg: 'Two honest sentences, please — at least 20 characters.' }
    ];

    function setError(field, msg) {
      const input = document.getElementById(field.id);
      const err = form.querySelector('[data-for="' + field.id + '"]');
      if (err) err.textContent = msg || '';
      if (input) input.classList.toggle('is-invalid', !!msg);
    }

    fields.forEach(f => {
      const input = document.getElementById(f.id);
      if (!input) return;
      input.addEventListener('blur', () => {
        if (input.value.trim()) setError(f, f.test(input.value) ? '' : f.msg);
      });
      input.addEventListener('input', () => setError(f, ''));
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (feedback) { feedback.textContent = ''; feedback.className = 'form-feedback'; }

      let ok = true;
      fields.forEach(f => {
        const input = document.getElementById(f.id);
        const valid = input && f.test(input.value);
        if (!valid) { setError(f, f.msg); ok = false; }
      });
      if (!ok) return;

      if (CONFIG.webhookUrl.includes('REPLACE_WITH')) {
        if (feedback) {
          feedback.textContent = 'The form isn’t wired to Discord yet — apply in #grants on our Discord instead.';
          feedback.classList.add('is-error');
        }
        return;
      }

      submit.disabled = true;
      submit.textContent = 'Sending…';

      const payload = {
        username: 'Colombia Grants',
        embeds: [{
          title: 'New town grant application',
          color: 0xd4a017,
          fields: [
            { name: 'Player', value: document.getElementById('gName').value.trim(), inline: true },
            { name: 'Town', value: document.getElementById('gTown').value.trim(), inline: true },
            { name: 'Region', value: document.getElementById('gRegion').value, inline: true },
            { name: 'Plan', value: document.getElementById('gPlan').value.trim().slice(0, 1000) }
          ],
          timestamp: new Date().toISOString()
        }]
      };

      try {
        const res = await fetch(CONFIG.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Discord responded ' + res.status);
        form.reset();
        if (feedback) {
          feedback.textContent = 'Application sent. The Cabinet reviews grants in Discord — keep an eye there.';
          feedback.classList.add('is-success');
        }
      } catch (err) {
        if (feedback) {
          feedback.textContent = 'Couldn’t send that (' + err.message + '). Try again, or apply directly in Discord.';
          feedback.classList.add('is-error');
        }
      } finally {
        submit.disabled = false;
        submit.textContent = 'Send Application';
      }
    });
  }

  function initRevealOnScroll() {
    if (prefersReducedMotion || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add('revealed'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -40px 0px' });
    $$('.section, .town-card, .leader-card').forEach(n => { n.classList.add('reveal'); io.observe(n); });
  }

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    initNav();
    initTabs();
    initCopyIp();
    initServerStatus();
    initDirectoryControls();
    initGrantForm();
    initRevealOnScroll();
    loadRoster();
    // Keep "Updated X minutes ago" honest without refetching.
    setInterval(renderStats, 60000);
  });
})();
