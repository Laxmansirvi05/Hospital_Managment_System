// Data quality (P-31): where listings need a human look. Read only, and listing facts only; fixes
// happen in the listing editor, so every change still reaches the audit log.
import { api } from '/js/api.js';
import { h, pageHead, tag, dayOf, KIND_LABEL, KIND_SHORT, dataTable } from '/admin/lib.js';

export async function render(page) {
  const d = await api('/admin/data-quality');
  const edit = (kind, id, name) => h('a', { class: 'admin-link name', href: `#/listings/${kind}/${id}` }, name);
  page.append(
    pageHead({ title: 'Data quality', sub: `Listings to look at again. A listing counts as old when it was last checked more than ${d.staleAfterDays} days ago.` }),
    h('section', { class: 'stack-12', 'aria-labelledby': 'dq-kinds' },
      h('h2', { class: 't-title-2', id: 'dq-kinds' }, 'By kind, shown to patients'),
      dataTable({
        caption: 'Data quality by kind of listing', emptyText: 'No listings yet.', rows: d.kinds,
        columns: [
          { label: 'Kind', cell: (k) => h('a', { class: 'admin-link name', href: `#/listings?kind=${k.kind}` }, KIND_LABEL[k.kind]) },
          { label: 'Shown', cell: (k) => String(k.active) },
          { label: 'Checked long ago', cell: (k) => (k.stale ? tag(String(k.stale), 'warning') : '0') },
          { label: 'No phone', cell: (k) => (k.noPhone ? tag(String(k.noPhone), 'warning') : '0') },
          { label: 'No source link', cell: (k) => (k.noSource ? tag(String(k.noSource), 'warning') : '0') },
        ],
      })),
    h('section', { class: 'stack-12', 'aria-labelledby': 'dq-dupes' },
      h('h2', { class: 't-title-2', id: 'dq-dupes' }, `Possible duplicates (${d.possibleDuplicates.total})`),
      h('p', { class: 't-subhead muted' }, 'Same kind, name and area. Chains can have real branches close together, so check before hiding one.'),
      dataTable({
        caption: 'Listings that may be duplicates', emptyText: 'No possible duplicates.', rows: d.possibleDuplicates.groups,
        columns: [
          { label: 'Name', cell: (g) => h('span', { class: 'name' }, g.name) },
          { label: 'Kind', cell: (g) => tag(KIND_SHORT[g.kind]) },
          { label: 'Area', cell: (g) => h('span', { class: 'sub' }, g.area || 'Not set') },
          { label: 'Open each', cell: (g) => h('div', { class: 'row-8' }, g.ids.slice(0, 6).map((id, i) => h('a', { class: 'btn btn-secondary btn-sm', href: `#/listings/${g.kind}/${id}`, 'aria-label': `Open ${g.name}, record ${i + 1} of ${g.count}` }, String(i + 1)))) },
        ],
      })),
    h('section', { class: 'stack-12', 'aria-labelledby': 'dq-stale' },
      h('h2', { class: 't-title-2', id: 'dq-stale' }, `Checked longest ago (${d.stale.total})`),
      dataTable({
        caption: 'Listings checked longest ago, oldest first', emptyText: 'Every listing was checked recently.', rows: d.stale.rows,
        columns: [
          { label: 'Name', cell: (r) => edit(r.kind, r.id, r.name) },
          { label: 'Kind', cell: (r) => tag(KIND_SHORT[r.kind]) },
          { label: 'Area', cell: (r) => h('span', { class: 'sub' }, r.area || 'Not set') },
          { label: 'Last checked', cell: (r) => h('span', { class: 'sub' }, r.checkedAt ? dayOf(r.checkedAt) : 'Never') },
        ],
      })));
}
