(() => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const hasSda = !!(window.CSS && CSS.supports && CSS.supports('animation-timeline', 'view()'));
  document.documentElement.classList.toggle('no-sda', !hasSda);
  document.documentElement.classList.toggle('has-sda', hasSda);

  function revealOnce() {
    const nodes = document.querySelectorAll('.reveal');
    if (reduceMq.matches) {
      nodes.forEach((el) => el.classList.add('is-in'));
      return;
    }
    if (!('IntersectionObserver' in window)) {
      nodes.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.22, rootMargin: '0px 0px -8% 0px' });
    nodes.forEach((el) => io.observe(el));
  }

  function setBeat(reel, index) {
    const beats = Number(reel.dataset.beats || 1);
    const next = Math.max(0, Math.min(beats - 1, index));
    if (reel.dataset.active === String(next)) return;
    reel.dataset.active = String(next);
    reel.querySelectorAll('.reel-index li').forEach((li, i) => {
      if (i === next) li.setAttribute('aria-current', 'true');
      else li.removeAttribute('aria-current');
    });
  }

  function syncReels() {
    if (reduceMq.matches) return;
    document.querySelectorAll('.reel').forEach((reel) => {
      const beats = Number(reel.dataset.beats || 1);
      const span = reel.offsetHeight - window.innerHeight;
      if (span <= 0) {
        setBeat(reel, 0);
        return;
      }
      const progress = Math.min(0.999, Math.max(0, -reel.getBoundingClientRect().top / span));
      setBeat(reel, Math.floor(progress * beats));
    });
  }

  function markPlates() {
    if (hasSda || reduceMq.matches || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle('is-view', entry.isIntersecting);
      });
    }, { threshold: 0.35 });
    document.querySelectorAll('.plate').forEach((el) => io.observe(el));
  }

  function parallaxFallback() {
    if (hasSda || reduceMq.matches) return;
    document.querySelectorAll('.plate').forEach((plate) => {
      const type = plate.querySelector('.plate-type');
      if (!type) return;
      const rect = plate.getBoundingClientRect();
      const mid = rect.top + rect.height / 2 - window.innerHeight / 2;
      type.style.transform = 'translateY(' + (-mid * 0.18) + 'px)';
    });
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      syncReels();
      parallaxFallback();
      ticking = false;
    });
  }

  revealOnce();
  markPlates();
  syncReels();
  parallaxFallback();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  reduceMq.addEventListener('change', () => {
    document.querySelectorAll('.plate-type').forEach((el) => { el.style.transform = ''; });
    revealOnce();
    syncReels();
  });

  const nav = document.getElementById('site-nav');
  const navBtn = document.querySelector('.nav-toggle');
  const header = document.querySelector('.site-header');
  function setNav(open) {
    if (!nav || !navBtn) return;
    navBtn.setAttribute('aria-expanded', String(open));
    navBtn.textContent = open ? 'סגור' : 'פתח';
    if (header) header.classList.toggle('is-nav-open', open);
    document.documentElement.classList.toggle('is-nav-locked', open);
    document.body.classList.toggle('is-nav-locked', open);
  }
  if (navBtn && nav) {
    navBtn.addEventListener('click', () => {
      setNav(navBtn.getAttribute('aria-expanded') !== 'true');
    });
    nav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => setNav(false));
    });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') setNav(false);
    });
  }

  const form = document.getElementById('lead-form');
  if (form) {
    const status = form.querySelector('.form-status');
    const statusLink = form.querySelector('.form-status-link');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const name = String(form.name.value || '').trim();
      const phone = String(form.phone.value || '').trim();
      if (!phone) {
        form.phone.reportValidity();
        form.phone.focus();
        return;
      }
      const treatment = String(form.treatment.value || '').trim();
      const message = String(form.message.value || '').trim();
      let text = 'היי עינבל, רציתי לקבוע תור\nטלפון: ' + phone + '\nטיפול: ' + treatment;
      if (name) text = 'היי עינבל, רציתי לקבוע תור\nשם: ' + name + '\nטלפון: ' + phone + '\nטיפול: ' + treatment;
      if (message) text += '\nהודעה: ' + message;
      const url = 'https://wa.me/972545576117?text=' + encodeURIComponent(text);
      if (statusLink) statusLink.href = url;
      const popup = window.open(url, '_blank');
      if (popup) {
        try { popup.opener = null; } catch (err) { /* ignore */ }
        if (status) status.hidden = true;
        return;
      }
      if (status) status.hidden = false;
    });
  }
})();
