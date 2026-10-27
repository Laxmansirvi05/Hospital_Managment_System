import { h, icon } from './h.js';
import { api } from './api.js';

const TILE = 256;
const MIN_ZOOM = 7;
const MAX_ZOOM = 16;
const DEFAULT_CENTER = { lat: 17.385, lng: 78.487 };
const KIND = {
  c: { label: 'Hospitals and clinics', short: 'Care', icon: 'hospital', color: 'blue', href: (x) => `/hospital/?id=${encodeURIComponent(x.id)}` },
  p: { label: 'Pharmacies', short: 'Pharmacies', icon: 'pharmacy', color: 'orange', href: (x) => `/pharmacy/?id=${encodeURIComponent(x.id)}` },
  d: { label: 'Diagnostic centres', short: 'Diagnostics', icon: 'flask', color: 'green', href: (x) => `/diagnostic/?id=${encodeURIComponent(x.id)}` },
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const validCoordinate = (lat, lng) => Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
  && Number(lat) >= -90 && Number(lat) <= 90 && Number(lng) >= -180 && Number(lng) <= 180;
const validLocation = (x) => x && validCoordinate(x.lat, x.lng);

function phoneHref(phone) {
  const value = String(phone || '').trim();
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 ? `tel:${value.replace(/[^+\d]/g, '')}` : null;
}

function websiteHref(website) {
  const value = String(website || '').trim();
  if (!value) return null;
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    const host = url.hostname.toLowerCase();
    const reservedHost = ['example.com', 'example.org', 'example.net'].includes(host) || /(?:^|\.)(?:example|invalid|localhost|test)$/i.test(host);
    if (!['http:', 'https:'].includes(url.protocol) || !host || reservedHost) return null;
    return url.href;
  } catch {
    return null;
  }
}

function project({ lat, lng }, zoom) {
  const scale = TILE * 2 ** zoom;
  const sin = clamp(Math.sin((Number(lat) * Math.PI) / 180), -0.9999, 0.9999);
  return {
    x: ((Number(lng) + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

function unproject({ x, y }, zoom) {
  const scale = TILE * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  return { lat: (180 / Math.PI) * Math.atan(Math.sinh(n)), lng };
}

function mapTileUrl(style, z, x, y, maptilerKey) {
  if (style === 'standard' && maptilerKey) return `https://api.maptiler.com/maps/streets-v2/${z}/${x}/${y}.png?key=${encodeURIComponent(maptilerKey)}`;
  if (style === 'standard') return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
}

function referenceTileUrl(layer, z, x, y) {
  const service = layer === 'transportation' ? 'World_Transportation' : 'World_Boundaries_and_Places';
  return `https://server.arcgisonline.com/ArcGIS/rest/services/Reference/${service}/MapServer/tile/${z}/${y}/${x}`;
}

function locationLabel(x) {
  return KIND[x.kind]?.label || 'Healthcare location';
}

function markerFor(location, onSelect) {
  const meta = KIND[location.kind] || KIND.c;
  const button = h('button', { class: `geo-marker marker-${meta.color}`, type: 'button', 'aria-label': `${location.name}, ${locationLabel(location)}` }, icon(meta.icon, 18));
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onSelect(location);
  });
  return button;
}

function clusterFor(group, onSelect) {
  const kinds = [...new Set(group.map((x) => x.kind))];
  const button = h('button', { class: `geo-cluster ${kinds.length > 1 ? 'geo-cluster-mixed' : `marker-${KIND[group[0].kind]?.color || 'blue'}`}`, type: 'button', 'aria-label': `${group.length} healthcare locations` }, h('span', { class: 'geo-cluster-count' }, group.length.toLocaleString('en-IN')));
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onSelect(group);
  });
  return button;
}

const detailPath = (location) => ({ c: `/hospitals/${encodeURIComponent(location.id)}`, p: `/pharmacies/${encodeURIComponent(location.id)}`, d: `/diagnostic-centres/${encodeURIComponent(location.id)}` }[location.kind]);

