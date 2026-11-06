import { api } from '/js/api.js';
import { h, icon, toast, pageHead, tag, when, ROLE_LABEL, dataTable, pager, field, debounce, confirmDialog, errorNotice, loading } from '/admin/lib.js';

const LIMIT = 25;

export async function render(page, { me, announce }) {
  const qs = new URLSearchParams((location.hash.split('?')[1]) || '');
  const state = { q: '', role: qs.get('role') || '', status: qs.get('status') || '', offset: 0 };
  const list = h('div', { 'aria-live': 'polite' });
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Name or email', autocomplete: 'off' });
  const role = h('select', { class: 'select' }, [['', 'All roles'], ['patient', 'Patients'], ['driver', 'Drivers'], ['admin', 'Admins']].map(([v, t]) => h('option', { value: v, selected: v === state.role }, t)));
  const status = h('select', { class: 'select' }, [['', 'Any status'], ['active', 'Active'], ['disabled', 'Disabled']].map(([v, t]) => h('option', { value: v, selected: v === state.status }, t)));

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
          { label: 'Sign-in', cell: (u) => h('span', { class: 'sub' }, [u.signIn.password && 'Password', u.signIn.google && 'Google'].filter(Boolean).join(' and ') || 'None') },
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
    return h('button', {
      class: `btn btn-sm ${disabled ? 'btn-secondary' : 'btn-destructive'}`, type: 'button', 'aria-label': `${disabled ? 'Enable' : 'Disable'} ${u.name}`,
      onclick: async () => {
        if (!disabled) {
          const ok = await confirmDialog({ title: `Disable ${u.name}?`, text: 'They are signed out everywhere and cannot sign in until you enable the account again. Their data is not deleted.', confirm: 'Disable account' });
          if (!ok) return;
        }
        try { await api(`/admin/users/${u.id}/${disabled ? 'enable' : 'disable'}`, { method: 'POST', body: {} }); toast(disabled ? 'Account enabled' : 'Account disabled'); await load(); }
        catch (err) { toast(err.message); }
      },
    }, disabled ? 'Enable' : 'Disable');
  }

  const refresh = () => { state.offset = 0; load(); };
  search.addEventListener('input', debounce(() => { state.q = search.value.trim(); refresh(); }));
  role.addEventListener('change', () => { state.role = role.value; refresh(); });
  status.addEventListener('change', () => { state.status = status.value; refresh(); });

  page.append(
    pageHead({ title: 'People', sub: 'Accounts only. No health information is shown here, and none is available to admins.' }),
    h('div', { class: 'admin-toolbar' }, field({ id: 'u-q', label: 'Search', input: search, span2: false }), field({ id: 'u-role', label: 'Role', input: role }), field({ id: 'u-status', label: 'Status', input: status })),
    list);
  await load();
}
