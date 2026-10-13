/* ==========================================================================
   Sections — behaviour for the rebuilt content sections:
   mobile nav, district tabs, town brochure carousel, live server/Discord
   status, copy IP, wiki widget, citizen roster (leaders + towns + search),
   profile modal, scrollspy, back-to-top.

   Everything renders from window.LiveData so the directory, the map area
   and the hero stats always show the same trusted numbers.
   ========================================================================== */
(function () {
  'use strict';

  const config = window.SITE_CONFIG || {};
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return Array.from(document.querySelectorAll(sel)); }

  /* ---------- Toast -------------------------------------------------------*/
  const toastEl = document.getElementById('toast');
  let toastTimeout;
  function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toastEl.classList.remove('show'), 2800);
  }

  /* ---------- Mobile nav --------------------------------------------------*/
  const navToggle = document.getElementById('navToggle');
  const siteNav = document.getElementById('siteNav');
  const navScrim = document.getElementById('navScrim');
  const navMQ = window.matchMedia('(max-width: 1080px)');

  function syncNavForViewport() {
    if (!siteNav) return;
    if (navMQ.matches && !siteNav.classList.contains('open')) {
      siteNav.setAttribute('inert', '');
      siteNav.setAttribute('aria-hidden', 'true');
    } else {
      siteNav.removeAttribute('inert');
      siteNav.removeAttribute('aria-hidden');
    }
  }
  function openNav() {
    siteNav.classList.add('open');
    navToggle.classList.add('open');
    navScrim.classList.add('open');
    navToggle.setAttribute('aria-expanded', 'true');
    siteNav.removeAttribute('inert');
    siteNav.removeAttribute('aria-hidden');
    document.body.style.overflow = 'hidden';
  }
  function closeNav(returnFocus) {
    siteNav.classList.remove('open');
    navToggle.classList.remove('open');
    navScrim.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    syncNavForViewport();
    if (returnFocus) navToggle.focus();
  }
  if (navToggle && siteNav) {
    syncNavForViewport();
    navMQ.addEventListener('change', syncNavForViewport);
    navToggle.addEventListener('click', () => {
      siteNav.classList.contains('open') ? closeNav(true) : openNav();
    });
    if (navScrim) navScrim.addEventListener('click', () => closeNav(true));
    $$ ('#siteNav a').forEach(a => a.addEventListener('click', () => closeNav(false)));
  }

  /* ---------- Back to top -------------------------------------------------*/
  const backToTop = document.getElementById('backToTop');
  if (backToTop) {
    window.addEventListener('scroll', () => {
      backToTop.classList.toggle('visible', window.scrollY > 600);
    }, { passive: true });
    backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  /* ---------- Scrollspy: highlight current section in nav ------------------*/
  const spyIds = ['capital', 'towns', 'map', 'wiki', 'cabinet', 'citizens'];
  const spySections = spyIds.map(id => document.getElementById(id)).filter(Boolean);
  const spyLinks = $$('#siteNav a').filter(a => (a.getAttribute('href') || '').startsWith('#'));
  function setActiveNavLink(id) {
    spyLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + id));
  }
  if (spySections.length && 'IntersectionObserver' in window) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) setActiveNavLink(e.target.id); });
    }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });
    spySections.forEach(sec => spy.observe(sec));
  }

  /* ---------- District tabs (Capital section) ------------------------------*/
  $$('.district-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.district-tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      $$('.district-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const panel = document.getElementById('panel-' + tab.dataset.panel);
      if (panel) panel.classList.add('active');
    });
  });

  /* ---------- Town brochure carousel ---------------------------------------*/
  (function brochure() {
    const track = document.getElementById('brochureTrack');
    if (!track) return;
    const prev = document.getElementById('brochurePrev');
    const next = document.getElementById('brochureNext');
    const dots = $$('#brochureDots .brochure-dot');
    let i = 0;
    const n = track.children.length;

    function go(to) {
      i = (to + n) % n;
      track.style.transform = 'translateX(' + (-i * 100) + '%)';
      dots.forEach((d, di) => d.classList.toggle('active', di === i));
    }
    if (prev) prev.addEventListener('click', () => go(i - 1));
    if (next) next.addEventListener('click', () => go(i + 1));
    dots.forEach(d => d.addEventListener('click', () => go(parseInt(d.getAttribute('data-i'), 10))));

    // swipe on touch
    let x0 = null;
    track.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    track.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1));
      x0 = null;
    }, { passive: true });

    // keyboard when the carousel is focused
    const root = document.getElementById('townBrochure');
    if (root) {
      root.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') go(i + 1);
        if (e.key === 'ArrowLeft') go(i - 1);
      });
    }
  })();

  /* ---------- Cursor spotlight on cards ------------------------------------*/
  function spotlightMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--sx', (e.clientX - rect.left) + 'px');
    e.currentTarget.style.setProperty('--sy', (e.clientY - rect.top) + 'px');
  }
  $$('.gov-pill').forEach(el => el.addEventListener('mousemove', spotlightMove));

  /* ---------- Live server status + Copy IP ---------------------------------*/
  const serverStatusDot = document.getElementById('serverStatusDot');
  const serverStatusText = document.getElementById('serverStatusText');
  const copyIpBtn = document.getElementById('copyIpBtn');
  const copyIpLabel = document.getElementById('copyIpLabel');

  async function loadServerStatus() {
    if (!serverStatusDot || !serverStatusText) return;
    try {
      const res = await fetch('https://api.mcsrvstat.us/3/' + encodeURIComponent(config.SERVER_IP));
      const data = await res.json();
      if (data.online) {
        serverStatusDot.className = 'status-dot online';
        const count = data.players && typeof data.players.online === 'number' ? data.players.online : null;
        serverStatusText.textContent = count !== null ? 'Server Online · ' + count + ' playing' : 'Server Online';
      } else {
        serverStatusDot.className = 'status-dot offline';
        serverStatusText.textContent = 'Server Offline';
      }
    } catch (err) {
      serverStatusDot.className = 'status-dot offline';
      serverStatusText.textContent = 'Status unavailable';
    }
  }
  loadServerStatus();
  setInterval(loadServerStatus, 60000);

  if (copyIpBtn) {
    copyIpBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(config.SERVER_IP);
      } catch (err) {
        const ta = document.createElement('textarea');
        ta.value = config.SERVER_IP;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e2) { /* ignore */ }
        document.body.removeChild(ta);
      }
      copyIpLabel.textContent = '✓ Copied!';
      copyIpBtn.classList.add('copied');
      showToast('Server IP copied: ' + config.SERVER_IP);
      setTimeout(() => {
        copyIpLabel.textContent = 'Copy Server IP';
        copyIpBtn.classList.remove('copied');
      }, 2000);
    });
  }

  /* ---------- Discord member count ------------------------------------------*/
  const discordStatusText = document.getElementById('discordStatusText');
  async function loadDiscordStatus() {
    if (!discordStatusText) return;
    try {
      const res = await fetch('https://discord.com/api/v10/invites/' + config.DISCORD_INVITE_CODE + '?with_counts=true&with_expiration=false');
      if (!res.ok) throw new Error('bad response');
      const data = await res.json();
      const online = data.approximate_presence_count;
      const total = data.approximate_member_count;
      discordStatusText.textContent =
        (typeof online === 'number' && typeof total === 'number')
          ? online + ' online · ' + total + ' members'
          : 'Join our Discord';
    } catch (err) {
      discordStatusText.textContent = 'Join our Discord';
    }
  }
  loadDiscordStatus();

  /* ---------- Wiki widget (lazy, loads when scrolled near) ------------------*/
  const WIKI_PAGE_TITLE = config.WIKI_PAGE_TITLE || 'Colombia';
  const wikiWidgetBody = document.getElementById('wikiWidgetBody');

  async function loadWikiWidget() {
    if (!wikiWidgetBody) return;
    try {
      const params = new URLSearchParams({
        action: 'query', format: 'json', origin: '*',
        prop: 'extracts|pageimages', exintro: '1', explaintext: '1', exchars: '400',
        piprop: 'thumbnail', pithumbsize: '300', titles: WIKI_PAGE_TITLE,
      });
      const res = await fetch('https://wiki.diplomaticamc.com/api.php?' + params);
      const data = await res.json();
      const pages = data.query && data.query.pages;
      const page = pages ? Object.values(pages)[0] : null;

      if (!page || page.missing !== undefined) {
        wikiWidgetBody.innerHTML = '<p class="muted">No wiki page found titled "' + WIKI_PAGE_TITLE + '" yet. Once the nation\'s page exists on the DMC Wiki it will show up here automatically.</p>';
        return;
      }
      const extract = page.extract ? page.extract.trim() : 'No summary available yet.';
      const thumb = page.thumbnail ? page.thumbnail.source : null;
      const pageUrl = 'https://wiki.diplomaticamc.com/wiki/' + encodeURIComponent(page.title.replace(/ /g, '_'));
      wikiWidgetBody.innerHTML =
        (thumb ? '<img src="' + thumb + '" alt="' + page.title + '" loading="lazy" decoding="async">' : '') +
        '<div class="wiki-widget-text"><h3>' + page.title + '</h3><p>' + extract + '</p>' +
        '<a href="' + pageUrl + '" target="_blank" rel="noopener">Read Full Entry →</a></div>';
    } catch (err) {
      wikiWidgetBody.innerHTML = '<p class="muted">Couldn\'t reach the wiki right now — <a href="https://wiki.diplomaticamc.com/wiki/' +
        encodeURIComponent(WIKI_PAGE_TITLE.replace(/ /g, '_')) + '" target="_blank" rel="noopener">view it directly here</a>.</p>';
    }
  }
  const wikiSection = document.getElementById('wiki');
  if (wikiSection && 'IntersectionObserver' in window) {
    let wikiLoaded = false;
    const wikiObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !wikiLoaded) {
          wikiLoaded = true;
          loadWikiWidget();
          wikiObserver.disconnect();
        }
      });
    }, { rootMargin: '400px' });
    wikiObserver.observe(wikiSection);
  } else {
    loadWikiWidget();
  }

  /* ---------- Profile modal --------------------------------------------------*/
  const profileOverlay = document.getElementById('profileOverlay');
  let lastProfileTrigger = null;

  function openProfile(c) {
    if (!profileOverlay) return;
    lastProfileTrigger = document.activeElement;
    const avatar = 'https://mc-heads.net/avatar/' + encodeURIComponent(c.username) + '/128';
    document.getElementById('pImg').src = avatar;
    document.getElementById('pImg').alt = c.username;
    document.getElementById('pName').textContent = c.username;
    document.getElementById('pRole').textContent = c.role || 'Citizen';
    document.getElementById('pBio').textContent = c.bio || 'No bio has been added for this citizen yet.';
    document.getElementById('pTown').textContent = c.town || 'Unassigned';
    document.getElementById('pJoined').textContent = c.joined || 'Unknown';
    profileOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    document.getElementById('profileClose').focus();
  }
  function closeProfile() {
    if (!profileOverlay) return;
    profileOverlay.classList.remove('open');
    document.body.style.overflow = '';
    if (lastProfileTrigger) lastProfileTrigger.focus();
  }
  const profileClose = document.getElementById('profileClose');
  if (profileClose) profileClose.addEventListener('click', closeProfile);
  if (profileOverlay) profileOverlay.addEventListener('click', (e) => { if (e.target === profileOverlay) closeProfile(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (profileOverlay && profileOverlay.classList.contains('open')) closeProfile();
      if (siteNav && siteNav.classList.contains('open')) closeNav(true);
    }
  });

  /* ---------- Leadership lists (static roles, avatars from mc-heads) ---------*/
  const crownLeaders = [
    { username: 'ueq_',         role: 'King of Colombia',             town: 'Maicao',            joined: 'Est. 2026', bio: 'Founder and King of the Colombian Empire.' },
    { username: 'OliveTree315', role: 'Prime Minister of Colombia',   town: 'Medellin Antioquia', joined: '2026', bio: '' },
    { username: 'pikagamer55',  role: 'King of Central America',      town: 'Puerto Lempira',     joined: '2025', bio: '' },
    { username: 'zaity1',       role: 'Prime Minister of Central America', town: 'Tegucigalpa',   joined: '2025', bio: '' },
  ];
  // Kept in sync with the Cabinet section on index.html — tier order matters:
  // Crown first, Senior Ministry next, then the ministries.
  const cabinetLeaders = [
    { username: 'Novum_Vetus', role: 'Min. of Foreign & Internal Affairs', tier: 'senior', town: 'Antillara', joined: '2026', bio: 'Represents the Empire abroad and coordinates town placements and internal borders at home.' },
    { username: 'Crowlia',     role: 'Min. of Defense',        tier: 'senior', town: 'Barbados',    joined: '2026', bio: 'Commands the imperial army, guards the claims, and keeps the peace with foreign powers.' },
    { username: 'Maximilian_____I', role: 'Min. of Finance',   tier: 'senior', town: 'Maicao',      joined: '2026', bio: 'Manages the national treasury, taxation, trade, and the gold behind every town grant.' },
    { username: 'qulipzz',     role: 'Min. of Justice and Law', tier: 'ministry', town: 'Maicao',   joined: '2026', bio: 'Enforces imperial code and settles legal matters across the realm.' },
    { username: 'pato541',     role: 'Min. of Culture',        tier: 'ministry', town: 'El Salvador', joined: '2026', bio: "Preserves the Empire's history, runs events, and keeps its identity alive." },
    { username: 'Respawn34',   role: 'Min. of Agriculture',    tier: 'ministry', town: 'Canollia',  joined: '2026', bio: 'Elected Minister of Agriculture. Takes charge of resources and internal growth as the backbone of the economy.' },
    { username: 'Moumen11',    role: 'Min. of Technology',     tier: 'ministry', town: 'Haiti',     joined: '2026', bio: "Elected Minister of Technology. Manages infrastructure and automation, keeping the Empire's tech systems a step ahead." },
  ];

  function makeAvatarImg(username, size) {
    const img = document.createElement('img');
    img.className = 'img-skeleton';
    img.alt = '';
    img.setAttribute('role', 'presentation');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = 'https://mc-heads.net/avatar/' + encodeURIComponent(username) + '/' + size;
    const clear = () => img.classList.remove('img-skeleton');
    if (img.complete && img.naturalWidth) clear();
    else { img.addEventListener('load', clear, { once: true }); img.addEventListener('error', clear, { once: true }); }
    return img;
  }

  function renderPlayerCards(list, containerId) {
    const grid = document.getElementById(containerId);
    if (!grid) return;
    grid.innerHTML = '';
    list.forEach((c) => {
      const el = document.createElement('div');
      el.className = 'citizen-card';
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', 'View profile: ' + c.username + ', ' + c.role);
      // Region data so the roster region filters work on leaders too.
      el.dataset.town = (c.town || '').toLowerCase();
      el.dataset.region = townRegion(c.town || '');
      el.appendChild(makeAvatarImg(c.username, 64));
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = c.username;
      el.appendChild(name);
      const role = document.createElement('div');
      role.className = 'role';
      role.textContent = c.role;
      el.appendChild(role);
      if (c.tier) {
        const tierTag = document.createElement('div');
        tierTag.className = 'citizen-tier citizen-tier-' + c.tier;
        tierTag.textContent = c.tier === 'senior' ? 'Senior Ministry' : 'Ministry';
        el.appendChild(tierTag);
      }
      el.addEventListener('click', () => openProfile(c));
      el.addEventListener('mousemove', spotlightMove);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProfile(c); }
      });
      grid.appendChild(el);
    });
  }

  /* ---------- Towns & residents roster --------------------------------------*/
  let allResidents = [];

  // Region mapping for the 34 in-game towns — one place to edit when the
  // Empire claims new ground. Anything unmapped falls into "Other claims".
  const TOWN_REGIONS = {
    caribbean:      ['Maicao', 'New Bahamas', 'Trinidad', 'Golopigi', 'George Town',
                     'Dominican Republic', 'Paramaribo', 'Bismuna Tara'],
    colombia:       ['Aldama', 'Cabada Vera', 'Cali', 'Canollia', 'Cordoba', 'Guatape',
                     'Iza', 'Jardin', 'Medellin Antioquia', 'Santa Ana', 'Santa Maria',
                     'Santa Marta', 'Zircon', 'El Estrella', 'Intuto', 'Salento'],
    'central-america': ['Tegucigalpa', 'Puerto Lempira', 'Managua', 'Esteli', 'Panama',
                        'Guatemala', 'El Salvador', 'Mexico City'],
    'south-america':   ['Quito', 'Caracas', 'Goiania'],
  };
  const REGION_LABELS = {
    caribbean: 'Caribbean', colombia: 'Colombia',
    'central-america': 'Central America', 'south-america': 'South America',
    other: 'Other claims',
  };
  function townRegion(name) {
    for (const key of Object.keys(TOWN_REGIONS)) {
      if (TOWN_REGIONS[key].includes(name)) return key;
    }
    return 'other';
  }

  function renderTownsRoster(list) {
    const grid = document.getElementById('townsGrid');
    if (!grid) return;
    grid.innerHTML = '';
    list.forEach((t) => {
      const residents = t.residents || [];
      if (!residents.length) return;
      const mayor = Object.assign({}, residents[0], { role: 'Mayor of ' + t.name, town: t.name });
      const others = residents.slice(1);
      const region = townRegion(t.name);

      const card = document.createElement('div');
      card.className = 'town-roster-card';
      card.dataset.town = t.name.toLowerCase();
      card.dataset.region = region;

      const head = document.createElement('div');
      head.className = 'town-roster-head';
      const h4 = document.createElement('h4');
      h4.textContent = t.name;
      const count = document.createElement('span');
      count.className = 'town-roster-count';
      count.textContent = residents.length + ' ' + (residents.length === 1 ? 'resident' : 'residents');
      head.appendChild(h4);
      head.appendChild(count);
      card.appendChild(head);

      const pill = document.createElement('span');
      pill.className = 'region-pill tag-' + (region === 'central-america' ? 'central'
        : region === 'colombia' ? 'colombia'
        : region === 'caribbean' ? 'caribbean' : 'central');
      pill.style.opacity = region === 'other' ? '0.55' : '1';
      pill.textContent = REGION_LABELS[region];
      head.appendChild(pill);

      const mayorRow = document.createElement('div');
      mayorRow.className = 'town-mayor-row';
      mayorRow.setAttribute('tabindex', '0');
      mayorRow.setAttribute('role', 'button');
      mayorRow.setAttribute('aria-label', 'View profile: ' + mayor.username + ', Mayor of ' + t.name);
      mayorRow.dataset.name = mayor.username.toLowerCase();
      mayorRow.appendChild(makeAvatarImg(mayor.username, 64));
      const mayorInfo = document.createElement('div');
      mayorInfo.className = 'mayor-info';
      mayorInfo.innerHTML = '<div class="name"></div><div class="tag">👑 Mayor</div>';
      mayorInfo.querySelector('.name').textContent = mayor.username;
      mayorRow.appendChild(mayorInfo);
      mayorRow.addEventListener('click', () => openProfile(mayor));
      mayorRow.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProfile(mayor); } });
      card.appendChild(mayorRow);

      if (others.length) {
        const chips = document.createElement('div');
        chips.className = 'town-residents-chips';
        others.forEach((r) => {
          const person = Object.assign({}, r, { role: 'Citizen of ' + t.name, town: t.name });
          const chip = document.createElement('span');
          chip.className = 'resident-chip';
          chip.setAttribute('tabindex', '0');
          chip.setAttribute('role', 'button');
          chip.setAttribute('aria-label', 'View profile: ' + r.username + ', Citizen of ' + t.name);
          chip.dataset.name = r.username.toLowerCase();
          chip.appendChild(makeAvatarImg(r.username, 32));
          chip.appendChild(document.createTextNode(r.username));
          chip.addEventListener('click', () => openProfile(person));
          chip.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProfile(person); } });
          chips.appendChild(chip);
        });
        card.appendChild(chips);
      } else {
        const note = document.createElement('p');
        note.className = 'town-no-others';
        note.textContent = 'Sole resident.';
        card.appendChild(note);
      }
      grid.appendChild(card);
    });
  }

  /* ---------- Roster search / region filters --------------------------------*/
  const citizenSearch = document.getElementById('citizenSearch');
  const rosterEmpty = document.getElementById('rosterEmpty');
  const rosterEmptyQuery = document.getElementById('rosterEmptyQuery');
  const rosterClearBtn = document.getElementById('rosterClear');
  const regionFilterBtns = $$('#regionFilters .region-chip');
  let activeRegion = 'all';

  function filterRoster() {
    if (!citizenSearch) return;
    const q = citizenSearch.value.trim().toLowerCase();
    let anyVisible = false;

    // Leaders: match by name/role, and honour the region filter via their town.
    $$('#leaderGridCrown .citizen-card, #leaderGridCabinet .citizen-card').forEach(card => {
      const name = card.querySelector('.name').textContent.toLowerCase();
      const role = card.querySelector('.role').textContent.toLowerCase();
      const town = (card.dataset.town || '').toLowerCase();
      const regionOk = activeRegion === 'all' || card.dataset.region === activeRegion;
      const match = (!q || name.includes(q) || role.includes(q) || town.includes(q)) && regionOk;
      card.classList.toggle('hidden', !match);
      if (match) anyVisible = true;
    });

    $$('#townsGrid .town-roster-card').forEach(card => {
      const townName = card.dataset.town || '';
      const regionOk = activeRegion === 'all' || card.dataset.region === activeRegion;
      if (!regionOk) {
        card.classList.add('roster-hidden');
        return;
      }
      const mayorRow = card.querySelector('.town-mayor-row');
      const mayorName = mayorRow ? mayorRow.dataset.name || '' : '';
      const townOrMayorMatch = !q || townName.includes(q) || mayorName.includes(q);

      let anyChipMatch = false;
      card.querySelectorAll('.resident-chip').forEach(chip => {
        const chipMatch = !q || townOrMayorMatch || (chip.dataset.name || '').includes(q);
        chip.classList.toggle('roster-hidden', !chipMatch);
        if (chipMatch) anyChipMatch = true;
      });

      const cardMatch = townOrMayorMatch || anyChipMatch;
      card.classList.toggle('roster-hidden', !cardMatch);
      if (mayorRow) mayorRow.style.display = (!q || townOrMayorMatch) ? '' : 'none';
      if (cardMatch) anyVisible = true;
    });

    if (rosterEmptyQuery) rosterEmptyQuery.textContent = citizenSearch.value.trim();
    if (rosterEmpty) rosterEmpty.classList.toggle('show', !anyVisible);
    if (citizenSearch.parentElement) {
      citizenSearch.parentElement.classList.toggle('has-value', q.length > 0);
    }
  }
  if (citizenSearch) citizenSearch.addEventListener('input', filterRoster);

  if (rosterClearBtn) {
    rosterClearBtn.addEventListener('click', () => {
      citizenSearch.value = '';
      filterRoster();
      citizenSearch.focus();
    });
  }

  regionFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      regionFilterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeRegion = btn.dataset.region;
      filterRoster();
    });
  });

  /* ---------- Deep links: #citizens / town?person=X / town=X ---------------*/
  // Applies a search term from the URL (?person= or ?town=) or from an
  // in-page jump link, then scrolls the directory into view.
  function applyJumpTerm(term) {
    if (!citizenSearch || !term) return;
    citizenSearch.value = term;
    filterRoster();
  }
  $$('[data-jump-town]').forEach(link => {
    link.addEventListener('click', () => applyJumpTerm(link.dataset.jumpTown));
  });
  (function handleUrlParams() {
    const params = new URLSearchParams(location.search);
    const term = params.get('person') || params.get('town');
    if (term) applyJumpTerm(term);
  })();
  window.addEventListener('hashchange', () => {
    const params = new URLSearchParams(location.search);
    const term = params.get('person') || params.get('town');
    if (term) applyJumpTerm(term);
  });

  /* ---------- Render everything whenever LiveData updates ---------------------*/
  const rosterLiveBadge = document.getElementById('rosterLiveBadge');

  function setRosterBadge(state, detail) {
    if (!rosterLiveBadge) return;
    const stamp = detail ? shortStamp(new Date(detail)) : 'recently';
    if (state === 'live') {
      rosterLiveBadge.textContent = '● Live · synced ' + relFreshness(new Date(detail || Date.now()));
      rosterLiveBadge.title = 'Fetched live from the roster feed.';
    } else if (state === 'fallback') {
      rosterLiveBadge.textContent = '● Synced snapshot · ' + stamp;
      rosterLiveBadge.title = 'Live feed unavailable — showing the committed snapshot from ' + stamp + '. Refreshes automatically with every deploy.';
    } else {
      rosterLiveBadge.textContent = '○ Syncing…';
    }
  }

  function shortStamp(date) {
    if (isNaN(date)) return 'recently';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
           ', ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  function relFreshness(date) {
    const mins = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + 'h ago';
    return Math.floor(hours / 24) + 'd ago';
  }

  function renderRoster(state) {
    const roster = state.data;
    if (!roster) { setRosterBadge('pending'); return; }
    setRosterBadge(state.source, roster.updatedAt);
    allResidents = roster.towns.flatMap(t => (t.residents || []).map(r => Object.assign({}, r, { town: t.name })));
    renderTownsRoster(roster.towns);
    filterRoster();
  }

  renderPlayerCards(crownLeaders, 'leaderGridCrown');
  renderPlayerCards(cabinetLeaders, 'leaderGridCabinet');

  /* ---------- Cabinet pills: hover spotlight + open profile on click --------*/
  document.querySelectorAll('.gov-pill[data-jump]').forEach((pill) => {
    const username = pill.dataset.jump;
    const person = crownLeaders.concat(cabinetLeaders).find((p) => p.username === username);
    if (!person) return;
    pill.classList.add('gov-pill-link');
    pill.setAttribute('tabindex', '0');
    pill.setAttribute('role', 'button');
    pill.setAttribute('aria-label', 'View profile: ' + person.username + ', ' + person.role);
    pill.addEventListener('mousemove', spotlightMove);
    pill.addEventListener('click', () => openProfile(person));
    pill.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProfile(person); }
    });
  });

  if (window.LiveData && typeof window.LiveData.subscribe === 'function') {
    window.LiveData.subscribe(renderRoster);
  }

  /* ---------- Grants petition form -----------------------------------------*/
  (function grantForm() {
    const form = document.getElementById('grantForm');
    if (!form) return;
    const successCard = document.getElementById('grantSuccess');
    const successText = document.getElementById('grantSuccessText');
    const submitBtn = document.getElementById('grantSubmitBtn');
    const noteEl = document.getElementById('grantFormNote');
    const copyBtn = document.getElementById('grantCopyBtn');
    const againBtn = document.getElementById('grantAgainBtn');
    let lastPayload = null;

    function fieldError(input, message) {
      const err = form.querySelector('[data-error-for="' + input.id + '"]');
      if (message) {
        input.setAttribute('aria-invalid', 'true');
        if (err) err.textContent = message;
      } else {
        input.removeAttribute('aria-invalid');
        if (err) err.textContent = '';
      }
      return !message;
    }

    function validate() {
      const v = {
        minecraft: form.elements.minecraft.value.trim(),
        discord: form.elements.discord.value.trim(),
        town: form.elements.town.value.trim(),
        region: form.elements.region.value,
        amount: form.elements.amount.value,
        status: form.elements.status.value,
        plan: form.elements.plan.value.trim(),
      };
      let ok = true;
      ok = fieldError(form.elements.minecraft, v.minecraft ? '' : 'Your Minecraft username is required.') && ok;
      ok = fieldError(form.elements.discord, v.discord ? '' : 'A Discord tag lets the Crown reach you.') && ok;
      ok = fieldError(form.elements.town, v.town ? '' : 'Name the town you want to found.') && ok;
      ok = fieldError(form.elements.plan,
        !v.plan ? 'Tell us what you plan to build.'
        : v.plan.length < 30 ? 'A little more detail please — at least a sentence or two.'
        : '') && ok;
      return ok ? v : null;
    }

    // Live re-validation once a field has been flagged.
    ['minecraft', 'discord', 'town', 'plan'].forEach(name => {
      const el = form.elements[name];
      el.addEventListener('input', () => { if (el.getAttribute('aria-invalid')) validate(); });
    });

    function buildMessage(v) {
      return [
        '**Town Grant Petition — Reino de Colombia**',
        '- **Minecraft:** ' + v.minecraft,
        '- **Discord:** ' + v.discord,
        '- **Proposed town:** ' + v.town,
        '- **Region:** ' + v.region,
        '- **Grant requested:** ' + v.amount,
        '- **Status:** ' + v.status,
        '- **Plan:**',
        '> ' + v.plan.replace(/\n/g, '\n> '),
      ].join('\n');
    }

    function showSuccess(message) {
      form.hidden = true;
      successCard.hidden = false;
      successText.textContent = message;
      successCard.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center' });
    }

    async function copyText(text) {
      try { await navigator.clipboard.writeText(text); return true; }
      catch (e) {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        let done = false;
        try { done = document.execCommand('copy'); } catch (e2) { done = false; }
        document.body.removeChild(ta);
        return done;
      }
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = validate();
      if (!v) {
        noteEl.textContent = 'Please fix the highlighted fields.';
        noteEl.classList.add('error');
        return;
      }
      noteEl.textContent = '';
      noteEl.classList.remove('error');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';
      lastPayload = buildMessage(v);

      const webhook = (config.WEBHOOK_URL || '').trim();
      if (/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//.test(webhook)) {
        try {
          const res = await fetch(webhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Grant Petitions', content: lastPayload }),
          });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          showSuccess('Your petition was delivered straight to the Crown’s review channel. Expect an answer in Discord.');
        } catch (err) {
          showSuccess('The direct line to the Crown is busy right now, so your petition is ready to paste instead.');
        }
      } else {
        // No webhook configured yet — guarantee the application survives.
        const copied = await copyText(lastPayload);
        showSuccess(copied
          ? 'Your petition is on your clipboard. Paste it in #grant-applications on Discord and the Crown will review it.'
          : 'Select the copied text below if the clipboard did not cooperate, then post it in #grant-applications on Discord.');
      }

      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Petition';
    });

    if (copyBtn) copyBtn.addEventListener('click', async () => {
      if (!lastPayload) return;
      const ok = await copyText(lastPayload);
      showToast(ok ? 'Application copied to clipboard' : 'Copy failed — select it manually');
    });

    if (againBtn) againBtn.addEventListener('click', () => {
      form.reset();
      form.hidden = false;
      successCard.hidden = true;
      form.elements.minecraft.focus();
    });
  })();
})();