function directionsHref(location) {
  if (validCoordinate(location.lat, location.lng)) return `https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`;
  if (location.address?.trim()) return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location.address.trim())}`;
  return null;
}

function popupFor(location, onClose) {
  const meta = KIND[location.kind] || KIND.c;
  const phone = phoneHref(location.phone);
  const website = websiteHref(location.website);
  const directions = directionsHref(location);
  const close = h('button', { class: 'icon-btn geo-popup-close', type: 'button', 'aria-label': 'Close location details' }, icon('close', 18));
  close.addEventListener('click', onClose);
  const details = h('div', { class: 'stack-8 geo-popup-details' },
    h('span', { class: `geo-popup-category marker-text-${meta.color}` }, locationLabel(location)),
    h('h3', { class: 'geo-popup-title' }, location.name),
    location.area ? h('p', { class: 'geo-popup-line' }, location.area) : null,
    location.address ? h('p', { class: 'geo-popup-line muted' }, location.address) : null,
    phone ? h('a', { class: 'geo-popup-line geo-popup-link', href: phone }, location.phone) : null,
    location.rating ? h('span', { class: 'geo-popup-line' }, `Rated ${location.rating}${location.ratingCount ? ` · ${location.ratingCount.toLocaleString('en-IN')} reviews` : ''}`) : null,
  );
  const actions = h('div', { class: 'row-8 geo-popup-actions' },
    phone ? h('a', { class: 'btn btn-secondary btn-sm', href: phone }, 'Call') : null,
    directions ? h('a', { class: 'btn btn-secondary btn-sm', href: directions, target: '_blank', rel: 'noopener noreferrer' }, 'Directions', icon('external', 14)) : h('span', { class: 'geo-popup-unavailable' }, 'Directions unavailable'),
    h('a', { class: 'btn btn-primary btn-sm', href: meta.href(location) }, 'View details'),
    website ? h('a', { class: 'btn btn-secondary btn-sm', href: website, target: '_blank', rel: 'noopener noreferrer' }, 'Website', icon('external', 14)) : null);
  const panel = h('aside', { class: 'geo-popup', role: 'dialog', 'aria-label': `${location.name} details` }, close, details, actions);
  panel.detailsHost = details;
  return panel;
}

function detailRows(location, detail) {
  const meta = KIND[location.kind] || KIND.c;
  const phone = detail.phone || location.phone;
  const phoneLink = phoneHref(phone);
  const area = detail.area || location.area;
  const address = detail.address || location.address;
  const rating = detail.rating ?? location.rating;
  const ratingCount = detail.ratingCount ?? location.ratingCount;
  const rows = [
    area ? h('p', { class: 'geo-popup-line' }, area) : null,
    address ? h('p', { class: 'geo-popup-line muted' }, address) : null,
    phoneLink ? h('a', { class: 'geo-popup-line geo-popup-link', href: phoneLink }, phone) : null,
    rating ? h('span', { class: 'geo-popup-line' }, `Rated ${rating}${ratingCount ? ` · ${Number(ratingCount).toLocaleString('en-IN')} reviews` : ''}`) : null,
    detail.description ? h('p', { class: 'geo-popup-description' }, detail.description) : null,
    detail.hours ? h('p', { class: 'geo-popup-line' }, h('strong', {}, 'Hours: '), detail.hours) : null,
    detail.open24 === true ? h('p', { class: 'geo-popup-line geo-popup-positive' }, 'Open 24 hours') : null,
    detail.chain ? h('p', { class: 'geo-popup-line' }, h('strong', {}, 'Chain: '), detail.chain) : null,
    detail.emergencyAvailable === true ? h('p', { class: 'geo-popup-line geo-popup-positive' }, 'Emergency department listed') : null,
    detail.emergencyAvailable === false ? h('p', { class: 'geo-popup-line muted' }, 'Emergency department not listed') : null,
  ];
  const list = detail.specialities?.length ? h('div', { class: 'geo-popup-list' }, h('strong', {}, 'Specialities'), h('div', { class: 'row-4' }, detail.specialities.map((x) => h('span', { class: 'tag tag-primary' }, x)))) : null;
  const departments = detail.departments?.length ? h('div', { class: 'geo-popup-list' }, h('strong', {}, 'Departments'), h('div', { class: 'row-4' }, detail.departments.map((x) => h('span', { class: 'tag' }, x)))) : null;
  const tests = detail.testsListed?.length ? h('div', { class: 'geo-popup-list' }, h('strong', {}, 'Tests listed'), h('div', { class: 'row-4' }, detail.testsListed.slice(0, 8).map((x) => h('span', { class: 'tag' }, x)))) : null;
  return [h('span', { class: `geo-popup-category marker-text-${meta.color}` }, locationLabel(location)), h('h3', { class: 'geo-popup-title' }, detail.name || location.name), ...rows, list, departments, tests].filter(Boolean);
}

/**
 * Tile-backed Hyderabad map for the Explore page. The data layer is intentionally separate from
 * the tile layer: locations come from CareRoute, while roads, names and boundaries come from the
 * selected map provider. This keeps marker coordinates truthful and map navigation lightweight.
 */
export function createExploreMap({ locations = [], maptilerKey = null, error = null, onRetry = null } = {}) {
  let all = locations.filter(validLocation).map((x) => ({ ...x, lat: Number(x.lat), lng: Number(x.lng) }));
  let dataError = error;
  const state = { center: { ...DEFAULT_CENTER }, zoom: 10, style: 'standard', visible: new Set(['c', 'p', 'd']), selected: null, origin: null };
  const tileNodes = new Map();
  let dragging = null;
  let raf = 0;
  let searchTimer = 0;
  let tileLoaded = false;
  let tileErrors = 0;
  let detailRequest = 0;

  const map = h('div', { class: 'geo-map', tabindex: '0', 'aria-label': 'Interactive map of healthcare locations in Hyderabad' });
  const toolbar = h('div', { class: 'geo-map-toolbar' });
  const search = h('input', { class: 'input geo-map-search', type: 'search', placeholder: 'Search places or localities', 'aria-label': 'Search facilities or Hyderabad localities', autocomplete: 'off' });
  const searchWrap = h('div', { class: 'geo-map-search-wrap' }, icon('search', 18), search);
  const searchResults = h('div', { class: 'geo-map-search-results', hidden: true });
  searchWrap.append(searchResults);
  const styleButtons = h('div', { class: 'geo-map-styles', role: 'group', 'aria-label': 'Map style' });
  const styleLabels = { standard: 'Map', satellite: 'Satellite', hybrid: 'Hybrid' };
  for (const [key, label] of Object.entries(styleLabels)) {
    const button = h('button', { class: 'geo-map-style', type: 'button', 'aria-pressed': key === state.style }, label);
    button.addEventListener('click', () => {
      state.style = key;
      tileNodes.clear();
      tileLoaded = false;
      tileErrors = 0;
      loading.textContent = 'Loading map tiles…';
      loading.hidden = false;
      for (const sibling of styleButtons.children) sibling.setAttribute('aria-pressed', String(sibling === button));
      render();
    });
    styleButtons.append(button);
  }
  toolbar.append(searchWrap, styleButtons);

  const viewport = h('div', { class: 'geo-map-viewport' });
  const tileLayer = h('div', { class: 'geo-map-tiles', 'aria-hidden': 'true' });
  const markerLayer = h('div', { class: 'geo-map-markers' });
  const popupLayer = h('div', { class: 'geo-map-popups' });
  const loading = h('div', { class: 'geo-map-message' }, 'Loading Hyderabad map…');
  const dataNotice = h('div', { class: 'geo-map-data-notice', role: 'status', hidden: !dataError });
  const controls = h('div', { class: 'geo-map-controls', role: 'group', 'aria-label': 'Map controls' });
  const zoomIn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Zoom in' }, icon('plus', 18));
  const zoomOut = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Zoom out' }, icon('minus', 18));
  const reset = h('button', { class: 'geo-map-control-text', type: 'button' }, 'Reset');
  const fullscreen = h('button', { class: 'geo-map-control-text', type: 'button' }, 'Full screen');
  const locate = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Use current location' }, icon('locate', 18));
  controls.append(zoomIn, zoomOut, reset, fullscreen, locate);
  const attribution = h('div', { class: 'geo-map-attribution' });
  const legend = h('div', { class: 'geo-map-legend', role: 'group', 'aria-label': 'Map filters' });
  const count = h('span', { class: 'geo-map-count' });

  const renderDataNotice = () => {
    if (!dataError) {
      dataNotice.hidden = true;
      dataNotice.replaceChildren();
      return;
    }
    const retry = h('button', { class: 'btn btn-primary btn-sm', type: 'button' }, 'Retry');
    const message = h('p', { class: 'geo-map-data-message' }, 'Healthcare locations could not load. The base map is still available.');
    retry.addEventListener('click', async () => {
      if (!onRetry) return;
      retry.disabled = true;
      retry.textContent = 'Retrying…';
      try {
        const result = await onRetry();
        all = (result.locations || []).filter(validLocation).map((x) => ({ ...x, lat: Number(x.lat), lng: Number(x.lng) }));
        dataError = null;
        renderDataNotice();
        renderLegend();
        render();
      } catch {
        retry.disabled = false;
        retry.textContent = 'Retry';
        message.textContent = 'Healthcare locations are still unavailable. Try again.';
      }
    });
    dataNotice.replaceChildren(message, retry);
    dataNotice.hidden = false;
  };

  const updateAttribution = () => {
    attribution.replaceChildren(
      state.style === 'standard' && maptilerKey
        ? h('span', {}, '© MapTiler · © OpenStreetMap contributors')
        : state.style === 'standard'
          ? h('span', {}, '© OpenStreetMap contributors')
          : h('span', {}, 'Source: Esri, Maxar, Earthstar Geographics · © OpenStreetMap contributors'),
    );
  };

  const clearSelection = () => {
    detailRequest += 1;
    state.selected = null;
    map.classList.remove('has-popup');
    popupLayer.replaceChildren();
    renderMarkers();
  };

  const selectLocation = (location) => {
    if (Array.isArray(location)) {
      if (!location.length) return;
      const center = location.reduce((a, x) => ({ lat: a.lat + x.lat, lng: a.lng + x.lng }), { lat: 0, lng: 0 });
      state.center = { lat: center.lat / location.length, lng: center.lng / location.length };
      state.zoom = clamp(state.zoom + 2, MIN_ZOOM, MAX_ZOOM);
      detailRequest += 1;
      state.selected = null;
      map.classList.remove('has-popup');
      popupLayer.replaceChildren();
      render();
      return;
    }
    state.selected = location;
    map.classList.add('has-popup');
    const request = ++detailRequest;
    const panel = popupFor(location, clearSelection);
    popupLayer.replaceChildren(panel);
    renderMarkers();
    positionPopup();
    const path = detailPath(location);
    if (!path) return;
    const detailHost = panel.detailsHost;
    detailHost.append(h('p', { class: 'geo-popup-loading muted', role: 'status' }, 'Loading facility details…'));
    api(path).then((detail) => {
      if (request !== detailRequest || state.selected !== location) return;
      detailHost.replaceChildren(...detailRows(location, detail));
      positionPopup();
    }).catch(() => {
      if (request !== detailRequest || state.selected !== location) return;
      detailHost.append(h('p', { class: 'geo-popup-loading muted' }, 'Some facility details could not load. The saved listing details remain available.'));
    });
  };

  const renderLegend = () => {
    legend.replaceChildren(...Object.entries(KIND).map(([key, meta]) => {
      const inView = all.filter((x) => x.kind === key).length;
      const button = h('button', { class: `geo-filter geo-filter-${meta.color}`, type: 'button', 'aria-pressed': state.visible.has(key) },
        h('span', { class: 'geo-filter-dot', 'aria-hidden': 'true' }), `${meta.label} (${inView.toLocaleString('en-IN')})`);
      button.addEventListener('click', () => {
        if (state.visible.has(key)) state.visible.delete(key); else state.visible.add(key);
        button.setAttribute('aria-pressed', String(state.visible.has(key)));
        renderMarkers();
      });
      return button;
    }), count);
  };

  const visibleLocations = () => all.filter((x) => state.visible.has(x.kind));

  const geometry = () => {
    const rect = viewport.getBoundingClientRect();
    const center = project(state.center, state.zoom);
    return { width: rect.width, height: rect.height, topLeft: { x: center.x - rect.width / 2, y: center.y - rect.height / 2 } };
  };

  const renderTiles = () => {
    const { width, height, topLeft } = geometry();
    const tileZoom = Math.floor(state.zoom);
    const tileSize = TILE * 2 ** (state.zoom - tileZoom);
    const max = 2 ** tileZoom;
    const firstX = Math.floor(topLeft.x / tileSize) - 1;
    const lastX = Math.floor((topLeft.x + width) / tileSize) + 1;
    const firstY = Math.floor(topLeft.y / tileSize) - 1;
    const lastY = Math.floor((topLeft.y + height) / tileSize) + 1;
    const keys = [];
    const layers = state.style === 'hybrid' ? ['base', 'transportation', 'places'] : ['base'];
    for (const layer of layers) {
      for (let tx = firstX; tx <= lastX; tx += 1) {
        for (let ty = firstY; ty <= lastY; ty += 1) {
          if (ty < 0 || ty >= max) continue;
          const x = ((tx % max) + max) % max;
          const key = `${state.style}|${layer}|${tileZoom}|${x}|${ty}`;
          keys.push(key);
          let img = tileNodes.get(key);
          if (!img) {
            img = document.createElement('img');
            img.className = `geo-map-tile geo-map-tile-${layer}`;
            img.alt = '';
            img.draggable = false;
            img.decoding = 'async';
            img.loading = 'eager';
            img.addEventListener('load', () => { tileLoaded = true; loading.hidden = true; });
            img.addEventListener('error', () => {
              img.classList.add('is-error');
              tileErrors += 1;
              if (!tileLoaded && tileErrors >= 4) {
                loading.textContent = 'Map tiles could not load. Check your connection and try again.';
                loading.hidden = false;
              }
            });
            img.src = layer === 'base' ? mapTileUrl(state.style, tileZoom, x, ty, maptilerKey) : referenceTileUrl(layer, tileZoom, x, ty);
            tileNodes.set(key, img);
          }
          img.style.width = `${tileSize}px`;
          img.style.height = `${tileSize}px`;
          img.style.left = `${tx * tileSize - topLeft.x}px`;
          img.style.top = `${ty * tileSize - topLeft.y}px`;
        }
      }
    }
    const keySet = new Set(keys);
    for (const [key, node] of tileNodes) {
      if (!keySet.has(key)) {
        node.remove();
        tileNodes.delete(key);
      }
    }
    tileLayer.replaceChildren(...keys.map((key) => tileNodes.get(key)));
    updateAttribution();
  };

  const positionPopup = () => {
    if (!state.selected || !popupLayer.firstElementChild) return;
    const { width, height, topLeft } = geometry();
    const p = project(state.selected, state.zoom);
    const x = p.x - topLeft.x;
    const y = p.y - topLeft.y;
    const popup = popupLayer.firstElementChild;
    const popupWidth = Math.min(320, Math.max(250, width - 24));
    const popupHeight = Math.min(popup.offsetHeight || 260, height - 24);
    popup.style.width = `${popupWidth}px`;
    popup.style.left = `${clamp(x + 16, 12, Math.max(12, width - popupWidth - 12))}px`;
    popup.style.top = `${clamp(y - 24, 12, Math.max(12, height - popupHeight - 12))}px`;
  };

  const renderMarkers = () => {
    const { width, height, topLeft } = geometry();
    const visible = visibleLocations();
    const projected = visible.map((location) => ({ location, point: project(location, state.zoom) })).filter(({ point }) => point.x >= topLeft.x - 40 && point.x <= topLeft.x + width + 40 && point.y >= topLeft.y - 40 && point.y <= topLeft.y + height + 40);
    const groups = new Map();
    const shouldCluster = state.zoom < 13;
    for (const item of projected) {
      const x = item.point.x - topLeft.x;
      const y = item.point.y - topLeft.y;
      const key = shouldCluster ? `${Math.floor(x / 48)}:${Math.floor(y / 48)}` : `${item.location.id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    markerLayer.replaceChildren();
    for (const group of groups.values()) {
      const locationsInGroup = group.map((x) => x.location);
      const point = group.reduce((a, x) => ({ x: a.x + x.point.x, y: a.y + x.point.y }), { x: 0, y: 0 });
      const node = locationsInGroup.length > 1 ? clusterFor(locationsInGroup, selectLocation) : markerFor(locationsInGroup[0], selectLocation);
      node.style.left = `${point.x / group.length - topLeft.x}px`;
      node.style.top = `${point.y / group.length - topLeft.y}px`;
      node.classList.toggle('is-selected', Boolean(state.selected && locationsInGroup.some((x) => x.id === state.selected.id)));
      markerLayer.append(node);
    }
    if (state.origin) {
      const originPoint = project(state.origin, state.zoom);
      if (originPoint.x >= topLeft.x - 24 && originPoint.x <= topLeft.x + width + 24 && originPoint.y >= topLeft.y - 24 && originPoint.y <= topLeft.y + height + 24) {
        const origin = h('span', { class: 'geo-origin', role: 'img', 'aria-label': 'Your current location' }, icon('locate', 18));
        origin.style.left = `${originPoint.x - topLeft.x}px`;
        origin.style.top = `${originPoint.y - topLeft.y}px`;
        markerLayer.append(origin);
      }
    }
    count.textContent = `${visible.length.toLocaleString('en-IN')} mapped locations`;
    positionPopup();
  };

  const render = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => { renderTiles(); renderMarkers(); });
  };

  let zoomAnimation = 0;
  const zoomAt = (next, anchorX = viewport.clientWidth / 2, anchorY = viewport.clientHeight / 2) => {
    const before = geometry();
    const anchor = unproject({ x: before.topLeft.x + anchorX, y: before.topLeft.y + anchorY }, state.zoom);
    state.zoom = clamp(next, MIN_ZOOM, MAX_ZOOM);
    const after = project(anchor, state.zoom);
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    state.center = unproject({ x: after.x - anchorX + width / 2, y: after.y - anchorY + height / 2 }, state.zoom);
    render();
  };

  const animateZoom = (next, anchorX = viewport.clientWidth / 2, anchorY = viewport.clientHeight / 2, duration = 180) => {
    cancelAnimationFrame(zoomAnimation);
    const start = state.zoom;
    const target = clamp(next, MIN_ZOOM, MAX_ZOOM);
    if (Math.abs(target - start) < 0.001) return;
    const started = performance.now();
    const tick = (now) => {
      const progress = clamp((now - started) / duration, 0, 1);
      const eased = 1 - (1 - progress) ** 3;
      zoomAt(start + (target - start) * eased, anchorX, anchorY);
      if (progress < 1) zoomAnimation = requestAnimationFrame(tick);
    };
    zoomAnimation = requestAnimationFrame(tick);
  };

  const resetMap = () => {
    state.center = { ...DEFAULT_CENTER };
    state.zoom = 10;
    state.visible = new Set(Object.keys(KIND));
    detailRequest += 1;
    state.selected = null;
    popupLayer.replaceChildren();
    renderLegend();
    render();
  };
  zoomIn.addEventListener('click', () => animateZoom(state.zoom + 1));
  zoomOut.addEventListener('click', () => animateZoom(state.zoom - 1));
  reset.addEventListener('click', resetMap);
  fullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (map.requestFullscreen) await map.requestFullscreen();
      else map.classList.toggle('is-fullscreen');
    } catch {
      map.classList.toggle('is-fullscreen');
    }
    render();
  });
  document.addEventListener('fullscreenchange', () => {
    const active = document.fullscreenElement === map || map.classList.contains('is-fullscreen');
    fullscreen.textContent = active ? 'Exit full screen' : 'Full screen';
    render();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.fullscreenElement === map) {
      event.preventDefault();
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }
  });
  locate.addEventListener('click', () => {
    if (!navigator.geolocation) return;
    locate.disabled = true;
    navigator.geolocation.getCurrentPosition((position) => {
      state.origin = { lat: position.coords.latitude, lng: position.coords.longitude };
      state.center = { ...state.origin };
      state.zoom = Math.max(state.zoom, 13);
      locate.disabled = false;
      render();
    }, () => {
      locate.disabled = false;
      loading.textContent = 'Location permission was not granted.';
      loading.hidden = false;
      window.setTimeout(() => { loading.hidden = true; }, 3000);
    }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
  });

  viewport.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    if (event.target.closest?.('button, a, input')) return;
    dragging = { x: event.clientX, y: event.clientY, center: project(state.center, state.zoom) };
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add('is-dragging');
  });
  viewport.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const dx = event.clientX - dragging.x;
    const dy = event.clientY - dragging.y;
    state.center = unproject({ x: dragging.center.x - dx, y: dragging.center.y - dy }, state.zoom);
    render();
  });
  const stopDragging = (event) => {
    if (!dragging) return;
    dragging = null;
    viewport.classList.remove('is-dragging');
    if (event.pointerId !== undefined && viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
  };
  viewport.addEventListener('pointerup', stopDragging);
  viewport.addEventListener('pointercancel', stopDragging);
  viewport.addEventListener('click', (event) => { if (event.target === viewport || event.target === tileLayer) clearSelection(); });
  popupLayer.addEventListener('pointerdown', (event) => event.stopPropagation());
  popupLayer.addEventListener('click', (event) => event.stopPropagation());
  viewport.addEventListener('wheel', (event) => {
    event.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const unit = event.deltaMode === 1 ? 20 : event.deltaMode === 2 ? viewport.clientHeight : 500;
    const delta = clamp(-event.deltaY / unit, -0.35, 0.35) * (event.ctrlKey ? 0.5 : 1);
    if (Math.abs(delta) > 0.001) animateZoom(state.zoom + delta, event.clientX - rect.left, event.clientY - rect.top, 120);
  }, { passive: false });
  map.addEventListener('keydown', (event) => {
    const delta = { ArrowLeft: [-80, 0], ArrowRight: [80, 0], ArrowUp: [0, -80], ArrowDown: [0, 80] }[event.key];
    if (delta) {
      event.preventDefault();
      const center = project(state.center, state.zoom);
      state.center = unproject({ x: center.x + delta[0], y: center.y + delta[1] }, state.zoom);
      render();
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      animateZoom(state.zoom + 1);
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      animateZoom(state.zoom - 1);
    }
  });
  window.addEventListener('resize', render);

  search.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      const term = search.value.trim().toLowerCase();
      if (!term) { searchResults.hidden = true; searchResults.replaceChildren(); return; }
      const matches = all.filter((x) => [x.name, x.area, x.address].filter(Boolean).join(' ').toLowerCase().includes(term)).slice(0, 6);
      searchResults.hidden = false;
      searchResults.replaceChildren(...(matches.length ? matches.map((match) => {
        const button = h('button', { class: 'geo-search-result', type: 'button' }, h('strong', {}, match.name), h('span', {}, `${locationLabel(match)} · ${match.area}`));
        button.addEventListener('click', () => {
          state.visible.add(match.kind);
          state.center = { lat: match.lat, lng: match.lng };
          state.zoom = Math.max(state.zoom, 13);
          search.value = match.name;
          searchResults.hidden = true;
          renderLegend();
          selectLocation(match);
          render();
        });
        return button;
      }) : [h('span', { class: 'geo-search-empty' }, 'No mapped locations found')]));
    }, 180);
  });
  search.addEventListener('keydown', (event) => { if (event.key === 'Escape') { searchResults.hidden = true; search.blur(); } });

  if (navigator.permissions?.query) {
    navigator.permissions.query({ name: 'geolocation' }).then((permission) => {
      if (permission.state === 'denied') locate.hidden = true;
      permission.addEventListener?.('change', () => { locate.hidden = permission.state === 'denied'; });
    }).catch(() => {});
  }

  viewport.append(tileLayer, markerLayer, popupLayer, loading, dataNotice, controls, attribution);
  map.append(toolbar, viewport, legend);
  renderDataNotice();
  renderLegend();
  render();
  return map;
}
