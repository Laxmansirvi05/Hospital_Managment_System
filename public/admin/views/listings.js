import { api } from '/js/api.js';
import { h, icon, toast, pageHead, tag, dayOf, KIND_LABEL, KIND_SHORT, dataTable, pager, field, debounce, confirmDialog, errorNotice, loading } from '/admin/lib.js';
import { renderEditor } from '/admin/views/listing-editor.js';

const LIMIT = 25;
const KINDS = ['hospital', 'doctor', 'pharmacy', 'diagnostic_centre'];

export async function render(page, ctx) {
  const [a, b] = ctx.params;
  if (a === 'new' && KINDS.includes(b)) return renderEditor(page, ctx, { kind: b, id: null });
  if (KINDS.includes(a) && b) return renderEditor(page, ctx, { kind: a, id: b });
  return renderList(page, ctx);
}

async function renderList(page, { announce }) {
  const qs = new URLSearchParams((location.hash.split('?')[1]) || '');
  const state = { q: '', kind: KINDS.includes(qs.get('kind')) ? qs.get('kind') : '', status: qs.get('status') || '', offset: 0 };
  const list = h('div', { 'aria-live': 'polite' });
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Name', autocomplete: 'off' });
  const kind = h('select', { class: 'select' }, [['', 'All kinds'], ...KINDS.map((k) => [k, KIND_LABEL[k]])].map(([v, t]) => h('option', { value: v, selected: v === state.kind }, t)));
  const status = h('select', { class: 'select' }, [['', 'Shown and hidden'], ['active', 'Shown to patients'], ['hidden', 'Hidden']].map(([v, t]) => h('option', { value: v, selected: v === state.status }, t)));

  async function load() {
    list.replaceChildren(loading());
    const p = new URLSearchParams({ limit: LIMIT, offset: state.offset });
    for (const k of ['q', 'kind', 'status']) if (state[k]) p.set(k, state[k]);
    let data;
    try { data = await api(`/admin/listings?${p}`); } catch (err) { list.replaceChildren(errorNotice(err, load)); return; }
    list.replaceChildren(
      dataTable({
        caption: 'Care listings', emptyText: 'No listings match these filters.', rows: data.listings,
        columns: [
          { label: 'Name', cell: (l) => h('a', { class: 'admin-link name', href: `#/listings/${l.kind}/${l.id}` }, l.name) },
          { label: 'Kind', cell: (l) => tag(KIND_SHORT[l.kind]) },
          { label: 'Area', cell: (l) => h('span', { class: 'sub' }, l.area || 'Not set') },
          { label: 'Last checked', cell: (l) => h('span', { class: 'sub' }, l.checkedAt ? dayOf(l.checkedAt) : 'Not set') },
          { label: 'Status', cell: (l) => (l.active ? tag('Shown', 'success') : tag('Hidden', 'danger')) },
          { label: 'Action', align: 'end', cell: (l) => h('div', { class: 'row-8', style: 'justify-content:flex-end' },
            h('a', { class: 'btn btn-secondary btn-sm', href: `#/listings/${l.kind}/${l.id}`, 'aria-label': `Edit ${l.name}` }, 'Edit'),
            h('button', { class: 'btn btn-secondary btn-sm', type: 'button', 'aria-label': `${l.active ? 'Hide' : 'Show'} ${l.name}`, onclick: () => toggle(l) }, l.active ? 'Hide' : 'Show')) },
        ],
      }),
      pager({ total: data.total, limit: LIMIT, offset: state.offset, onPage: (o) => { state.offset = o; load(); } }));
    announce(`${data.total} listings`);
  }

  async function toggle(l) {
    if (l.active && !(await confirmDialog({ title: `Hide ${l.name}?`, text: 'Patients will stop seeing it in search, maps and the assistant. You can show it again at any time.', confirm: 'Hide listing' }))) return;
    try { await api(`/admin/listings/${l.kind}/${l.id}/${l.active ? 'hide' : 'unhide'}`, { method: 'POST', body: {} }); toast(l.active ? 'Listing hidden' : 'Listing shown again'); await load(); }
    catch (err) { toast(err.message); }
  }

  const refresh = () => { state.offset = 0; load(); };
  search.addEventListener('input', debounce(() => { state.q = search.value.trim(); refresh(); }));
  kind.addEventListener('change', () => { state.kind = kind.value; refresh(); });
  status.addEventListener('change', () => { state.status = status.value; refresh(); });

  page.append(
    pageHead({ title: 'Listings', sub: 'Hospitals, doctors, pharmacies and diagnostic centres patients can find. Hiding a listing removes it from patient search without deleting it.' }),
    h('div', { class: 'row-8', role: 'group', 'aria-label': 'Add a listing' }, KINDS.map((k) => h('a', { class: 'btn btn-primary btn-sm', href: `#/listings/new/${k}` }, icon('plus', 18), `Add ${KIND_SHORT[k].toLowerCase()}`))),
    h('div', { class: 'admin-toolbar' }, field({ id: 'l-q', label: 'Search', input: search }), field({ id: 'l-kind', label: 'Kind', input: kind }), field({ id: 'l-status', label: 'Status', input: status })),
    list);
  await load();
}
