// The AI assistant at full size (D-65 to D-68): every saved conversation on the left, the chat on the
// right. It is the same assistant as the robot's panel (chat.js); this page only adds the list.
import { h, icon, toast } from '../h.js';
import { api } from '../api.js';
import { shell } from '../shell.js';
import { pageHead, confirmDialog } from '../ui.js';
import { createChat } from '../assistant/chat.js';

const { main } = await shell({ nav: 'assistant', title: 'AI assistant' });

const listEl = h('ul', { class: 'astp-list' });
const listNote = h('p', { class: 't-footnote muted' });
const newBtn = h('button', { class: 'btn btn-primary btn-block', type: 'button' }, icon('plus', 20), 'New conversation');
const clearBtn = h('button', { class: 'btn btn-text', type: 'button', hidden: true }, 'Delete all');

const chat = createChat({ mode: 'page', onConversations: () => loadList() });

const when = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

async function loadList() {
  let info;
  try {
    info = await api('/patients/me/assistant');
  } catch (err) {
    listNote.textContent = err.message;
    return;
  }
  const current = chat.conversationId;
  clearBtn.hidden = !info.conversations.length;
  listNote.textContent = info.conversations.length ? '' : 'Your conversations are saved here.';
  listEl.replaceChildren(...info.conversations.map((c) => {
    const open = h('button', { class: 'astp-item', type: 'button', 'aria-current': c.id === current ? 'true' : null },
      h('span', { class: 'astp-item-title' }, c.title),
      h('span', { class: 'astp-item-when' }, when(c.updatedAt)));
    open.addEventListener('click', async () => {
      await chat.openConversation(c.id);
      loadList();
    });
    const del = h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Delete ${c.title}` }, icon('trash', 20));
    del.addEventListener('click', async () => {
      if (!(await confirmDialog({ title: 'Delete this conversation?', text: c.title, confirm: 'Delete' }))) return;
      try {
        await api(`/assistant/conversations/${c.id}`, { method: 'DELETE' });
        if (chat.conversationId === c.id) chat.newConversation();
        loadList();
      } catch (err) {
        toast(err.message);
      }
    });
    return h('li', { class: 'astp-row' }, open, del);
  }));
}

newBtn.addEventListener('click', () => {
  chat.newConversation();
  loadList();
});
clearBtn.addEventListener('click', async () => {
  if (!(await confirmDialog({ title: 'Delete all assistant conversations?', text: 'They are removed from your account for good.', confirm: 'Delete all' }))) return;
  try {
    await api('/assistant/conversations', { method: 'DELETE' });
    chat.newConversation();
    loadList();
  } catch (err) {
    toast(err.message);
  }
});

main.replaceChildren(h('div', { class: 'page astp-page' },
  pageHead({ art: 'document', title: 'AI assistant', sub: 'Describe how you feel, find care near you, or have a report explained. Guidance, not a diagnosis. In an emergency, call 112.' }),
  h('div', { class: 'astp-layout' },
    h('nav', { class: 'card astp-side', 'aria-label': 'Saved conversations' },
      newBtn,
      h('h2', { class: 't-headline' }, 'Saved conversations'),
      listNote,
      listEl,
      clearBtn),
    chat.panel)));

await chat.opened();
loadList();
