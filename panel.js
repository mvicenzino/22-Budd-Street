(() => {
  const panel = document.getElementById('configuration-panel');
  const open = document.getElementById('config-open');
  const close = document.getElementById('config-close');
  function setOpen(expanded, moveFocus = true) {
    panel.hidden = !expanded;
    open.hidden = expanded;
    open.setAttribute('aria-expanded', String(expanded));
    if (moveFocus) (expanded ? close : open).focus({ preventScroll: true });
  }
  close.addEventListener('click', () => setOpen(false));
  open.addEventListener('click', () => setOpen(true));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden && !document.getElementById('gallery').open) {
      setOpen(false);
    }
  });
  document.getElementById('future').addEventListener('click', event => {
    if (event.currentTarget.getAttribute('aria-pressed') === 'false') setOpen(true, false);
  });
})();
