// Shared search page: tabs, text, area and filters kept in the URL, results with distance,
// and the 3D map. Each of the three search areas (D-36) configures it.
import { h, icon, toast } from './h.js';
import { api } from './api.js';
import { createMap } from './map3d.js';
import { pageHead, skeletonList, empty, areaSelect, getOrigin, locateMe, osmCredit } from './ui.js';

/**
 * @typedef {object} Tab
 * @property {string} id
 * @property {string} label
 * @property {string} placeholder
 * @property {(params: URLSearchParams, origin: any) => string} endpoint
 * @property {string} key  response list key
 * @property {(item: any) => HTMLElement} row
 * @property {(item: any) => any} [pin]
 * @property {(params: URLSearchParams, update: Function) => HTMLElement[]} [filters]
 * @property {boolean} [usesArea]
 * @property {string} noun
 * @property {HTMLElement} [aside]
 */

/** @param {{ main: HTMLElement, title: string, sub: string, tabs: Tab[] }} o */
export async function searchPage({ main, title, sub, tabs, art }) {
  let areas = [];
  try {
    areas = (await api('/areas')).areas;
  } catch {
    // The area filter is optional; search still works without it.
  }
  let origin = getOrigin();

  const results = h('section', { class: 'card stack-16 results-card', 'aria-live': 'polite' });
  const side = h('div', { class: 'stack-16 search-side' });
  const form = h('form', { class: 'searchbar', role: 'search' });
  const originLine = h('p', { class: 't-subhead muted row-8' });

  function params() { return new URLSearchParams(location.search); }
  function currentTab() { return tabs.find((t) => t.id === params().get('tab')) || tabs[0]; }

  function update(changes, push = true) {
    const p = params();
    if (!('page' in changes)) p.delete('page');
    for (const [k, v] of Object.entries(changes)) {
      if (v === '' || v === null || v === undefined || v === false) p.delete(k);
      else p.set(k, v === true ? '1' : v);
    }
    const url = `${location.pathname}${p.toString() ? `?${p}` : ''}`;
    if (push) history.pushState(null, '', url);
    else history.replaceState(null, '', url);
    draw();
  }

  function drawOrigin() {
    originLine.replaceChildren(icon('locate', 16), `Distances from ${origin.label}. `,
      h('button', {
        class: 'link-btn', type: 'button',
        onclick: async () => {
          try {
            origin = await locateMe();
            drawOrigin();
            draw();
          } catch (err) {
            toast(err.message);
          }
        },
      }, 'Use my location'));
  }

  // Redrawing the form replaces its controls; put keyboard focus back on the one the user was on.
  const keyOf = (el) => `${el.tagName}|${el.getAttribute('aria-label') || el.id || el.textContent.trim()}`;
  function drawForm() {
    const active = form.contains(document.activeElement) ? keyOf(document.activeElement) : null;
    const p = params();
    const tab = currentTab();
    const q = h('input', { class: 'input', type: 'search', id: 'q', value: p.get('q') || '', placeholder: tab.placeholder, autocomplete: 'off' });
    const area = areaSelect(areas, p.get('area') || '');
    area.hidden = tab.usesArea === false;
    const seg = tabs.length > 1 ? h('div', { class: 'seg', role: 'tablist', 'aria-label': 'Search for' },
      tabs.map((t) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(t.id === tab.id), 'aria-pressed': String(t.id === tab.id), onclick: () => update({ tab: t.id === tabs[0].id ? '' : t.id, q: '', speciality: '', test: '', open24: '', emergency: '', type: '', chain: '', language: '', group: '', sort: '' }) }, t.label))) : null;
    form.replaceChildren(...[
      seg,
      h('div', { class: 'searchbar-row' },
        h('label', { class: 'input-icon' }, h('span', { class: 'visually-hidden' }, 'Search'), icon('search'), q),
        area,
        h('button', { class: 'btn btn-primary', type: 'submit' }, 'Search')),
      tab.filters ? h('div', { class: 'row-8 filter-row', role: 'group', 'aria-label': 'Filters' }, tab.filters(p, update)) : null,
    ].filter(Boolean));
    form.onsubmit = (e) => { e.preventDefault(); update({ q: q.value.trim(), area: area.hidden ? '' : area.value }); };
    if (active) [...form.querySelectorAll('button, select, input')].find((el) => keyOf(el) === active)?.focus();
  }

  let seq = 0;
  async function draw() {
    drawForm();
    const tab = currentTab();
    const p = params();
    const mine = ++seq;
    results.replaceChildren(skeletonList(4));
    side.replaceChildren(tab.aside || h('div', { class: 'skeleton skeleton-block skeleton-block-l' }));
    // Pages of PAGE results. One extra row is asked for only to know whether a next page exists.
    const page = Math.max(1, Math.min(250, Number.parseInt(p.get('page') || '1', 10) || 1));
    const u = new URL(tab.endpoint(p, origin), location.origin);
    u.searchParams.set('limit', String(PAGE + 1));
    if (page > 1) u.searchParams.set('offset', String((page - 1) * PAGE));
    let data;
    try {
      data = await api(`${u.pathname.replace(/^\/api\/v1/, '')}${u.search}`);
    } catch (err) {
      if (mine !== seq) return;
      results.replaceChildren(empty({ iconName: 'alert', title: 'Search did not work', text: err.message, action: h('button', { class: 'btn btn-primary', type: 'button', onclick: draw }, 'Try again') }));
      return;
    }
    if (mine !== seq) return;
    const rows = data[tab.key];
    const hasNext = rows.length > PAGE;
    const list = rows.slice(0, PAGE);
    const q = p.get('q');
    const filtersOn = [...p.keys()].some((k) => k !== 'tab' && k !== 'page');
    const plural = tab.plural || `${tab.noun}s`;
    // The server counts everything that matches the search and filters, not just this page.
    const total = typeof data.total === 'number' ? data.total : list.length;
    const pages = Math.max(1, Math.ceil(total / PAGE));
    const heading = h('h2', { class: 't-title-2' }, `${total.toLocaleString('en-IN')} ${total === 1 ? tab.noun : plural}`);
    const go = (n) => { update({ page: n === 1 ? '' : String(n) }); results.scrollIntoView({ block: 'start' }); };
    const pager = page > 1 || hasNext ? h('nav', { class: 'pager', 'aria-label': 'Pages' },
      h('button', { class: 'btn btn-secondary', type: 'button', disabled: page === 1, onclick: () => go(page - 1) }, icon('back', 18), 'Previous'),
      h('span', { class: 't-subhead muted', 'aria-current': 'page' }, `Page ${page} of ${pages}`),
      h('button', { class: 'btn btn-secondary', type: 'button', disabled: !hasNext, onclick: () => go(page + 1) }, 'Next', icon('chevron', 18))) : null;
    results.replaceChildren(...[
      h('div', { class: 'spread' },
        heading,
        filtersOn ? h('button', { class: 'btn btn-text btn-sm', type: 'button', onclick: () => update({ q: '', area: '', speciality: '', test: '', open24: '', emergency: '', type: '', chain: '', language: '', group: '', sort: '' }) }, 'Clear search') : null),
      q ? h('p', { class: 't-subhead muted' }, `Matching “${q}”${p.get('area') ? ` in ${p.get('area')}` : ''}`) : null,
      tab.pin && list.length ? h('p', { class: 't-footnote muted' }, 'Nearest first.') : null,
      list.length ? h('div', { class: 'list' }, list.map(tab.row)) : empty({ title: `No ${plural} found`, text: page > 1 ? 'This page is past the end of the list.' : 'Try a shorter search, another area, or fewer filters.' }),
      pager,
      osmCredit(list),
    ].filter(Boolean));
    if (tab.pin) {
      const pins = list.slice(0, 10).map((item, i) => ({ ...tab.pin(item), showLabel: i === 0, active: i === 0 }));
      side.replaceChildren(createMap({ pins, origin }), originLine);
    }
  }

  window.addEventListener('popstate', draw);
  drawOrigin();
  main.replaceChildren(h('div', { class: 'page' },
    pageHead({ title, sub, art }),
    h('section', { class: 'card card-raised' }, form),
    h('div', { class: 'grid-main-side' }, results, side)));
  draw();
}

// Results per page. The owner asked for about 20 a page with Previous and Next.
const PAGE = 20;

export function chip(label, on, onClick) {
  return h('button', { class: `chip${on ? ' chip-on' : ''}`, type: 'button', 'aria-pressed': String(on), onclick: onClick }, on ? icon('check', 16) : null, label);
}

/** Adds the origin to a query so the server sorts by distance. */
export function withOrigin(path, params, origin, keys) {
  const q = new URLSearchParams();
  for (const k of keys) if (params.get(k)) q.set(k === 'emergency' ? 'emergencyOnly' : k, params.get(k));
  q.set('lat', String(origin.lat));
  q.set('lng', String(origin.lng));
  return `${path}?${q}`;
}
