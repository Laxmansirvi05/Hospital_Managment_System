// The assistant panel the robot opens (D-65 to D-68): a one-time notice about what is sent to the
// AI service, then a saved conversation. Answers show urgency, the emergency action when needed,
// and real listings from CareRoute. Every piece of text is set with textContent through h().
import { h, icon } from '../h.js';
import { api, uploadTo } from '../api.js';
import { DOC_TYPES, DOC_ACCEPT, DOC_MAX_BYTES } from '../doc-types.js';
import { getOrigin } from '../location.js';
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

/**
 * Builds the assistant. `mode` is 'panel' (the robot's floating window) or 'page' (the AI assistant
 * page, whose own list shows the saved conversations). `setMood` tells the robot what to show;
 * `onConversations` runs whenever the saved list may have changed.
 */
export function createChat({ onClose = () => {}, setMood = () => {}, mode = 'panel', onConversations = () => {} } = {}) {
  const page = mode === 'page';
  const uid = page ? 'astp' : 'ast';
  let info = null;
  let conversationId = null;
  let attached = [];
  let busy = false;

  const close = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close assistant', hidden: page }, icon('close', 20));
  const historyBtn = h('button', { class: 'btn btn-text btn-sm ast-head-btn', type: 'button', 'aria-label': 'Saved conversations', hidden: true }, icon('list', 20), 'Saved');
  const newBtn = h('button', { class: 'btn btn-text btn-sm ast-head-btn', type: 'button', 'aria-label': 'New conversation', hidden: true }, icon('plus', 20), 'New');
  const sub = h('p', { class: 'ast-panel-sub' }, 'Guidance, not a diagnosis');
  // The body swaps between views; only the message log announces what is new.
  const body = h('div', { class: 'ast-panel-body' });
  let log = null;
  const chips = h('div', { class: 'ast-attached', hidden: true });
  const input = h('textarea', { class: 'input ast-input', id: `${uid}-input`, rows: 1, maxlength: 2000, placeholder: 'For example: fever and sore throat since yesterday' });
  const attach = h('button', { class: 'btn btn-secondary ast-attach', type: 'button', 'aria-label': 'Attach files from this device or your Documents' }, icon('upload', 20), 'Attach');
  const fileInput = h('input', { type: 'file', multiple: true, accept: DOC_ACCEPT, class: 'visually-hidden', tabindex: '-1', 'aria-hidden': 'true' });
  const send = h('button', { class: 'btn btn-primary ast-send', type: 'submit' }, icon('send', 20), 'Send');
  const form = h('form', { class: 'ast-panel-foot', hidden: true },
    h('label', { class: 'ast-label', for: `${uid}-input` }, 'Message the assistant'),
    h('div', { class: 'ast-compose' }, input),
    h('div', { class: 'ast-compose-actions' }, attach, send), fileInput);
  const panel = h('section', page
    ? { class: 'ast-panel ast-panel-page', 'aria-labelledby': `${uid}-title` }
    : { class: 'ast-panel', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': `${uid}-title`, hidden: true },
    h('header', { class: 'ast-panel-head' },
      h('div', { class: 'ast-panel-heading' }, h('h2', { class: 'ast-panel-title', id: `${uid}-title` }, 'CareRoute assistant'), sub),
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
    // On the page the saved conversations are always listed beside the chat.
    historyBtn.hidden = !on || page;
    newBtn.hidden = !on || page;
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
      h('p', { class: 'ast-text' }, 'Hello. Tell me how you feel, ask me to find a doctor, hospital, pharmacy or test, or attach a report, prescription or scan (PDF, Word or picture) and I will explain it.'),
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
    // Places found are sorted from the patient's live or chosen location; the AI never sees it.
    const o = getOrigin();
    const near = o.source === 'default' ? undefined : { lat: o.lat, lng: o.lng };
    log.append(messageEl({ role: 'user', text: value, documents: attached }));
    const thinking = h('div', { class: 'ast-msg ast-msg-assistant ast-thinking' }, h('p', { class: 'ast-text' }, attached.length ? 'Reading your report' : 'Thinking'));
    log.append(thinking);
    scrollEnd();
    input.value = '';
    setAttached([]);
    setMood('thinking');
    try {
      const res = conversationId
        ? await api(`/assistant/conversations/${conversationId}/messages`, { body: { text: value, documentIds: docs, near } })
        : await api('/assistant/conversations', { body: { text: value, documentIds: docs, near } });
      if (res.conversation) conversationId = res.conversation.id;
      onConversations(conversationId);
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

  /**
   * Saves files from the device to Documents (so they stay with the patient's records and history)
   * and attaches them to the next message. Used by the file chooser, dropping files and pasting.
   */
  async function uploadFiles(list) {
    const files = [...list];
    if (!files.length) return;
    const room = MAX_DOCS - attached.length;
    const note = h('p', { class: 'ast-upload-note', role: 'status' });
    chips.hidden = false;
    chips.append(note);
    const done = [];
    const problems = [];
    for (const f of files.slice(0, Math.max(0, room))) {
      if (!DOC_TYPES.includes(f.type)) { problems.push(`${f.name}: use a PDF, Word (.docx), JPEG, PNG or WebP file.`); continue; }
      if (f.size > DOC_MAX_BYTES) { problems.push(`${f.name}: files can be up to 10 MB.`); continue; }
      note.textContent = `Uploading ${f.name}`;
      try {
        const title = (f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Pasted picture').slice(0, 120);
        const start = await api('/patients/me/reports', { body: { title, kind: 'other', fileName: f.name.slice(0, 200), contentType: f.type, sizeBytes: f.size } });
        await uploadTo(start.uploadUrl, f);
        await api(`/patients/me/reports/${start.id}/complete`, { method: 'POST' });
        done.push({ id: start.id, title });
      } catch (err) {
        problems.push(`${f.name}: ${err.message}`);
      }
    }
    if (files.length > room) problems.push(`You can attach up to ${MAX_DOCS} at a time.`);
    note.remove();
    setAttached([...attached, ...done]);
    if (problems.length) {
      chips.hidden = false;
      chips.append(h('p', { class: 'form-error ast-upload-note', role: 'alert' }, problems.join(' ')));
    }
    if (done.length) input.focus();
  }
  fileInput.addEventListener('change', () => {
    uploadFiles(fileInput.files);
    fileInput.value = '';
  });
  // A picture pasted into the message box, such as a screenshot of a report, is uploaded too.
  input.addEventListener('paste', (e) => {
    const pics = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
    if (!pics.length) return;
    e.preventDefault();
    uploadFiles(pics.map((f) => new File([f], `Pasted picture ${new Date().toLocaleTimeString('en-IN')}.${f.type.split('/')[1]}`, { type: f.type })));
  });
  panel.addEventListener('dragover', (e) => {
    if (form.hidden || !e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    panel.classList.add('is-dropping');
  });
  panel.addEventListener('dragleave', (e) => {
    if (!panel.contains(e.relatedTarget)) panel.classList.remove('is-dropping');
  });
  panel.addEventListener('drop', (e) => {
    panel.classList.remove('is-dropping');
    if (form.hidden || !e.dataTransfer?.files?.length) return;
    e.preventDefault();
    uploadFiles(e.dataTransfer.files);
  });

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
    const device = h('button', { class: 'btn btn-secondary ast-device', type: 'button' }, icon('upload', 20), 'Upload from this device');
    const restore = () => {
      chatMode(true);
      body.replaceChildren(...back);
      log = backLog;
      scrollEnd();
      input.focus();
    };
    device.addEventListener('click', () => {
      restore();
      fileInput.click();
    });
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
      : h('p', { class: 'ast-text' }, 'You have no documents yet.');
    show(h('div', { class: 'ast-notice' },
      heading('Attach files'),
      h('p', { class: 't-footnote' }, `Up to ${MAX_DOCS}: PDF, Word (.docx), JPEG, PNG or WebP. Each is sent in full to the AI service with your message, and files from this device are also saved to your Documents.`),
      device,
      h('p', { class: 't-subhead' }, 'Or choose from your Documents'),
      list,
      limitNote,
      h('div', { class: 'ast-notice-actions' }, docs.length ? done : null, cancel)));
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
        onConversations(null);
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
          onConversations(conversationId);
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
    /** Shows a saved conversation (the page's list uses this). */
    openConversation,
    /** Starts an empty conversation. */
    newConversation() {
      conversationId = null;
      setAttached([]);
      if (info?.consent.agreedAt) startChat();
    },
    get conversationId() { return conversationId; },
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
