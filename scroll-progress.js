/* Direct manipulation of the existing progress square. */
(() => {
  const thumb = document.getElementById('scroll-progress');
  if (!thumb) return;
  thumb.removeAttribute('aria-hidden');
  thumb.setAttribute('role', 'slider');
  thumb.setAttribute('aria-label', '页面滚动进度');
  thumb.setAttribute('aria-orientation', 'vertical');
  thumb.setAttribute('aria-valuemin', '0');
  thumb.setAttribute('aria-valuemax', '100');
  thumb.tabIndex = 0;
  let drag = null;
  const clamp = n => Math.max(0, Math.min(1, n));
  const maximum = () => Math.max(0, document.documentElement.scrollHeight - innerHeight);
  const travel = () => Math.max(1, innerHeight - thumb.offsetHeight);
  function sync() {
    const max = maximum(), fraction = max ? clamp(scrollY / max) : 0;
    thumb.style.transform = `translateY(${fraction * travel()}px)`;
    thumb.setAttribute('aria-valuenow', String(Math.round(fraction * 100)));
    thumb.setAttribute('aria-valuetext', `${Math.round(fraction * 100)}%`);
    thumb.setAttribute('aria-disabled', String(!max));
  }
  function seek(fraction) {
    if (document.body.classList.contains('modal-open') || window.portfolioIntro?.active) return;
    window.dispatchEvent(new Event('portfolio-progress-seek'));
    // 'auto' inherits the document's smooth scrolling; instant is deliberate.
    window.scrollTo({top: clamp(fraction) * maximum(), behavior: 'instant'});
    window.dispatchEvent(new Event('portfolio-progress-render'));
    sync();
  }
  function finish(event) {
    if (!drag || (event?.pointerId !== undefined && event.pointerId !== drag.id)) return;
    const id = drag.id;
    drag = null;
    document.documentElement.classList.remove('progress-dragging');
    if (thumb.hasPointerCapture(id)) thumb.releasePointerCapture(id);
    sync();
  }
  thumb.addEventListener('pointerdown', event => {
    if (event.button !== 0 || drag || !maximum() || document.body.classList.contains('modal-open') || window.portfolioIntro?.active) return;
    event.preventDefault();
    thumb.focus({preventScroll:true});
    drag = {id:event.pointerId, offset:event.clientY - thumb.getBoundingClientRect().top};
    thumb.setPointerCapture(event.pointerId);
    document.documentElement.classList.add('progress-dragging');
    window.dispatchEvent(new Event('portfolio-progress-seek'));
  });
  thumb.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    event.preventDefault();
    seek((event.clientY - drag.offset) / travel());
  });
  for (const type of ['pointerup','pointercancel','lostpointercapture']) thumb.addEventListener(type, finish);
  window.addEventListener('blur', () => finish());
  thumb.addEventListener('keydown', event => {
    const max = maximum();
    if (!max) return;
    const steps = {ArrowDown:40, ArrowUp:-40, PageDown:innerHeight*.9, PageUp:-innerHeight*.9};
    if (event.key === 'Home' || event.key === 'End' || event.key in steps) {
      event.preventDefault();
      seek(event.key === 'Home' ? 0 : event.key === 'End' ? 1 : (scrollY + steps[event.key]) / max);
    }
  });
  window.addEventListener('scroll', sync, {passive:true});
  window.addEventListener('resize', () => {finish();sync();});
  new ResizeObserver(sync).observe(document.body);
  sync();
})();
