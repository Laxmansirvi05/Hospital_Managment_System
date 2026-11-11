// Driver requests (D-87): everyone who signs up as a driver waits here. An admin checks that the
// person and the vehicle are real, then approves or rejects. Only an approved driver can work.
import { api } from '/js/api.js';
import { h, icon, toast, pageHead, tag, when, dataTable, pager, field, confirmDialog, promptDialog, errorNotice, loading } from '/admin/lib.js';

const LIMIT = 25;
const TONE = { pending: 'warning', approved: 'success', rejected: 'danger' };
const WORD = { pending: 'Waiting', approved: 'Approved', rejected: 'Rejected' };

export async function render(page, { announce }) {
  const qs = new URLSearchParams((location.hash.split('?')[1]) || '');
  const state = { status: ['pending', 'approved', 'rejected', 'all'].includes(qs.get('status')) ? qs.get('status') : 'pending', offset: 0 };
  const list = h('div', { 'aria-live': 'polite' });
  const status = h('select', { class: 'select' }, [['pending', 'Waiting for a decision'], ['approved', 'Approved'], ['rejected', 'Rejected'], ['all', 'All drivers']].map(([v, t]) => h('option', { value: v, selected: v === state.status }, t)));

  async function decide(d, decision) {
    if (decision === 'approve') {
      const ok = await confirmDialog({ title: `Approve ${d.name}?`, text: 'They can go online and receive ambulance requests from patients straight away. Only approve a driver whose identity and vehicle you have checked.', confirm: 'Approve driver', danger: false });
      if (!ok) return;
    } else {
      const note = await promptDialog({ title: `Reject ${d.name}?`, text: d.status === 'approved' ? 'They are taken offline now and cannot work again unless you approve them later.' : 'They are told their account was not approved.', label: 'Reason, shown to the driver (optional)', confirm: 'Reject driver', danger: true });
      if (note === null) return;
      return send(d, 'reject', { note: note || undefined }, 'Driver rejected');
    }
    return send(d, 'approve', {}, 'Driver approved');
  }
  async function send(d, path, body, done) {
    try { await api(`/admin/drivers/${d.id}/${path}`, { method: 'POST', body }); toast(done); await load(); }
    catch (err) { toast(err.message); }
  }

  async function load() {
    list.replaceChildren(loading());
    const p = new URLSearchParams({ status: state.status, limit: LIMIT, offset: state.offset });
    let data;
    try { data = await api(`/admin/driver-requests?${p}`); } catch (err) { list.replaceChildren(errorNotice(err, load)); return; }
    list.replaceChildren(
      dataTable({
        caption: 'Driver sign-ups', emptyText: state.status === 'pending' ? 'No driver is waiting for a decision.' : 'No drivers match this filter.', rows: data.requests,
        columns: [
          { label: 'Driver', cell: (d) => h('div', {}, h('div', { class: 'name' }, d.name), h('div', { class: 'sub' }, d.email)) },
          { label: 'Phone', cell: (d) => (d.phone ? h('a', { class: 'admin-link', href: `tel:${d.phone}` }, d.phone) : h('span', { class: 'sub' }, 'Not given')) },
          { label: 'Vehicle', cell: (d) => h('div', {}, h('div', { class: 'name' }, d.registrationNumber || 'Not given'), h('div', { class: 'sub' }, d.vehicleType || '')) },
          { label: 'Signed up', cell: (d) => h('span', { class: 'sub' }, when(d.createdAt)) },
          { label: 'Status', cell: (d) => h('div', {}, tag(WORD[d.status] || d.status, TONE[d.status] || ''), d.note ? h('div', { class: 'sub' }, d.note) : null) },
          { label: 'Decision', align: 'end', cell: (d) => h('div', { class: 'row-8', style: 'justify-content:flex-end' },
            d.status !== 'approved' ? h('button', { class: 'btn btn-primary btn-sm', type: 'button', 'aria-label': `Approve ${d.name}`, onclick: () => decide(d, 'approve') }, icon('check', 16), 'Approve') : null,
            d.status !== 'rejected' ? h('button', { class: 'btn btn-secondary btn-sm', type: 'button', 'aria-label': `Reject ${d.name}`, onclick: () => decide(d, 'reject') }, d.status === 'approved' ? 'Withdraw' : 'Reject') : null) },
        ],
      }),
      pager({ total: data.total, limit: LIMIT, offset: state.offset, onPage: (o) => { state.offset = o; load(); } }));
    announce(`${data.total} drivers`);
    document.dispatchEvent(new CustomEvent('admin:counts-changed'));
  }

  status.addEventListener('change', () => { state.status = status.value; state.offset = 0; load(); });
  page.append(
    pageHead({ title: 'Driver requests', sub: 'Everyone who signs up as a driver waits here. Call the number, check the vehicle registration, and approve only a driver you trust: an approved driver is sent real patients.' }),
    h('div', { class: 'admin-toolbar' }, field({ id: 'd-status', label: 'Show', input: status })),
    list);
  await load();
}
