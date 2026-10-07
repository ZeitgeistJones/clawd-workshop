// Keep the same live workshop and its listeners when entering focus view.
// Native dialog provides focus containment, an inert page, and Escape dismissal.

const workshop = document.getElementById('workshop');
const button = document.getElementById('focus-button');
const dialog = document.getElementById('focus-dialog');
const home = document.createComment('workshop home');
workshop.before(home);
let scrollPosition = 0;

button.addEventListener('click', () => {
  if (dialog.open) { dialog.close(); return; }
  scrollPosition = window.scrollY;
  dialog.append(workshop);
  document.documentElement.classList.add('workshop-focused');
  dialog.showModal();
  button.setAttribute('aria-pressed', 'true');
  button.setAttribute('aria-label', 'Exit workshop focus view');
  button.title = 'Exit focus view · Escape';
  button.querySelector('span').textContent = 'Exit focus';
  button.focus();
});

dialog.addEventListener('close', () => {
  home.after(workshop);
  document.documentElement.classList.remove('workshop-focused');
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-label', 'Enlarge the workshop');
  button.title = 'Enlarge the workshop';
  button.querySelector('span').textContent = 'Focus view';
  window.scrollTo({ top: scrollPosition, behavior: 'instant' });
  button.focus({ preventScroll: true });
});

dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
});
