import { api } from '/js/api.js';
import { h, icon, toast, pageHead, tag, when, ROLE_LABEL, dataTable, pager, field, debounce, confirmDialog, linkDialog, errorNotice, loading } from '/admin/lib.js';

const LIMIT = 25;

export async function render(page, { me, announce }) {
  const qs = new URLSearchParams((location.hash.split('?')[1]) || '');
  const state = { q: '', role: qs.get('role') || '', status: qs.get('status') || '', offset: 0 };
  const list = h('div', { 'aria-live': 'polite' });
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Name or email', autocomplete: 'off' });
  const role = h('select', { class: 'select' }, [['', 'All roles'], ['patient', 'Patients'], ['driver', 'Drivers'], ['admin', 'Admins']].map(([v, t]) => h('option', { value: v, selected: v === state.role }, t)));
  const status = h('select', { class: 'select' }, [['', 'Any status'], ['active', 'Active'], ['disabled', 'Disabled']].map(([v, t]) => h('option', { value: v, selected: v === state.status }, t)));

  // Password resets (D-88): no email is sent. People ask from the sign-in page, an admin issues a one-time
  // link here and gives it to them by phone or message.
  const resets = h('div', { 'aria-live': 'polite' });
  async function issueLink(person) {
    try {
      const { link, expiresAt } = await api(`/admin/users/${person.id}/reset-link`, { method: 'POST', body: {} });
      document.dispatchEvent(new CustomEvent('admin:counts-changed'));
      await linkDialog({ title: `Reset link for ${person.name}`, text: `Give this link to ${person.name} yourself. It works once and stops at ${when(expiresAt)}. It is not shown again.`, value: link });
      await loadResets();
    } catch (err) { toast(err.message); }
  }
  async function loadResets() {
    let data;
    try { data = await api('/admin/password-resets'); } catch (err) { resets.replaceChildren(errorNotice(err, loadResets)); return; }
    if (!data.requests.length) { resets.replaceChildren(); return; }
    resets.replaceChildren(h('section', { class: 'admin-callout', 'aria-labelledby': 'pr-h' },
      h('h2', { class: 't-title-3', id: 'pr-h' }, `Password reset requests (${data.requests.length})`),
      h('p', { class: 't-subhead muted' }, 'These people asked for a new password. Check it is really them, for example by phoning the number they gave, then create a link.'),
      dataTable({
        caption: 'Password reset requests', emptyText: '', rows: data.requests,
        columns: [
          { label: 'Person', cell: (r) => h('div', {}, h('div', { class: 'name' }, r.name), h('div', { class: 'sub' }, r.email)) },
          { label: 'Role', cell: (r) => tag(ROLE_LABEL[r.role]) },
          { label: 'Asked', cell: (r) => h('span', { class: 'sub' }, when(r.requestedAt)) },
          { label: 'Link', cell: (r) => h('span', { class: 'sub' }, r.issuedAt ? `Issued, ends ${when(r.expiresAt)}` : 'Not issued') },
          { label: 'Action', align: 'end', cell: (r) => h('button', { class: 'btn btn-primary btn-sm', type: 'button', 'aria-label': `Create a reset link for ${r.name}`, onclick: () => issueLink({ id: r.userId, name: r.name }) }, r.issuedAt ? 'New link' : 'Create link') },
        ],
      })));
  }

  async function load() {
    list.replaceChildren(loading());
    const p = new URLSearchParams({ limit: LIMIT, offset: state.offset });
    for (const k of ['q', 'role', 'status']) if (state[k]) p.set(k, state[k]);
    let data;
    try { data = await api(`/admin/users?${p}`); } catch (err) { list.replaceChildren(errorNotice(err, load)); return; }
    list.replaceChildren(
      dataTable({
        caption: 'People with a CareRoute account', emptyText: 'No accounts match these filters.', rows: data.users,
        columns: [
          { label: 'Person', cell: (u) => h('div', {}, h('div', { class: 'name' }, u.name), h('div', { class: 'sub' }, u.email)) },
          { label: 'Role', cell: (u) => tag(ROLE_LABEL[u.role]) },
          { label: 'Joined', cell: (u) => h('span', { class: 'sub' }, when(u.createdAt)) },
          { label: 'Status', cell: (u) => (u.disabledAt ? tag('Disabled', 'danger') : tag('Active', 'success')) },
          { label: 'Action', align: 'end', cell: (u) => action(u) },
        ],
      }),
      pager({ total: data.total, limit: LIMIT, offset: state.offset, onPage: (o) => { state.offset = o; load(); } }));
    announce(`${data.total} accounts`);
  }

  function action(u) {
    if (u.id === me.id) return h('span', { class: 'sub' }, 'This is you');
    const disabled = !!u.disabledAt;
    const reset = h('button', { class: 'btn btn-secondary btn-sm', type: 'button', 'aria-label': `Create a password reset link for ${u.name}`, onclick: () => issueLink(u) }, 'Reset link');
    return h('div', { class: 'row-8', style: 'justify-content:flex-end' }, reset, h('button', {
      class: `btn btn-sm ${disabled ? 'btn-secondary' : 'btn-destructive'}`, type: 'button', 'aria-label': `${disabled ? 'Enable' : 'Disable'} ${u.name}`,
      onclick: async () => {
        if (!disabled) {
          const ok = await confirmDialog({ title: `Disable ${u.name}?`, text: 'They are signed out everywhere and cannot sign in until you enable the account again. Their data is not deleted.', confirm: 'Disable account' });
          if (!ok) return;
        }
        try { await api(`/admin/users/${u.id}/${disabled ? 'enable' : 'disable'}`, { method: 'POST', body: {} }); toast(disabled ? 'Account enabled' : 'Account disabled'); await load(); }
        catch (err) { toast(err.message); }
      },
    }, disabled ? 'Enable' : 'Disable'));
  }

  const refresh = () => { state.offset = 0; load(); };
  search.addEventListener('input', debounce(() => { state.q = search.value.trim(); refresh(); }));
  role.addEventListener('change', () => { state.role = role.value; refresh(); });
  status.addEventListener('change', () => { state.status = status.value; refresh(); });

  page.append(
    pageHead({ title: 'People', sub: 'Accounts only. No health information is shown here, and none is available to admins.' }),
    resets,
    h('div', { class: 'admin-toolbar' }, field({ id: 'u-q', label: 'Search', input: search, span2: false }), field({ id: 'u-role', label: 'Role', input: role }), field({ id: 'u-status', label: 'Status', input: status })),
    list);
  await Promise.all([loadResets(), load()]);
}
