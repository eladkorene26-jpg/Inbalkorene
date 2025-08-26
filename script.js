// שנה לפוטר
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Toggle nav (mobile)
const navBtn = document.querySelector('.nav-toggle');
const mainNav = document.getElementById('site-nav');
if (navBtn && mainNav) {
  navBtn.addEventListener('click', ()=>{
    const open = navBtn.getAttribute('aria-expanded') === 'true';
    navBtn.setAttribute('aria-expanded', String(!open));
    mainNav.setAttribute('aria-expanded', String(!open));
  });
}

// Smooth anchor scroll + close menu after click
document.querySelectorAll('a[href^="#"]').forEach(a=>{
  a.addEventListener('click', (e)=>{
    const id = a.getAttribute('href').slice(1);
    if(!id) return;
    const el = document.getElementById(id);
    if(el){ e.preventDefault(); el.scrollIntoView({behavior:'smooth', block:'start'}); }
    if (mainNav && navBtn) {
      mainNav.setAttribute('aria-expanded', 'false');
      navBtn.setAttribute('aria-expanded', 'false');
    }
  });
});

// Generic carousel setup
function setupCarousel(root){
  const track = root.querySelector('.car-track');
  const prev = root.querySelector('.prev');
  const next = root.querySelector('.next');
  const dotsWrap = root.querySelector('.car-dots');
  if (!track || !prev || !next || !dotsWrap) return;

  function pages(){ return Math.max(1, Math.ceil(track.scrollWidth / track.clientWidth)); }
  function indexFromScroll(){ return Math.round(track.scrollLeft / track.clientWidth); }
  function renderDots(){
    dotsWrap.innerHTML = '';
    const total = pages();
    for(let i=0;i<total;i++){
      const b = document.createElement('button');
      if(i===indexFromScroll()) b.setAttribute('aria-current','true');
      b.addEventListener('click', ()=> track.scrollTo({left: i*track.clientWidth, behavior:'smooth'}));
      dotsWrap.appendChild(b);
    }
  }
  function go(dir){ track.scrollBy({left: dir*track.clientWidth, behavior:'smooth'}); }

  prev.addEventListener('click', ()=> go(-1));
  next.addEventListener('click', ()=> go(1));
  track.addEventListener('scroll', renderDots);
  window.addEventListener('resize', renderDots);

  // drag support
  let isDown=false, startX=0, scrollLeft=0;
  track.addEventListener('pointerdown', (e)=>{ isDown=true; startX=e.pageX; scrollLeft=track.scrollLeft; track.setPointerCapture(e.pointerId); });
  track.addEventListener('pointermove', (e)=>{ if(!isDown) return; const dx=e.pageX - startX; track.scrollLeft = scrollLeft - dx; });
  ['pointerup','pointercancel','pointerleave'].forEach(ev=> track.addEventListener(ev, ()=>{ isDown=false; }));

  renderDots();
}
document.querySelectorAll('.carousel').forEach(setupCarousel);

// Instagram embed process after load
function processIG(){
  if (window.instgrm && window.instgrm.Embeds) window.instgrm.Embeds.process();
}
if (document.readyState === 'complete') processIG();
else window.addEventListener('load', processIG);
