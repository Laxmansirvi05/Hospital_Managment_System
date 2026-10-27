const hero = document.querySelector('.care-route-hero');
const menuButton = document.querySelector('.hero-menu-toggle');
const navLinks = document.querySelector('.hero-nav-links');
const image = document.querySelector('.hero-image');
const hotspots = [...document.querySelectorAll('.hero-hotspot')];

function animateHeading() {
  const lines = document.querySelectorAll('.hero-heading-line');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  lines.forEach((line, lineIndex) => {
    const text = line.textContent || '';
    const fragment = document.createDocumentFragment();

    [...text].forEach((character, index) => {
      const span = document.createElement('span');
      span.className = 'hero-heading-character';
      span.textContent = character === ' ' ? '\u00a0' : character;
      if (!reducedMotion) {
        span.style.setProperty('--char-delay', `${200 + lineIndex * 180 + index * 30}ms`);
      }
      fragment.append(span);
    });

    line.replaceChildren(fragment);
  });

  if (reducedMotion) hero?.classList.add('motion-reduced');
}

function setupMenu() {
  if (!menuButton || !navLinks) return;

  menuButton.addEventListener('click', () => {
    const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!isOpen));
    navLinks.classList.toggle('is-open', !isOpen);
  });

  navLinks.addEventListener('click', (event) => {
    if (!(event.target instanceof HTMLAnchorElement)) return;
    menuButton.setAttribute('aria-expanded', 'false');
    navLinks.classList.remove('is-open');
  });
}

function isCompactViewport() {
  return window.innerWidth <= 720 || window.matchMedia('(hover: none)').matches;
}

function closeHotspots(except) {
  hotspots.forEach((hotspot) => {
    if (hotspot === except) return;
    const trigger = hotspot.querySelector('.hotspot-trigger');
    if (!trigger) return;
    trigger.setAttribute('aria-expanded', 'false');
    hotspot.classList.remove('is-open');
  });
}

function setupHotspots() {
  hotspots.forEach((hotspot) => {
    const trigger = hotspot.querySelector('.hotspot-trigger');
    const route = hotspot.dataset.route;
    if (!trigger || !route) return;

    trigger.addEventListener('click', () => {
      if (!isCompactViewport()) {
        window.location.href = route;
        return;
      }

      const isOpen = trigger.getAttribute('aria-expanded') === 'true';
      if (isOpen) {
        window.location.href = route;
        return;
      }

      closeHotspots(hotspot);
      trigger.setAttribute('aria-expanded', 'true');
      hotspot.classList.add('is-open');
    });
  });

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element) || event.target.closest('.hero-hotspot')) return;
    closeHotspots();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const openTrigger = document.querySelector('.hotspot-trigger:focus, .hotspot-trigger[aria-expanded="true"]');
    closeHotspots();
    openTrigger?.blur();
  });
}

function objectPositionValue(value, availableSpace) {
  if (value.endsWith('%')) return (Number.parseFloat(value) / 100) * availableSpace;
  if (value.endsWith('px')) return Number.parseFloat(value);
  return availableSpace / 2;
}

function positionHotspots() {
  if (!(hero instanceof HTMLElement) || !(image instanceof HTMLImageElement) || !image.naturalWidth) return;

  const bounds = hero.getBoundingClientRect();
  const compact = isCompactViewport();
  const tablet = window.innerWidth > 720 && window.innerWidth <= 1100;
  const mobile = window.innerWidth <= 720;
  const scale = Math.max(bounds.width / image.naturalWidth, bounds.height / image.naturalHeight);
  const renderedWidth = image.naturalWidth * scale;
  const renderedHeight = image.naturalHeight * scale;
  const position = getComputedStyle(image).objectPosition.split(' ');
  const offsetX = objectPositionValue(position[0] || '50%', bounds.width - renderedWidth);
  const offsetY = objectPositionValue(position[1] || '50%', bounds.height - renderedHeight);

  hotspots.forEach((hotspot) => {
    const x = Number.parseFloat(hotspot.dataset.x || '0.5');
    const y = Number.parseFloat(hotspot.dataset.y || '0.5');
    const imageLeft = offsetX + x * renderedWidth;
    const left = compact ? Math.min(Math.max(imageLeft, 64), bounds.width - 64) : imageLeft;
    hotspot.classList.toggle('is-detached', compact && left !== imageLeft);
    hotspot.style.setProperty('--hotspot-left', `${left}px`);
    const top = offsetY + y * renderedHeight + (tablet ? -72 : mobile ? -90 : 0);
    hotspot.style.setProperty('--hotspot-top', `${top}px`);
  });
}

function setupImageAlignment() {
  if (!(image instanceof HTMLImageElement)) return;
  if (image.complete) positionHotspots();
  image.addEventListener('load', positionHotspots, { once: true });
  window.addEventListener('resize', positionHotspots, { passive: true });
  window.visualViewport?.addEventListener('resize', positionHotspots, { passive: true });
}

animateHeading();
setupMenu();
setupHotspots();
setupImageAlignment();
requestAnimationFrame(() => hero?.classList.add('is-ready'));
