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
  const cabinetLeaders = [
    { username: 'Novum_Vetus', role: 'Min. of Interior',       town: 'Antillara',   joined: '2026', bio: 'Elected Minister of Interior. Holds down the home front, keeps order, and makes sure daily operations don\'t fall apart.' },
    { username: 'ThyCoolio',   role: 'Min. of Culture',        town: 'El Salvador', joined: '2026', bio: 'Elected Minister of Culture with 7 votes. Keeps the community vibe alive, runs events, and preserves the Empire\'s cultural identity.' },
    { username: 'Respawn34',   role: 'Min. of Agriculture',    town: 'Canollia',    joined: '2026', bio: 'Elected Minister of Agriculture with 4 votes. Takes charge of resources and internal growth as the backbone of the economy.' },
    { username: 'Moumen11',    role: 'Min. of Technology',     town: 'Haiti',       joined: '2026', bio: 'Elected Minister of Technology. Manages infrastructure and automation, keeping the Empire\'s tech systems a step ahead.' },
    { username: 'K_NightFall', role: 'Min. of Justice and Law', town: 'Maicao',     joined: '2026', bio: 'Elected Minister of Justice and Law. Upholds the rules, keeps legal proceedings fair, and ensures justice is distributed properly.' },
    { username: 'Crowlia',     role: 'Min. of Defence',        town: 'Barbados',    joined: '2026', bio: 'Oversees the nation\'s army, maintains peace with foreign powers, and safeguards national security.' },
    { username: 'Maximilian_____I', role: 'Min. of Finance',   town: 'Maicao',      joined: '2026', bio: 'Manages the national treasury, taxation, trade, and economic policy.' },
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
      el.appendChild(makeAvatarImg(c.username, 64));
      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = c.username;
      el.appendChild(name);
      const role = document.createElement('div');
      role.className = 'role';
      role.textContent = c.role;
      el.appendChild(role);
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

  function renderTownsRoster(list) {
    const grid = document.getElementById('townsGrid');
    if (!grid) return;
    grid.innerHTML = '';
    list.forEach((t) => {
      const residents = t.residents || [];
      if (!residents.length) return;
      const mayor = Object.assign({}, residents[0], { role: 'Mayor of ' + t.name, town: t.name });
      const others = residents.slice(1);

      const card = document.createElement('div');
      card.className = 'town-roster-card';
      card.dataset.town = t.name.toLowerCase();

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

  /* ---------- Roster search / filter -----------------------------------------*/
  const citizenSearch = document.getElementById('citizenSearch');
  const rosterEmpty = document.getElementById('rosterEmpty');
  const rosterEmptyQuery = document.getElementById('rosterEmptyQuery');

  function filterRoster() {
    if (!citizenSearch) return;
    const q = citizenSearch.value.trim().toLowerCase();
    let anyVisible = false;

    $$('#leaderGridCrown .citizen-card, #leaderGridCabinet .citizen-card').forEach(card => {
      const name = card.querySelector('.name').textContent.toLowerCase();
      const role = card.querySelector('.role').textContent.toLowerCase();
      const match = !q || name.includes(q) || role.includes(q);
      card.classList.toggle('hidden', !match);
      if (match) anyVisible = true;
    });

    $$('#townsGrid .town-roster-card').forEach(card => {
      const townName = card.dataset.town || '';
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
    if (rosterEmpty) rosterEmpty.classList.toggle('show', q.length > 0 && !anyVisible);
  }
  if (citizenSearch) citizenSearch.addEventListener('input', filterRoster);

  /* ---------- "See residents →" jumps pre-fill the search --------------------*/
  $$('[data-jump-town]').forEach(link => {
    link.addEventListener('click', () => {
      if (!citizenSearch) return;
      citizenSearch.value = link.dataset.jumpTown;
      filterRoster();
    });
  });

  /* ---------- Render everything whenever LiveData updates ---------------------*/
  const rosterLiveBadge = document.getElementById('rosterLiveBadge');

  function setRosterBadge(state, detail) {
    if (!rosterLiveBadge) return;
    if (state === 'live') {
      rosterLiveBadge.textContent = '● Live from server';
      rosterLiveBadge.title = 'Fetched live from the roster feed.';
    } else if (state === 'fallback') {
      const stamp = detail ? new Date(detail).toLocaleString() : 'recently';
      rosterLiveBadge.textContent = '● Synced snapshot';
      rosterLiveBadge.title = 'Live feed unavailable — showing the committed snapshot from ' + stamp + '.';
    } else {
      rosterLiveBadge.textContent = '○ Syncing…';
    }
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

  if (window.LiveData && typeof window.LiveData.subscribe === 'function') {
    window.LiveData.subscribe(renderRoster);
  }
})();
