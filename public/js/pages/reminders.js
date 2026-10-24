import { h, icon, toast } from '../h.js';
import { api } from '../api.js';
import { shell, loadError } from '../shell.js';
import { pageHead, field, showErrors, busy, confirmDialog, empty } from '../ui.js';
import { todayIst, dateLong, DAY_SHORT, DAY_NAMES } from '../format.js';
import { notificationState, askForNotifications, startReminderWatch } from '../notify.js';

const { main } = await shell({ nav: 'reminders', title: 'Medicine reminders' });

let reminders = [];
const listEl = h('div', { class: 'stack-16' });
const formSlot = h('div');

try {
  reminders = (await api('/patients/me/reminders')).reminders;
  render();
  if (location.hash === '#new') openForm();
} catch (err) {
  loadError(main, err);
}

function daysText(days) {
  if (days.length === 7) return 'Every day';
  if (days.join() === '1,2,3,4,5') return 'Weekdays';
  return days.map((d) => DAY_NAMES[d].slice(0, 3)).join(', ');
}

function drawList() {
  const active = reminders.filter((r) => r.active);
  const paused = reminders.filter((r) => !r.active);
  const card = (r) => h('article', { class: 'card med-card' },
    h('span', { class: 'pill-obj', 'aria-hidden': 'true' }, icon('pill', 24)),
    h('div', { class: 'stack-8', style: 'min-width:0' },
      h('div', { class: 'row-8' }, h('h3', { class: 't-headline' }, r.medicineName), r.active ? null : h('span', { class: 'tag' }, 'Paused')),
      h('p', { class: 't-subhead muted' }, [r.dose, r.instructions].filter(Boolean).join(' · ')),
      h('div', { class: 'row-8' }, r.times.map((t) => h('span', { class: 'tag tag-primary num' }, icon('clock', 14), t))),
      h('p', { class: 't-footnote muted' }, `${daysText(r.daysOfWeek)} · from ${dateLong(r.startDate)}${r.endDate ? ` to ${dateLong(r.endDate)}` : ''}`),
      r.notes ? h('p', { class: 't-footnote' }, r.notes) : null),
    h('div', { class: 'stack-8', style: 'justify-items:end' },
      h('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => openForm(r) }, icon('edit', 16), 'Edit'),
      h('button', {
        class: 'btn btn-text btn-sm', type: 'button',
        onclick: async () => {
          try {
            const saved = await api(`/patients/me/reminders/${r.id}`, { method: 'PATCH', body: { active: !r.active } });
            Object.assign(r, saved);
            drawList();
            startReminderWatch();
            toast(saved.active ? 'Reminder turned on' : 'Reminder paused');
          } catch (err) {
            toast(err.message);
          }
        },
      }, r.active ? 'Pause' : 'Turn on')));
  // replaceChildren would print null as text, so empty sections are filtered out.
  listEl.replaceChildren(...[
    reminders.length ? null : h('section', { class: 'card' }, empty({ iconName: 'clock', title: 'No reminders yet', text: 'Add each medicine your doctor prescribed with the times you take it.', action: h('button', { class: 'btn btn-primary', type: 'button', onclick: () => openForm() }, icon('plus', 18), 'Add a reminder') })),
    active.length ? h('div', { class: 'stack-12' }, h('h2', { class: 't-title-3' }, `Active (${active.length})`), active.map(card)) : null,
    paused.length ? h('div', { class: 'stack-12' }, h('h2', { class: 't-title-3' }, `Paused (${paused.length})`), paused.map(card)) : null,
  ].filter(Boolean));
}

function openForm(existing = null) {
  const prefill = new URLSearchParams(location.search).get('medicine') || '';
  const r = existing || { medicineName: prefill, dose: '', instructions: '', times: ['08:00'], daysOfWeek: [0, 1, 2, 3, 4, 5, 6], startDate: todayIst(), endDate: null, notes: '' };
  const name = h('input', { class: 'input', value: r.medicineName, maxlength: 120, placeholder: 'For example Metformin 500 mg' });
  const dose = h('input', { class: 'input', value: r.dose, maxlength: 60, placeholder: 'For example 1 tablet' });
  const instructions = h('select', { class: 'select' },
    ['', 'Before food', 'After food', 'With food', 'Empty stomach', 'At bedtime'].map((v) => h('option', { value: v, selected: v === r.instructions }, v || 'No instruction')));
  const start = h('input', { class: 'input', type: 'date', value: r.startDate });
  const end = h('input', { class: 'input', type: 'date', value: r.endDate || '' });
  const notes = h('textarea', { class: 'textarea', maxlength: 300 }, r.notes);

  const times = [...r.times];
  const timesEl = h('div', { class: 'times' });
  const drawTimes = () => timesEl.replaceChildren(...[
    ...times.map((t, i) => h('span', { class: 'row-8', style: 'flex-wrap:nowrap' },
      h('input', { class: 'input num', type: 'time', value: t, 'aria-label': `Time ${i + 1}`, onchange: (e) => { times[i] = e.target.value; } }),
      times.length > 1 ? h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Remove time ${t}`, onclick: () => { times.splice(i, 1); drawTimes(); } }, icon('close', 16)) : null)),
    times.length < 8 ? h('button', { class: 'btn btn-text btn-sm', type: 'button', onclick: () => { times.push('20:00'); drawTimes(); } }, icon('plus', 16), 'Add a time') : null,
  ].filter(Boolean));
  drawTimes();

  const days = new Set(r.daysOfWeek);
  const daysEl = h('div', { class: 'days', role: 'group', 'aria-label': 'Days' },
    DAY_SHORT.map((d, i) => h('button', {
      type: 'button', 'aria-pressed': String(days.has(i)), 'aria-label': DAY_NAMES[i],
      onclick: (e) => {
        if (days.has(i) && days.size > 1) days.delete(i); else days.add(i);
        e.currentTarget.setAttribute('aria-pressed', String(days.has(i)));
      },
    }, d)));

  const message = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const save = h('button', { class: 'btn btn-primary', type: 'submit' }, existing ? 'Save reminder' : 'Add reminder');
  const form = h('form', { class: 'card card-raised form-section', novalidate: true, id: 'new' },
    h('div', { class: 'spread' },
      h('h2', { class: 't-title-2' }, existing ? 'Edit reminder' : 'New reminder'),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: () => formSlot.replaceChildren() }, icon('close', 18))),
    message,
    h('div', { class: 'form-grid' },
      field({ id: 'medicineName', label: 'Medicine', input: name, span2: true }),
      field({ id: 'dose', label: 'Dose', input: dose }),
      field({ id: 'instructions', label: 'How to take it', input: instructions })),
    h('div', { class: 'field', 'data-field': 'times' }, h('span', { class: 'label' }, 'Times of day'), timesEl, h('span', { class: 'field-error', id: 'times-error', hidden: true })),
    h('div', { class: 'field' }, h('span', { class: 'label' }, 'Days'), daysEl),
    h('div', { class: 'form-grid' },
      field({ id: 'startDate', label: 'Start date', input: start }),
      field({ id: 'endDate', label: 'End date', input: end, hint: 'Leave empty if there is no end date.' }),
      field({ id: 'notes', label: 'Notes', input: notes, span2: true })),
    h('div', { class: 'row', style: 'justify-content:space-between' },
      existing ? h('button', {
        class: 'btn btn-destructive', type: 'button',
        onclick: async () => {
          if (!(await confirmDialog({ title: `Delete ${existing.medicineName}?`, text: 'The reminder and its history will be removed.' }))) return;
          try {
            await api(`/patients/me/reminders/${existing.id}`, { method: 'DELETE' });
            reminders = reminders.filter((x) => x.id !== existing.id);
            formSlot.replaceChildren();
            drawList();
            startReminderWatch();
            toast('Reminder deleted');
          } catch (err) {
            toast(err.message);
          }
        },
      }, icon('trash', 16), 'Delete') : h('span'),
      save));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const restore = busy(save);
    const body = {
      medicineName: name.value, dose: dose.value, instructions: instructions.value, times: times.filter(Boolean),
      daysOfWeek: [...days], startDate: start.value, endDate: end.value || null, notes: notes.value,
    };
    try {
      const saved = existing
        ? await api(`/patients/me/reminders/${existing.id}`, { method: 'PATCH', body })
        : await api('/patients/me/reminders', { body });
      reminders = existing ? reminders.map((x) => (x.id === saved.id ? saved : x)) : [...reminders, saved];
      formSlot.replaceChildren();
      drawList();
      startReminderWatch();
      toast(existing ? 'Reminder saved' : 'Reminder added');
    } catch (err) {
      restore();
      showErrors(form, err, message);
    }
  });

  formSlot.replaceChildren(form);
  form.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  name.focus({ preventScroll: true });
}

function notificationCard() {
  const state = notificationState();
  const body = h('div', { class: 'stack-12' });
  const draw = (s) => {
    if (s === 'granted') {
      body.replaceChildren(h('p', { class: 'status status-ok' }, 'Browser reminders are on'),
        h('p', { class: 't-footnote muted' }, 'You get a notification at each time while CareRoute is open in this browser. Browsers do not alert when the tab is closed or the phone is asleep, so keep the alarm on your phone for important doses.'));
    } else if (s === 'denied') {
      body.replaceChildren(h('p', { class: 'status status-idle' }, 'Notifications are blocked in this browser'),
        h('p', { class: 't-footnote muted' }, 'You still see reminders inside CareRoute. To get notifications, allow them for this site in your browser settings.'));
    } else if (s === 'unsupported') {
      body.replaceChildren(h('p', { class: 't-footnote muted' }, 'This browser does not support notifications. Reminders still show inside CareRoute.'));
    } else {
      body.replaceChildren(h('p', { class: 't-subhead muted' }, 'Get a notification in this browser when a dose is due.'),
        h('button', { class: 'btn btn-secondary', type: 'button', onclick: async () => draw(await askForNotifications()) }, icon('bell', 18), 'Turn on browser reminders'));
    }
  };
  draw(state);
  return h('section', { class: 'card stack-12' }, h('h2', { class: 't-title-3' }, 'Notifications'), body);
}

function render() {
  drawList();
  main.replaceChildren(h('div', { class: 'page' },
    pageHead({
      title: 'Medicine reminders',
      sub: 'Add the medicines you take and when. Mark each dose as taken from your dashboard.',
      actions: h('button', { class: 'btn btn-primary', type: 'button', onclick: () => openForm() }, icon('plus', 18), 'Add reminder'),
    }),
    formSlot,
    h('div', { class: 'grid-main-side' },
      listEl,
      h('div', { class: 'stack-16' },
        notificationCard(),
        h('p', { class: 'notice notice-neutral' }, icon('info', 18), h('span', {}, 'Take medicines as your doctor prescribed. CareRoute reminds you of the times you enter and does not give medical advice.'))))));
}
