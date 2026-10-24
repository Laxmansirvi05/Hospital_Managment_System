// Reviews section for listing pages (D-43): the source platform's rating and CareRoute
// patients' own reviews, side by side and clearly labelled.
import { h, icon, toast } from './h.js';
import { api } from './api.js';
import { ratingBlock, confirmDialog, showErrors, busy } from './ui.js';
import { dateLong } from './format.js';

function stars(n, size = 16) {
  return h('span', { class: 'stars', 'aria-label': `${n} of 5` }, [1, 2, 3, 4, 5].map((i) => h('span', { class: i <= n ? 'on' : '' }, icon('star', size))));
}

/**
 * @param {{ kind: 'hospital'|'doctor'|'pharmacy'|'diagnostic_centre', id: string, listing: any, canWrite: boolean }} o
 */
export function reviewsSection({ kind, id, listing, canWrite }) {
  const body = h('div', { class: 'stack-16' }, h('div', { class: 'skeleton skeleton-row' }));
  const section = h('section', { class: 'card stack-16', 'aria-labelledby': 'rv-h' },
    h('h2', { class: 't-title-3', id: 'rv-h' }, 'Ratings and reviews'),
    body);

  async function load() {
    let data;
    try {
      data = await api(`/reviews?kind=${kind}&id=${encodeURIComponent(id)}`);
    } catch (err) {
      body.replaceChildren(h('p', { class: 't-subhead muted' }, err.message));
      return;
    }
    const mine = data.reviews.find((r) => r.mine);
    const others = data.reviews.filter((r) => !r.mine);
    body.replaceChildren(...[
      h('div', { class: 'rating-pair' },
        h('div', { class: 'stack-8' },
          h('span', { class: 't-footnote muted strong' }, 'CareRoute patients'),
          data.summary.count
            ? h('div', { class: 'row', style: 'align-items:center' },
              h('span', { class: 't-large-title num' }, data.summary.average.toFixed(1)),
              h('div', { class: 'stack-4' }, stars(Math.round(data.summary.average), 18), h('span', { class: 't-footnote muted' }, `${data.summary.count} ${data.summary.count === 1 ? 'review' : 'reviews'}`)))
            : h('p', { class: 't-subhead muted' }, 'No reviews yet.')),
        listing.rating !== null && listing.rating !== undefined
          ? h('div', { class: 'stack-8' }, h('span', { class: 't-footnote muted strong' }, `On ${listing.source.platform}`), ratingBlock(listing))
          : null),
      canWrite ? form(mine) : null,
      others.length ? h('div', { class: 'list' }, others.map(row)) : null,
    ].filter(Boolean));
  }

  function row(r) {
    return h('article', { class: 'review' },
      h('div', { class: 'spread' },
        h('div', { class: 'row-8' }, h('span', { class: 'avatar avatar-s', 'aria-hidden': 'true' }, r.author[0] || '?'), h('span', { class: 't-headline' }, r.author), stars(r.rating)),
        h('span', { class: 't-footnote muted' }, dateLong(r.updatedAt))),
      r.body ? h('p', { class: 't-callout' }, r.body) : null,
      canWrite ? h('button', {
        class: 'link-btn t-footnote', type: 'button', style: 'justify-self:start;color:var(--text-2)',
        onclick: async () => {
          if (!(await confirmDialog({ title: 'Report this review?', text: 'Reviews reported by several patients are hidden until the CareRoute team checks them.', confirm: 'Report', danger: false }))) return;
          try {
            await api(`/reviews/${r.id}/report`, { method: 'POST' });
            toast('Thank you. The review was reported.');
          } catch (err) {
            toast(err.message);
          }
        },
      }, 'Report') : null);
  }

  function form(mine) {
    let rating = mine?.rating || 0;
    const picker = h('div', { class: 'star-picker', role: 'radiogroup', 'aria-label': 'Your rating' });
    const drawPicker = () => picker.replaceChildren(...[1, 2, 3, 4, 5].map((n) => h('button', {
      type: 'button', role: 'radio', 'aria-checked': String(rating === n), 'aria-label': `${n} of 5`, class: n <= rating ? 'on' : '',
      onclick: () => { rating = n; drawPicker(); },
    }, icon('star', 28))));
    drawPicker();
    const text = h('textarea', { class: 'textarea', id: 'review-body', maxlength: 1000, placeholder: 'What should other patients know? Waiting time, staff, cleanliness.' }, mine?.body || '');
    const message = h('p', { class: 'form-error', role: 'alert', hidden: true });
    const save = h('button', { class: 'btn btn-primary', type: 'submit' }, mine ? 'Update review' : 'Post review');
    const f = h('form', { class: 'review-form stack-12', novalidate: true },
      h('span', { class: 't-headline' }, mine ? 'Your review' : 'Write a review'),
      message, picker,
      h('label', { class: 'visually-hidden', for: 'review-body' }, 'Review'),
      text,
      h('p', { class: 't-footnote muted' }, 'Shown with your first name only. Please do not include medical details about yourself or others.'),
      h('div', { class: 'row', style: 'justify-content:space-between' },
        mine ? h('button', {
          class: 'btn btn-text btn-sm', type: 'button', style: 'color:var(--danger)',
          onclick: async () => {
            if (!(await confirmDialog({ title: 'Delete your review?' }))) return;
            try {
              await api(`/reviews/${mine.id}`, { method: 'DELETE' });
              toast('Review deleted');
              load();
            } catch (err) {
              toast(err.message);
            }
          },
        }, 'Delete') : h('span'),
        save));
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!rating) { showErrors(f, { message: 'Choose a rating from 1 to 5.' }, message); return; }
      const restore = busy(save, 'Saving');
      try {
        await api('/reviews', { method: 'PUT', body: { kind, id, rating, body: text.value } });
        toast(mine ? 'Review updated' : 'Thank you for your review');
        load();
      } catch (err) {
        restore();
        showErrors(f, err, message);
      }
    });
    return f;
  }

  load();
  return section;
}
