(() => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const hasSda = !!(window.CSS && CSS.supports && CSS.supports('animation-timeline', 'view()'));
  document.documentElement.classList.toggle('no-sda', !hasSda);
  document.documentElement.classList.toggle('has-sda', hasSda);

  const LOADER_KEY = 'ik-loader';
  const LOADER_MS = 1150;
  const LOADER_FADE_MS = 200;
  const REEL_PIN_CUT_MS = 160;

  let lenis = null;
  let magnetCleanup = null;
  let reelPinCutDone = false;
  let reelPinCutPlayed = false;
  let lastTreatmentTitle = -1;
  let motionStarted = false;

  function loaderSeen() {
    try { return sessionStorage.getItem(LOADER_KEY) === '1'; } catch (err) { return true; }
  }

  function markLoaderSeen() {
    try { sessionStorage.setItem(LOADER_KEY, '1'); } catch (err) { /* ignore */ }
  }

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

  /* Plates crossfade across ~30% of each beat. Treatment titles hard-cut.
     Treatments use a tighter overlap so handle dissolves feel snappier. */
  const BEAT_OVERLAP = 0.3;
  const TREATMENT_OVERLAP = 0.16;

  function clearReelMotion() {
    document.querySelectorAll('.reel-plate, .beat').forEach((el) => {
      el.style.opacity = '';
      el.style.transform = '';
      el.style.visibility = '';
      el.style.pointerEvents = '';
      el.style.zIndex = '';
    });
  }

  function setIndex(reel, index) {
    const beats = Number(reel.dataset.beats || 1);
    const next = Math.max(0, Math.min(beats - 1, index));
    if (reel.dataset.active === String(next)) return;
    reel.dataset.active = String(next);
    reel.querySelectorAll('.reel-index li').forEach((li, i) => {
      if (i === next) li.setAttribute('aria-current', 'true');
      else li.removeAttribute('aria-current');
    });
  }

  function beatOpacity(t, i, n, overlap) {
    const half = overlap / 2;
    const fadeInStart = i === 0 ? 0 : i - half;
    const fadeInEnd = i === 0 ? 0 : i + half;
    const fadeOutStart = i === n - 1 ? n : i + 1 - half;
    const fadeOutEnd = i === n - 1 ? n : i + 1 + half;
    if (t < fadeInStart || t > fadeOutEnd) return 0;
    if (t >= fadeInEnd && t <= fadeOutStart) return 1;
    if (t < fadeInEnd) {
      const span = fadeInEnd - fadeInStart;
      return span <= 0 ? 1 : (t - fadeInStart) / span;
    }
    const span = fadeOutEnd - fadeOutStart;
    return span <= 0 ? 1 : (fadeOutEnd - t) / span;
  }

  function beatScale(t, i, n, overlap) {
    const half = overlap / 2;
    const visStart = i === 0 ? 0 : i - half;
    const visEnd = i === n - 1 ? n : i + 1 + half;
    const span = visEnd - visStart;
    const u = span <= 0 ? 0 : Math.min(1, Math.max(0, (t - visStart) / span));
    return 1 + 0.08 * u;
  }

  function paintLayer(el, opacity, scale, onTop) {
    const show = opacity > 0.01;
    el.style.opacity = String(opacity);
    el.style.visibility = show ? 'visible' : 'hidden';
    el.style.pointerEvents = opacity >= 0.5 ? 'auto' : 'none';
    el.style.zIndex = show ? String(onTop ? 3 : 2) : '0';
    if (scale == null) return;
    el.style.transform = 'scale(' + scale + ')';
  }

  function playSplitTitle(el) {
    if (!el || el.dataset.splitPlayed === '1') return;
    if (reduceMq.matches) return;
    if (typeof SplitType === 'undefined' || typeof gsap === 'undefined') return;
    if (el.closest('#lead-form') || el.closest('.lead-form')) return;
    el.dataset.splitPlayed = '1';
    try {
      /* Treatment titles are one hard-cut unit so hyphenated names stay intact. */
      if (el.classList.contains('cut-title')) {
        const word = document.createElement('span');
        word.className = 'split-word';
        while (el.firstChild) word.appendChild(el.firstChild);
        const clip = document.createElement('span');
        clip.className = 'split-clip';
        clip.appendChild(word);
        el.appendChild(clip);
        gsap.set(word, { yPercent: 120 });
        gsap.to(word, {
          yPercent: 0,
          duration: 0.7,
          ease: 'expo.out',
        });
        return;
      }
      const split = new SplitType(el, { types: 'words', tagName: 'span', wordClass: 'split-word' });
      if (!split.words || !split.words.length) return;
      split.words.forEach((word) => {
        const clip = document.createElement('span');
        clip.className = 'split-clip';
        word.parentNode.insertBefore(clip, word);
        clip.appendChild(word);
      });
      gsap.set(split.words, { yPercent: 120 });
      gsap.to(split.words, {
        yPercent: 0,
        duration: 0.7,
        ease: 'expo.out',
        stagger: 0.06,
      });
    } catch (err) {
      el.dataset.splitPlayed = '';
    }
  }

  function playIncomingTreatmentTitle(titles, nearest) {
    if (reduceMq.matches) return;
    if (nearest === lastTreatmentTitle) return;
    if (nearest === 0 && !reelPinCutDone) return;
    lastTreatmentTitle = nearest;
    const beat = titles[nearest];
    const target = beat && beat.querySelector('.cut-title');
    playSplitTitle(target);
  }

  function treatmentsStagePinned() {
    const stage = document.querySelector('.reel--treatments .reel-stage');
    if (!stage) return false;
    return stage.getBoundingClientRect().top <= 1;
  }

  /* 160ms #060403 dip when the treatments reel first pins — not on Hero → About. */
  function playReelPinCut() {
    if (reelPinCutPlayed || reduceMq.matches) return;
    reelPinCutPlayed = true;
    const cut = document.getElementById('film-cut');
    const titles = document.querySelectorAll('.reel--treatments .beats .beat');
    const finish = () => {
      if (cut) cut.classList.remove('is-on');
      reelPinCutDone = true;
      playIncomingTreatmentTitle(titles, 0);
    };
    if (!cut) {
      finish();
      return;
    }
    cut.classList.add('is-on');
    window.setTimeout(finish, REEL_PIN_CUT_MS);
  }

  function checkReelPinCut() {
    if (reelPinCutPlayed || reduceMq.matches) return;
    if (treatmentsStagePinned()) playReelPinCut();
  }

  function armChapterEdges() {
    if (reduceMq.matches || !('IntersectionObserver' in window)) return;
    /* About + later chapters: 80ms opacity. Treatments uses playReelPinCut instead. */
    const nodes = document.querySelectorAll('#about, #hadash, #testimonials, #visit, #shop, #lead');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || entry.target.dataset.edgePlayed === '1') return;
        entry.target.dataset.edgePlayed = '1';
        entry.target.classList.add('edge-cut');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.2 });
    nodes.forEach((el) => io.observe(el));
  }

  function playHeroTitle() {
    const h1 = document.querySelector('.hero h1');
    if (!h1 || reduceMq.matches) return;
    if (!('IntersectionObserver' in window)) {
      playSplitTitle(h1);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        playSplitTitle(h1);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.2 });
    io.observe(document.getElementById('home') || h1);
  }

  function syncReels() {
    if (reduceMq.matches) return;
    document.querySelectorAll('.reel').forEach((reel) => {
      const beats = Number(reel.dataset.beats || 1);
      const span = reel.offsetHeight - window.innerHeight;
      const progress = span <= 0
        ? 0
        : Math.min(1, Math.max(0, -reel.getBoundingClientRect().top / span));
      const t = progress * beats;
      const nearest = Math.min(beats - 1, Math.max(0, Math.round(t - 0.5)));
      setIndex(reel, nearest);

      const titles = reel.querySelectorAll('.beats .beat');
      const cutTitles = reel.classList.contains('reel--treatments');
      const overlap = cutTitles ? TREATMENT_OVERLAP : BEAT_OVERLAP;
      titles.forEach((el, i) => {
        const opacity = cutTitles
          ? (i === nearest ? 1 : 0)
          : beatOpacity(t, i, beats, overlap);
        paintLayer(el, opacity, null, i === nearest);
      });
      if (cutTitles) playIncomingTreatmentTitle(titles, nearest);

      const plates = reel.querySelectorAll('.reel-plates .reel-plate');
      if (plates.length !== beats) return;
      plates.forEach((el, i) => {
        paintLayer(el, beatOpacity(t, i, beats, overlap), beatScale(t, i, beats, overlap), i === nearest);
      });
    });
    checkReelPinCut();
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

  function startLenis() {
    if (reduceMq.matches || typeof Lenis === 'undefined' || lenis) return;
    lenis = new Lenis({
      wrapper: window,
      content: document.documentElement,
      duration: 1.1,
      lerp: 0.08,
      wheelMultiplier: 1,
      smoothWheel: true,
      syncTouch: false,
      anchors: false,
      autoRaf: true,
    });
    lenis.on('scroll', onScroll);
  }

  function destroyLenis() {
    if (!lenis) return;
    lenis.destroy();
    lenis = null;
    document.documentElement.classList.remove('lenis', 'lenis-smooth', 'lenis-scrolling', 'lenis-stopped', 'lenis-locked');
  }

  function startMagnet() {
    if (reduceMq.matches || typeof gsap === 'undefined' || magnetCleanup) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const btn = document.querySelector('.hero .btn-accent');
    if (!btn) return;
    const radius = 80;
    const maxPull = 12;
    let inside = false;
    let leaveTween = null;

    function pull(event) {
      const rect = btn.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const closestX = Math.max(rect.left, Math.min(event.clientX, rect.right));
      const closestY = Math.max(rect.top, Math.min(event.clientY, rect.bottom));
      const dist = Math.hypot(event.clientX - closestX, event.clientY - closestY);
      if (dist <= radius) {
        inside = true;
        if (leaveTween) {
          leaveTween.kill();
          leaveTween = null;
        }
        const dx = event.clientX - cx;
        const dy = event.clientY - cy;
        const x = Math.max(-maxPull, Math.min(maxPull, dx * 0.22));
        const y = Math.max(-maxPull, Math.min(maxPull, dy * 0.22));
        gsap.to(btn, { x: x, y: y, duration: 0.28, ease: 'power3.out', overwrite: 'auto' });
        return;
      }
      if (!inside) return;
      inside = false;
      leaveTween = gsap.to(btn, { x: 0, y: 0, duration: 0.4, ease: 'power3.out', overwrite: 'auto' });
    }

    window.addEventListener('pointermove', pull, { passive: true });
    magnetCleanup = () => {
      window.removeEventListener('pointermove', pull);
      gsap.set(btn, { x: 0, y: 0 });
      magnetCleanup = null;
    };
  }

  function exitLoader(then) {
    const loader = document.getElementById('film-loader');
    markLoaderSeen();
    if (!loader || !document.documentElement.classList.contains('is-booting')) {
      document.documentElement.classList.remove('is-booting');
      document.documentElement.classList.add('is-ready');
      then();
      return;
    }
    loader.classList.add('is-exiting');
    window.setTimeout(() => {
      document.documentElement.classList.remove('is-booting');
      document.documentElement.classList.add('is-ready');
      then();
    }, LOADER_FADE_MS);
  }

  function runLoader(then) {
    if (reduceMq.matches || loaderSeen()) {
      document.documentElement.classList.remove('is-booting');
      document.documentElement.classList.add('is-ready');
      then();
      return;
    }
    document.documentElement.classList.add('is-booting');
    window.setTimeout(() => exitLoader(then), LOADER_MS);
  }

  function armProductVideo() {
    document.querySelectorAll('.products-video').forEach((video) => {
      if (!video.dataset.videoBound) {
        video.dataset.videoBound = '1';
        const hideBroken = () => { video.hidden = true; };
        video.addEventListener('error', hideBroken);
        const source = video.querySelector('source');
        if (source) source.addEventListener('error', hideBroken);
      }

      if (reduceMq.matches) {
        video.pause();
        video.removeAttribute('autoplay');
        video.hidden = true;
        return;
      }

      video.hidden = false;
      video.muted = true;
      video.playsInline = true;
      video.loop = true;
      video.setAttribute('autoplay', '');

      const tryPlay = () => {
        if (reduceMq.matches || video.hidden) return;
        video.play().catch(() => { /* poster remains */ });
      };

      if (video.dataset.videoIo === '1') {
        tryPlay();
        return;
      }

      if (!('IntersectionObserver' in window)) {
        tryPlay();
        return;
      }

      video.dataset.videoIo = '1';
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (reduceMq.matches || video.hidden) {
            video.pause();
            return;
          }
          if (entry.isIntersecting) tryPlay();
          else video.pause();
        });
      }, { threshold: 0.28 });
      io.observe(video.closest('.products-hero') || video);
    });
  }

  function startMotion() {
    if (motionStarted) return;
    motionStarted = true;
    if (treatmentsStagePinned()) {
      reelPinCutPlayed = true;
      reelPinCutDone = true;
    }
    startLenis();
    playHeroTitle();
    armChapterEdges();
    startMagnet();
    revealOnce();
    markPlates();
    syncReels();
    parallaxFallback();
    armProductVideo();
  }

  function startStatic() {
    document.documentElement.classList.remove('is-booting');
    document.documentElement.classList.add('is-ready');
    destroyLenis();
    if (magnetCleanup) magnetCleanup();
    document.querySelectorAll('.plate-type').forEach((el) => { el.style.transform = ''; });
    clearReelMotion();
    revealOnce();
    syncReels();
    armProductVideo();
  }

  if (reduceMq.matches) {
    startStatic();
  } else {
    runLoader(startMotion);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  reduceMq.addEventListener('change', () => {
    if (reduceMq.matches) {
      startStatic();
      return;
    }
    motionStarted = false;
    lastTreatmentTitle = -1;
    reelPinCutPlayed = treatmentsStagePinned();
    reelPinCutDone = reelPinCutPlayed;
    startMotion();
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
    if (lenis) {
      if (open) lenis.stop();
      else lenis.start();
    }
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

  function scrollToId(id) {
    const target = document.getElementById(id);
    if (!target) return;
    if (lenis) {
      lenis.scrollTo(target, { duration: reduceMq.matches ? 0 : 1.15, offset: -12 });
      return;
    }
    target.scrollIntoView({ behavior: reduceMq.matches ? 'auto' : 'smooth', block: 'start' });
  }

  document.querySelectorAll('a[href="#hadash"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      setNav(false);
      scrollToId('hadash');
      try { history.pushState(null, '', '#hadash'); } catch (err) { /* ignore */ }
    });
  });

  function initBrochureDialog() {
    const layer = document.getElementById('brochure-layer');
    const dialog = document.getElementById('brochure-dialog');
    const title = document.getElementById('brochure-dialog-title');
    const embed = document.getElementById('brochure-embed');
    const wa = document.getElementById('brochure-wa');
    const triggers = document.querySelectorAll('a[aria-controls="brochure-dialog"]');
    if (!layer || !dialog || !title || !embed || !wa || !triggers.length) return;

    const focusSel = 'a[href], button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';
    let opener = null;
    let lastSrc = '';

    function isOpen() {
      return !layer.hasAttribute('hidden');
    }

    function lockPage(lock) {
      document.documentElement.classList.toggle('is-brochure-open', lock);
      document.body.classList.toggle('is-brochure-open', lock);
      [...document.body.children].forEach((el) => {
        if (el === layer) return;
        if (lock) el.setAttribute('inert', '');
        else el.removeAttribute('inert');
      });
      if (lenis) {
        if (lock) lenis.stop();
        else if (!document.documentElement.classList.contains('is-nav-locked')) lenis.start();
      }
    }

    function fallbackTab(src) {
      const win = window.open(src, '_blank', 'noopener');
      if (win) {
        try { win.opener = null; } catch (err) { /* ignore */ }
      }
    }

    function closeDialog() {
      if (!isOpen()) return;
      layer.classList.remove('is-open');
      layer.hidden = true;
      embed.removeAttribute('src');
      embed.src = 'about:blank';
      lastSrc = '';
      lockPage(false);
      if (opener && typeof opener.focus === 'function') opener.focus();
      opener = null;
    }

    function openDialog(trigger) {
      const src = trigger.getAttribute('href');
      if (!src) return;
      const heading = trigger.closest('article') && trigger.closest('article').querySelector('h2');
      const product = heading ? heading.textContent.trim() : (trigger.getAttribute('aria-label') || 'פרטים נוספים');
      const siblingWa = trigger.closest('.hero-ctas') && trigger.closest('.hero-ctas').querySelector('.btn-accent');
      title.textContent = product;
      embed.title = product;
      if (siblingWa && siblingWa.getAttribute('href')) wa.href = siblingWa.getAttribute('href');
      opener = trigger;
      lastSrc = src;
      embed.src = src;
      layer.hidden = false;
      layer.classList.add('is-open');
      lockPage(true);
      const closeBtn = dialog.querySelector('.brochure-x');
      if (closeBtn) closeBtn.focus();
    }

    triggers.forEach((trigger) => {
      trigger.addEventListener('click', (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        openDialog(trigger);
      });
    });

    layer.querySelectorAll('[data-brochure-close]').forEach((el) => {
      el.addEventListener('click', (event) => {
        event.preventDefault();
        closeDialog();
      });
    });

    embed.addEventListener('error', () => {
      if (!lastSrc) return;
      const src = lastSrc;
      closeDialog();
      fallbackTab(src);
    });

    window.addEventListener('keydown', (event) => {
      if (!isOpen()) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeDialog();
        return;
      }
      if (event.key !== 'Tab') return;
      const nodes = [...dialog.querySelectorAll(focusSel)].filter((el) => !el.hasAttribute('disabled'));
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  initBrochureDialog();

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
