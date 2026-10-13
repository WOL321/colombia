/* ==========================================================================
   Main — page-level behaviour only. Section logic lives in its own module
   (hero-stats below; directory/map/grants arrive with their sections).
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- Header: solidify on scroll ---------- */
  const header = document.getElementById('siteHeader');
  function onScroll() {
    header.classList.toggle('is-scrolled', window.scrollY > 24);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Reveal-on-scroll ---------- */
  const revealEls = document.querySelectorAll('.reveal:not(.is-in)');
  if ('IntersectionObserver' in window && revealEls.length) {
    const io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    // No observer support → show everything immediately. Content first.
    revealEls.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- Hero live stats ----------
     Renders from LiveData, which guarantees real numbers: live.json when
     reachable, the committed snapshot otherwise. The "—" placeholders are
     replaced the moment data exists; they never sit there forever because
     the fallback ships inside the repo. */
  const statEls = {
    towns: document.querySelector('[data-stat="towns"]'),
    citizens: document.querySelector('[data-stat="citizens"]'),
    leaders: document.querySelector('[data-stat="leaders"]'),
    council: document.querySelector('[data-stat="council"]'),
  };

  // Fixed headline numbers: one Leader (the King) and the five-seat
  // Council of Ministers. These are set by hand, not derived from the roster.
  if (statEls.leaders) statEls.leaders.textContent = '1';
  if (statEls.council) statEls.council.textContent = '5';
  const updatedEl = document.querySelector('[data-stat-updated]');

  function relTime(date) {
    const mins = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + (mins === 1 ? ' minute ago' : ' minutes ago');
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + (hours === 1 ? ' hour ago' : ' hours ago');
    const days = Math.floor(hours / 24);
    return days + (days === 1 ? ' day ago' : ' days ago');
  }

  // Count up briefly so the numbers feel alive instead of popping in.
  function setStat(el, value) {
    if (!el || el.textContent === String(value)) return;
    const from = parseInt(el.textContent, 10) || 0;
    const start = performance.now();
    const duration = 700;
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(from + (value - from) * eased);
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function renderStats(state) {
    const stats = LiveData.getStats();
    if (!stats) return;
    setStat(statEls.towns, stats.towns);
    setStat(statEls.citizens, stats.citizens);
    // "Leader" and "Council of Ministers" are fixed numbers (1 / 5) — see above.

    const stamp = state.data.updatedAt
      ? new Date(state.data.updatedAt)
      : state.fetchedAt;
    updatedEl.textContent = 'Updated ' + relTime(stamp);

    // The towns-section footnote uses the same trusted town count.
    document.querySelectorAll('[data-stat="towns"]').forEach(function (el) {
      if (el !== statEls.towns) el.textContent = stats.towns;
    });
  }

  LiveData.subscribe(renderStats);

  // Keep "Updated X minutes ago" honest while the tab stays open.
  setInterval(function () {
    const state = LiveData.getState();
    if (state.data) renderStats(state);
  }, 60 * 1000);
})();
