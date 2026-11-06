import { api } from '/js/api.js';
import { h, pageHead, when, dataTable, pager, field, errorNotice, loading, KIND_SHORT, tag } from '/admin/lib.js';

const LIMIT = 30;
const TARGETS = [['', 'Anything'], ['user', 'People'], ['hospital', 'Hospitals'], ['doctor', 'Doctors'], ['pharmacy', 'Pharmacies'], ['diagnostic_centre', 'Diagnostic centres'], ['review', 'Reviews']];

export async function render(page, { announce }) {
  const state = { targetKind: '', offset: 0 };
  const list = h('div', { 'aria-live': 'polite' });
  const kind = h('select', { class: 'select' }, TARGETS.map(([v, t]) => h('option', { value: v }, t)));
  async function load() {
    list.replaceChildren(loading());
    const p = new URLSearchParams({ limit: LIMIT, offset: state.offset });
    if (state.targetKind) p.set('targetKind', state.targetKind);
    let data;
    try { data = await api(`/admin/audit?${p}`); } catch (err) { list.replaceChildren(errorNotice(err, load)); return; }
    list.replaceChildren(
      dataTable({
        caption: 'Admin actions, newest first', emptyText: 'No admin actions recorded yet.', rows: data.entries,
        columns: [
          { label: 'When', cell: (e) => h('span', { class: 'sub' }, when(e.createdAt)) },
          { label: 'Who', cell: (e) => h('span', { class: 'name' }, e.actor) },
          { label: 'Action', cell: (e) => tag(e.action) },
          { label: 'About', cell: (e) => h('span', { class: 'sub' }, KIND_SHORT[e.targetKind] || (e.targetKind === 'user' ? 'Person' : e.targetKind === 'review' ? 'Review' : e.targetKind)) },
          { label: 'What changed', cell: (e) => h('span', {}, e.summary) },
        ],
      }),
      pager({ total: data.total, limit: LIMIT, offset: state.offset, onPage: (o) => { state.offset = o; load(); } }));
    announce(`${data.total} entries`);
  }
  kind.addEventListener('change', () => { state.targetKind = kind.value; state.offset = 0; load(); });
  page.append(pageHead({ title: 'Audit log', sub: 'Every change an admin makes is recorded here and cannot be edited or deleted. Entries describe the change, never a patient’s health data.' }),
    h('div', { class: 'admin-toolbar' }, field({ id: 'a-kind', label: 'About', input: kind })), list);
  await load();
}
