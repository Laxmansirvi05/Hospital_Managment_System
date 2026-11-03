// The assistant panel the robot opens (D-65 to D-68): a one-time notice about what is sent to the
// AI service, then a saved conversation. Answers show urgency, the emergency action when needed,
// and real listings from CareRoute. Every piece of text is set with textContent through h().
import { h, icon } from '../h.js';
import { api } from '../api.js';
import { confirmDialog } from '../ui.js';

const MAX_DOCS = 3;
const SUGGESTIONS = [
  'I have had a fever and sore throat since yesterday',
  'Find a skin doctor in Banjara Hills',
  'Explain my latest report',
];

function providersText(list) {
  return list.length === 1 ? list[0] : `${list[0]}, or ${list.slice(1).join(' or ')} when ${list[0]} is busy`;
}

/** Builds the panel. `setMood` tells the robot what to show: 'open' or 'thinking'. */
export function createChat({ onClose, setMood }) {
  let info = null;
  let conversationId = null;
  let attached = [];
  let busy = false;

  const close = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close assistant' }, icon('close', 20));
  const historyBtn = h('button', { class: 'btn btn-text btn-sm ast-head-btn', type: 'button', 'aria-label': 'Saved conversations', hidden: true }, icon('list', 20), 'Saved');
  const newBtn = h('button', { class: 'btn btn-text btn-sm ast-head-btn', type: 'button', 'aria-label': 'New conversation', hidden: true }, icon('plus', 20), 'New');
  const sub = h('p', { class: 'ast-panel-sub' }, 'Guidance, not a diagnosis');
  // The body swaps between views; only the message log announces what is new.
  const body = h('div', { class: 'ast-panel-body' });
  let log = null;
  const chips = h('div', { class: 'ast-attached', hidden: true });
  const input = h('textarea', { class: 'input ast-input', id: 'ast-input', rows: 1, maxlength: 2000, placeholder: 'For example: fever and sore throat since yesterday' });
  const attach = h('button', { class: 'btn btn-secondary ast-attach', type: 'button', 'aria-label': 'Attach reports from your Documents' }, icon('report', 20), 'Attach');
  const send = h('button', { class: 'btn btn-primary ast-send', type: 'submit' }, icon('send', 20), 'Send');
  const form = h('form', { class: 'ast-panel-foot', hidden: true },
    h('label', { class: 'ast-label', for: 'ast-input' }, 'Message the assistant'),
    h('div', { class: 'ast-compose' }, input),
    h('div', { class: 'ast-compose-actions' }, attach, send));
  const panel = h('section', { class: 'ast-panel', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'ast-title', hidden: true },
    h('header', { class: 'ast-panel-head' },
      h('div', { class: 'ast-panel-heading' }, h('h2', { class: 'ast-panel-title', id: 'ast-title' }, 'CareRoute assistant'), sub),
      historyBtn, newBtn, close),
    body,
    h('div', { class: 'ast-panel-bottom' }, chips, form));

  close.addEventListener('click', onClose);
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') onClose();
  });

  const show = (...children) => {
    log = null;
    body.replaceChildren(...children);
  };
  /** A view heading that takes focus, so focus is never left on a control that just disappeared. */
  const heading = (text) => h('h3', { class: 't-headline ast-view-title', tabindex: '-1' }, text);
  const focusHeading = () => body.querySelector('.ast-view-title')?.focus();
  const scrollEnd = () => { body.scrollTop = body.scrollHeight; };
  function chatMode(on) {
    form.hidden = !on;
    historyBtn.hidden = !on;
    newBtn.hidden = !on;
  }

  // ---- notice ------------------------------------------------------------------------------------

  function consentView() {
    chatMode(false);
    const agree = h('button', { class: 'btn btn-primary', type: 'button' }, 'Agree and continue');
    const later = h('button', { class: 'btn btn-secondary', type: 'button' }, 'Not now');
    const error = h('p', { class: 'form-error', role: 'alert', hidden: true });
    agree.addEventListener('click', async () => {
      agree.disabled = true;
      try {
        info.consent.agreedAt = (await api('/patients/me/assistant/consent', { method: 'PUT', body: { agree: true } })).agreedAt;
        startChat();
      } catch (err) {
        error.textContent = err.message;
        error.hidden = false;
        agree.disabled = false;
      }
    });
    later.addEventListener('click', onClose);
    show(h('div', { class: 'ast-notice' },
      heading('Before we start'),
      h('p', {}, info.consent.providers.length
        ? `To answer you, CareRoute sends your messages to an AI service: ${providersText(info.consent.providers)}. These services may keep and review what they receive.`
        : 'To answer you, CareRoute sends your messages to an AI service, which may keep and review what it receives.'),
      h('p', {}, 'With each message it also sends health facts from your medical ID: age, sex, blood group, allergies, conditions, medicines, past surgeries and disabilities. Reports you attach are sent in full.'),
      h('p', {}, 'It never sends your name, phone, email, address, date of birth, insurance or emergency contacts. Names printed inside a report cannot always be removed.'),
      h('p', {}, 'Your conversations are saved to your account, and you can delete them at any time. The assistant gives general guidance, not a diagnosis or a prescription.'),
      h('p', { class: 't-footnote' }, h('a', { href: '/privacy/' }, 'Read the privacy policy')),
      error,
      h('div', { class: 'ast-notice-actions' }, agree, later)));
    focusHeading();
  }

  // ---- messages ----------------------------------------------------------------------------------

  function docChips(docs) {
    return docs?.length ? h('div', { class: 'ast-doc-chips' }, docs.map((d) => h('span', { class: 'ast-doc-chip' }, icon('report', 20), d.title))) : null;
  }

  /** `live` marks an answer arriving now; a reopened conversation is not announced again. */
  function messageEl(m, { live = false } = {}) {
    if (m.role === 'user') return h('div', { class: 'ast-msg ast-msg-user' }, h('p', { class: 'ast-text' }, m.text), docChips(m.documents));
    const urgent = m.sosRecommended
      ? h('div', { class: 'ast-sos', role: live ? 'alert' : null },
        h('p', { class: 't-headline' }, 'This may be an emergency'),
        h('div', { class: 'ast-sos-actions' },
          h('a', { class: 'btn btn-danger', href: 'tel:112' }, icon('phone', 20), 'Call 112'),
          h('a', { class: 'btn btn-secondary', href: '/sos/' }, icon('ambulance', 20), 'Open the Emergency page')))
      : null;
    const level = m.urgency && m.urgency !== 'emergency'
      ? h('p', { class: `ast-level ast-level-${m.urgency}` }, m.urgency === 'urgent' ? 'See a doctor soon' : 'Not urgent', m.suggestedSpecialty ? ` · ${m.suggestedSpecialty}` : '')
      : null;
    const results = m.results?.length
      ? h('ul', { class: 'ast-results' }, m.results.map((r) => h('li', {},
        h('a', { class: 'ast-result', href: r.href },
          h('span', {},
            h('span', { class: 'ast-result-name' }, r.name),
            h('span', { class: 'ast-result-meta' }, [r.detail, r.area].filter(Boolean).join(' · '))),
          icon('chevron', 20)))))
      : null;
    return h('div', { class: 'ast-msg ast-msg-assistant' }, urgent, h('p', { class: 'ast-text' }, m.text), level, results,
      h('p', { class: 'ast-disclaimer' }, m.disclaimer || info.disclaimer));
  }

  function welcome() {
    return h('div', { class: 'ast-msg ast-msg-assistant' },
      h('p', { class: 'ast-text' }, 'Hello. Tell me how you feel, ask me to find a doctor, hospital, pharmacy or test, or attach a report from your Documents and I will explain it.'),
      h('div', { class: 'ast-suggest' }, SUGGESTIONS.map((s) => {
        const b = h('button', { class: 'chip', type: 'button' }, s);
        b.addEventListener('click', () => (/report/i.test(s) ? pickDocuments() : submit(s)));
        return b;
      })));
  }

  function startChat(messages = []) {
    chatMode(true);
    log = h('div', { class: 'ast-log', role: 'log', 'aria-live': 'polite', 'aria-label': 'Conversation' });
    const keep = log;
    show(welcome(), keep);
    log = keep;
    log.append(...messages.map((m) => messageEl(m)));
    scrollEnd();
    input.focus();
  }

  async function submit(text) {
    const value = (text ?? input.value).trim();
    if (!value || busy) return;
    busy = true;
    send.disabled = true;
    const docs = attached.map((d) => d.id);
    log.append(messageEl({ role: 'user', text: value, documents: attached }));
    const thinking = h('div', { class: 'ast-msg ast-msg-assistant ast-thinking' }, h('p', { class: 'ast-text' }, attached.length ? 'Reading your report' : 'Thinking'));
    log.append(thinking);
    scrollEnd();
    input.value = '';
    setAttached([]);
    setMood('thinking');
    try {
      const res = conversationId
        ? await api(`/assistant/conversations/${conversationId}/messages`, { body: { text: value, documentIds: docs } })
        : await api('/assistant/conversations', { body: { text: value, documentIds: docs } });
      if (res.conversation) conversationId = res.conversation.id;
      thinking.replaceWith(messageEl(res.messages[1], { live: true }));
    } catch (err) {
      if (err.status === 409) {
        thinking.remove();
        consentView();
        return;
      }
      thinking.replaceWith(h('div', { class: 'ast-msg ast-msg-assistant ast-error', role: 'alert' }, h('p', { class: 'ast-text' }, err.message)));
    } finally {
      busy = false;
      send.disabled = false;
      setMood('open');
      scrollEnd();
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submit();
  });
  input.addEventListener('keydown', (e) => {
    // Enter sends, Shift and Enter starts a new line, as in most chat boxes.
    // Not while an input method is still composing a word, as in Telugu or Hindi keyboards.
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      submit();
    }
  });

  // ---- documents ---------------------------------------------------------------------------------

  function setAttached(list) {
    attached = list;
    chips.hidden = !attached.length;
    chips.replaceChildren(...attached.map((d) => {
      const remove = h('button', { class: 'ast-chip-x', type: 'button', 'aria-label': `Remove ${d.title}` }, icon('close', 20));
      remove.addEventListener('click', () => setAttached(attached.filter((x) => x.id !== d.id)));
      return h('span', { class: 'ast-doc-chip' }, icon('report', 20), d.title, remove);
    }));
  }

  async function pickDocuments() {
    const back = Array.from(body.childNodes);
    const backLog = log;
    chatMode(false);
    show(h('p', { class: 'ast-text' }, 'Loading your documents'));
    let docs = [];
    try {
      docs = (await api('/patients/me/reports')).reports;
    } catch (err) {
      show(h('p', { class: 'form-error', role: 'alert' }, err.message));
      return;
    }
    const chosen = new Set(attached.map((d) => d.id));
    const limitNote = h('p', { class: 't-footnote', role: 'status' });
    const done = h('button', { class: 'btn btn-primary', type: 'button' }, 'Attach');
    const cancel = h('button', { class: 'btn btn-secondary', type: 'button' }, 'Cancel');
    const restore = () => {
      chatMode(true);
      body.replaceChildren(...back);
      log = backLog;
      scrollEnd();
      input.focus();
    };
    done.addEventListener('click', () => {
      setAttached(docs.filter((d) => chosen.has(d.id)).map((d) => ({ id: d.id, title: d.title })));
      restore();
    });
    cancel.addEventListener('click', restore);
    const list = docs.length
      ? h('ul', { class: 'ast-pick' }, docs.map((d) => {
        const box = h('input', { type: 'checkbox', checked: chosen.has(d.id) });
        box.addEventListener('change', () => {
          if (box.checked && chosen.size >= MAX_DOCS) {
            box.checked = false;
            limitNote.textContent = `You can attach up to ${MAX_DOCS}. Untick one to choose another.`;
            return;
          }
          limitNote.textContent = '';
          if (box.checked) chosen.add(d.id); else chosen.delete(d.id);
        });
        return h('li', {}, h('label', { class: 'ast-pick-row' }, box, h('span', {}, h('span', { class: 'ast-result-name' }, d.title), h('span', { class: 'ast-result-meta' }, new Date(d.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })))));
      }))
      : h('p', { class: 'ast-text' }, 'You have no documents yet. Add a report on the Documents page, then attach it here.');
    show(h('div', { class: 'ast-notice' },
      heading('Attach reports'),
      h('p', { class: 't-footnote' }, `Choose up to ${MAX_DOCS}. Each is sent in full to the AI service with your message.`),
      list,
      limitNote,
      h('div', { class: 'ast-notice-actions' }, docs.length ? done : h('a', { class: 'btn btn-primary', href: '/documents/' }, 'Go to Documents'), cancel)));
    focusHeading();
  }
  attach.addEventListener('click', pickDocuments);

  // ---- saved conversations -----------------------------------------------------------------------

  async function historyView() {
    chatMode(false);
    show(h('p', { class: 'ast-text' }, 'Loading your conversations'));
    try {
      info = await api('/patients/me/assistant');
    } catch (err) {
      show(h('p', { class: 'form-error', role: 'alert' }, err.message));
      return;
    }
    const backBtn = h('button', { class: 'btn btn-secondary', type: 'button' }, 'Back');
    backBtn.addEventListener('click', () => (conversationId ? openConversation(conversationId) : startChat()));
    const failure = h('p', { class: 'form-error', role: 'alert', hidden: true });
    const fail = (err) => {
      failure.textContent = err.message;
      failure.hidden = false;
    };
    const clearAll = h('button', { class: 'btn btn-text', type: 'button' }, 'Delete all');
    clearAll.addEventListener('click', async () => {
      if (!(await confirmDialog({ title: 'Delete all assistant conversations?', text: 'They are removed from your account for good.', confirm: 'Delete all' }))) return;
      try {
        await api('/assistant/conversations', { method: 'DELETE' });
        conversationId = null;
        historyView();
      } catch (err) {
        fail(err);
      }
    });
    const rows = info.conversations.map((c) => {
      const openBtn = h('button', { class: 'ast-pick-row ast-history-open', type: 'button' },
        h('span', {}, h('span', { class: 'ast-result-name' }, c.title), h('span', { class: 'ast-result-meta' }, new Date(c.updatedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }))));
      openBtn.addEventListener('click', () => openConversation(c.id));
      const del = h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Delete ${c.title}` }, icon('trash', 20));
      del.addEventListener('click', async () => {
        try {
          await api(`/assistant/conversations/${c.id}`, { method: 'DELETE' });
          if (conversationId === c.id) conversationId = null;
          historyView();
        } catch (err) {
          fail(err);
        }
      });
      return h('li', { class: 'ast-history-row' }, openBtn, del);
    });
    show(h('div', { class: 'ast-notice' },
      heading('Saved conversations'),
      rows.length ? h('ul', { class: 'ast-pick' }, rows) : h('p', { class: 'ast-text' }, 'No saved conversations yet.'),
      failure,
      h('div', { class: 'ast-notice-actions' }, backBtn, rows.length ? clearAll : null)));
    focusHeading();
  }

  async function openConversation(id) {
    try {
      const res = await api(`/assistant/conversations/${id}`);
      conversationId = id;
      startChat(res.messages);
    } catch (err) {
      show(h('p', { class: 'form-error', role: 'alert' }, err.message));
    }
  }

  historyBtn.addEventListener('click', historyView);
  newBtn.addEventListener('click', () => {
    conversationId = null;
    setAttached([]);
    startChat();
  });

  return {
    panel,
    /** Called each time the panel opens. Loads the notice state once. */
    async opened() {
      if (info) {
        (form.hidden ? close : input).focus();
        return;
      }
      chatMode(false);
      show(h('p', { class: 'ast-text' }, 'Loading'));
      close.focus();
      try {
        info = await api('/patients/me/assistant');
        if (info.consent.agreedAt) startChat(); else consentView();
      } catch (err) {
        info = null;
        show(h('p', { class: 'form-error', role: 'alert' }, err.message));
      }
    },
  };
}
