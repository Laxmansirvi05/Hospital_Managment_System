import { h, icon } from '../h.js';
import { api } from '../api.js';
import { shell, loadError } from '../shell.js';
import { createMap } from '../map3d.js';
import { pageHead, extLink, safeHref } from '../ui.js';
import { idParam, notFoundPage, contactCard, quickActions } from '../details.js';
import { reviewsSection } from '../reviews.js';
import { rupees, dateLong } from '../format.js';

// Chains whose published Hyderabad test prices CareRoute holds, by the listing's source.
const PRICE_PROVIDERS = { 'Vijaya Diagnostic website': 'Vijaya Diagnostic Centre' };

/** Search box over the chain's published test prices, starting with common tests. */
function testPrices(provider) {
  const input = h('input', { class: 'input', type: 'search', id: 'test-q', placeholder: 'For example thyroid' });
  const list = h('div', { class: 'list' });
  let seq = 0;
  const load = async (q) => {
    const mine = ++seq;
    let r;
    try {
      r = await api(`/test-prices?provider=${encodeURIComponent(provider)}&q=${encodeURIComponent(q)}&limit=8`);
    } catch {
      if (mine !== seq) return;
      list.replaceChildren(h('p', { class: 't-subhead muted' }, 'Test prices could not load. '), h('button', { class: 'btn btn-secondary', type: 'button', onclick: () => load(q) }, 'Try again'));
      return;
    }
    if (mine !== seq) return;
    list.replaceChildren(...(r.tests.length ? r.tests.map((t) => h('a', { class: 'price-row', href: safeHref(t.url) || undefined, target: '_blank', rel: 'noopener noreferrer' },
      h('span', { class: 'stack-4' }, h('span', { class: 't-callout' }, t.name), h('span', { class: 't-footnote muted' }, `Checked ${dateLong(t.checkedAt)}. Opens ${provider}’s website.`)),
      h('span', { class: 'row-8' }, h('span', { class: 't-headline num' }, rupees(t.priceInr)), icon('external', 16)))) : [h('p', { class: 't-subhead muted' }, 'No published price for that test.')]));
  };
  let timer;
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => load(input.value.trim() || 'blood'), 250); });
  load('blood');
  return h('section', { class: 'card stack-12' },
    h('h2', { class: 't-title-3' }, 'Test prices'),
    h('p', { class: 't-footnote muted' }, `As ${provider} publishes them for Hyderabad, including taxes. Confirm at the centre.`),
    h('label', { class: 't-subhead', for: 'test-q' }, 'Search a test'), input, list);
}

const { main, user } = await shell({ nav: 'diagnostics', title: 'Diagnostic centre' });

try {
  const c = await api(`/diagnostic-centres/${encodeURIComponent(idParam())}`);
  document.title = `${c.name} · CareRoute`;
  main.replaceChildren(h('div', { class: 'page' },
    pageHead({ art: 'diagnostic', title: c.name, crumbs: [['Diagnostic centres', '/search/diagnostics/'], [c.name]], large: false }),
    quickActions(c),
    h('div', { class: 'grid-main-side' },
      h('div', { class: 'stack-24' },
        h('section', { class: 'card card-raised hero-detail' },
          h('div', { class: 'row' },
            h('span', { class: 'tag' }, icon('clock', 14), c.hours || 'Hours not listed'),
            h('span', { class: 't-subhead muted' }, c.area)),
          c.description ? h('p', { class: 't-callout', style: 'max-width:680px' }, c.description) : null,
          c.website ? h('p', {}, extLink(c.website, `Visit ${c.website.replace(/^https?:\/\//, '')}`)) : null,
          createMap({ pins: [{ ...c.location, kind: 'diagnostic', label: c.name, showLabel: true, active: true }], tilt: 40 })),
        h('section', { class: 'card stack-12' },
          h('h2', { class: 't-title-3' }, 'Tests listed publicly'),
          c.testsListed.length
            ? h('div', { class: 'row-8' }, c.testsListed.map((t) => h('a', { class: 'tag tag-primary', href: `/search/diagnostics/?test=${encodeURIComponent(t)}` }, t)))
            : h('p', { class: 't-callout muted' }, 'No tests are listed publicly for this centre. Call or visit its website to ask.'),
          h('p', { class: 't-footnote muted' }, 'Check prices and preparation with the centre. Bookings and reports are handled by the centre, not by CareRoute.')),
        PRICE_PROVIDERS[c.source.platform] ? testPrices(PRICE_PROVIDERS[c.source.platform]) : null,
        reviewsSection({ kind: 'diagnostic_centre', id: c.id, listing: c, canWrite: user.role === 'patient' })),
      h('div', { class: 'stack-16' }, contactCard(c)))));
} catch (err) {
  if (err.status === 404) notFoundPage(main, '/search/diagnostics/', 'Search diagnostic centres');
  else loadError(main, err);
}
