import { api } from '/js/api.js';
import { h, toast, pageHead, tag, when, KIND_SHORT, pager, confirmDialog, errorNotice, loading, field } from '/admin/lib.js';

const LIMIT = 20;

export async function render(page, { announce }) {
  const qs = new URLSearchParams((location.hash.split('?')[1]) || '');
  const state = { status: ['hidden', 'reported', 'all'].includes(qs.get('status')) ? qs.get('status') : 'reported', offset: 0 };
  const list = h('div', { class: 'stack-12', 'aria-live': 'polite' });
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Which reviews' },
    [['reported', 'Reported'], ['hidden', 'Hidden'], ['all', 'Reported and hidden']].map(([v, t]) => h('button', { type: 'button', 'aria-pressed': String(v === state.status), 'data-v': v, onclick: () => { state.status = v; state.offset = 0; for (const b of seg.children) b.setAttribute('aria-pressed', String(b.dataset.v === v)); load(); } }, t)));

  async function load() {
    list.replaceChildren(loading());
    let data;
    try { data = await api(`/admin/reviews?status=${state.status}&limit=${LIMIT}&offset=${state.offset}`); } catch (err) { list.replaceChildren(errorNotice(err, load)); return; }
    list.replaceChildren(
      ...(data.reviews.length ? data.reviews.map(card) : [h('p', { class: 'admin-empty t-subhead muted' }, state.status === 'reported' ? 'No reported reviews. Nothing is waiting.' : 'No reviews need a look here.')]),
      pager({ total: data.total, limit: LIMIT, offset: state.offset, onPage: (o) => { state.offset = o; load(); } }));
    announce(`${data.total} reviews`);
  }

  function card(r) {
    const hiddenNow = r.status === 'hidden';
    return h('article', { class: 'admin-review', 'aria-label': `Review of ${r.listingName}` },
      h('div', { class: 'spread' },
        h('div', {}, h('span', { class: 'name t-headline' }, r.listingName), ' ', tag(KIND_SHORT[r.kind] || r.kind)),
        h('div', { class: 'row-8' }, tag(`${r.rating} of 5`), hiddenNow ? tag('Hidden', 'danger') : r.reportCount ? tag(`${r.reportCount} ${r.reportCount === 1 ? 'report' : 'reports'}`, 'warning') : tag('Visible', 'success'))),
      h('p', {}, r.body || 'No written comment.'),
      h('p', { class: 't-footnote muted' }, `Posted ${when(r.createdAt)}. The author is not shown to admins.`),
      h('div', { class: 'row-8' },
        (hiddenNow || r.reportCount) ? h('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => keep(r) }, hiddenNow ? 'Restore review' : 'Keep review') : null,
        h('button', { class: 'btn btn-destructive btn-sm', type: 'button', onclick: () => remove(r) }, 'Delete review')));
  }
  async function keep(r) {
    try { await api(`/admin/reviews/${r.id}/restore`, { method: 'POST', body: {} }); toast('Review kept and reports cleared'); await load(); } catch (err) { toast(err.message); }
  }
  async function remove(r) {
    if (!(await confirmDialog({ title: 'Delete this review?', text: 'It is removed for good, along with its reports. This cannot be undone.', confirm: 'Delete review' }))) return;
    try { await api(`/admin/reviews/${r.id}`, { method: 'DELETE' }); toast('Review deleted'); await load(); } catch (err) { toast(err.message); }
  }

  page.append(pageHead({ title: 'Reviews', sub: 'Patients can report a review. Three reports hide it until you decide. Keep it to put it back and clear the reports, or delete it.' }), seg, list);
  await load();
}
