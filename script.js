const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

const navBtn = document.querySelector('.nav-toggle');
const mainNav = document.getElementById('site-nav');

function setNavOpen(open) {
  if (!navBtn || !mainNav) return;
  navBtn.setAttribute('aria-expanded', String(open));
  navBtn.setAttribute('aria-label', open ? 'סגור תפריט' : 'פתח תפריט');
  mainNav.classList.toggle('is-open', open);
}

if (navBtn && mainNav) {
  navBtn.addEventListener('click', () => {
    const open = navBtn.getAttribute('aria-expanded') === 'true';
    setNavOpen(!open);
  });
}

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', (event) => {
    const id = anchor.getAttribute('href').slice(1);
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setNavOpen(false);
  });
});

const WA_NUMBER = '972545576117';
const leadForm = document.getElementById('lead-form');
const leadError = document.getElementById('lead-error');

if (leadForm) {
  leadForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = (document.getElementById('lead-name')?.value || '').trim();
    const phone = (document.getElementById('lead-phone')?.value || '').trim();
    const treatment = (document.getElementById('lead-treatment')?.value || '').trim();
    const message = (document.getElementById('lead-message')?.value || '').trim();

    if (!phone) {
      if (leadError) {
        leadError.textContent = 'יש למלא מספר טלפון.';
        leadError.hidden = false;
      }
      document.getElementById('lead-phone')?.focus();
      return;
    }

    if (leadError) leadError.hidden = true;

    const lines = [];
    if (name) lines.push(`שם: ${name}`);
    lines.push(`טלפון: ${phone}`);
    if (treatment) lines.push(`טיפול: ${treatment}`);
    if (message) lines.push(`הודעה: ${message}`);

    const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(lines.join('\n'))}`;
    const popup = window.open(url, '_blank');
    if (popup) {
      popup.opener = null;
    } else if (leadError) {
      leadError.textContent = 'ווטסאפ לא נפתח.';
      leadError.hidden = false;
    }
  });
}
