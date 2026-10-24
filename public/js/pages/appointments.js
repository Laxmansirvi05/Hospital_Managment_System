import { h, icon, toast } from '../h.js';
import { api } from '../api.js';
import { shell, loadError } from '../shell.js';
import { pageHead, field, showErrors, busy, confirmDialog, empty } from '../ui.js';
import { todayIst, monthShort, dayOfMonth, relativeDay, dateLong } from '../format.js';

const { main } = await shell({ nav: 'appointments', title: 'Appointments' });

let items = [];
const upcomingEl = h('div', { class: 'list' });
const pastEl = h('div', { class: 'list' });
const formSlot = h('div');

try {
  items = (await api('/patients/me/appointments')).appointments;
  render();
  if (location.hash === '#new') openForm();
} catch (err) {
  loadError(main, err);
}

const STATUS = { scheduled: ['Scheduled', 'status-live'], done: ['Done', 'status-ok'], cancelled: ['Cancelled', 'status-idle'] };

function row(a) {
  const today = todayIst();
  const [label, cls] = STATUS[a.status];
  return h('div', { class: 'list-row' },
    h('span', { class: 'date-tile', 'aria-hidden': 'true' }, h('span', { class: 'date-tile-month' }, monthShort(a.date)), h('span', { class: 'date-tile-day' }, dayOfMonth(a.date))),
    h('span', { class: 'list-row-main' },
      h('span', { class: 'list-row-title' }, a.doctorName),
      h('span', { class: 'list-row-meta' }, [a.speciality, a.place].filter(Boolean).join(' · ')),
      h('span', { class: 'list-row-meta num' }, `${relativeDay(a.date, today)} at ${a.time}${a.reason ? ` · ${a.reason}` : ''}`),
      h('span', { class: `status ${cls}` }, label)),
    h('span', { class: 'list-row-trail' },
      h('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => openForm(a) }, 'Edit')));
}

function draw() {
  const today = todayIst();
  const upcoming = items.filter((a) => a.status === 'scheduled' && a.date >= today);
  const past = items.filter((a) => !(a.status === 'scheduled' && a.date >= today)).reverse();
  upcomingEl.replaceChildren(...(upcoming.length ? upcoming.map(row) : [empty({ iconName: 'calendar', title: 'No upcoming appointments', text: 'Booked a visit with a hospital or doctor? Log it here so the date, time and place are easy to find.', action: h('button', { class: 'btn btn-primary', type: 'button', onclick: () => openForm() }, icon('plus', 18), 'Log an appointment') })]));
  pastEl.replaceChildren(...(past.length ? past.map(row) : [h('p', { class: 't-subhead muted' }, 'Past and cancelled appointments appear here.')]));
}

function openForm(existing = null) {
  const q = new URLSearchParams(location.search);
  const a = existing || { doctorName: q.get('doctor') || '', speciality: q.get('speciality') || '', place: q.get('place') || '', date: todayIst(), time: '10:00', reason: '', notes: '' };
  const doctor = h('input', { class: 'input', value: a.doctorName, maxlength: 100, placeholder: 'For example Dr. Ananya Rao' });
  const speciality = h('input', { class: 'input', value: a.speciality, maxlength: 60, placeholder: 'For example Cardiology' });
  const place = h('input', { class: 'input', value: a.place, maxlength: 150, placeholder: 'Hospital or clinic name' });
  const date = h('input', { class: 'input', type: 'date', value: a.date });
  const time = h('input', { class: 'input num', type: 'time', value: a.time });
  const reason = h('input', { class: 'input', value: a.reason, maxlength: 200, placeholder: 'For example Follow-up for blood pressure' });
  const notes = h('textarea', { class: 'textarea', maxlength: 300, placeholder: 'Things to bring or ask' }, a.notes);
  const status = existing ? h('select', { class: 'select' }, Object.entries(STATUS).map(([v, [label]]) => h('option', { value: v, selected: v === a.status }, label))) : null;
  const message = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const save = h('button', { class: 'btn btn-primary', type: 'submit' }, existing ? 'Save' : 'Log appointment');

  const form = h('form', { class: 'card card-raised form-section', novalidate: true, id: 'new' },
    h('div', { class: 'spread' },
      h('h2', { class: 't-title-2' }, existing ? 'Edit appointment' : 'Log an appointment'),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: () => formSlot.replaceChildren() }, icon('close', 18))),
    h('p', { class: 't-subhead muted' }, 'For appointments you booked with the hospital or clinic. CareRoute keeps a record, it does not book.'),
    message,
    h('div', { class: 'form-grid' },
      field({ id: 'doctorName', label: 'Doctor', input: doctor }),
      field({ id: 'speciality', label: 'Speciality', input: speciality }),
      field({ id: 'place', label: 'Hospital or clinic', input: place, span2: true }),
      field({ id: 'date', label: 'Date', input: date }),
      field({ id: 'time', label: 'Time', input: time }),
      field({ id: 'reason', label: 'Reason', input: reason, span2: true }),
      field({ id: 'notes', label: 'Notes', input: notes, span2: true }),
      status ? field({ id: 'status', label: 'Status', input: status }) : null),
    h('div', { class: 'row', style: 'justify-content:space-between' },
      existing ? h('button', {
        class: 'btn btn-destructive', type: 'button',
        onclick: async () => {
          if (!(await confirmDialog({ title: 'Delete this appointment?', text: `${existing.doctorName}, ${dateLong(existing.date)} at ${existing.time}.` }))) return;
          try {
            await api(`/patients/me/appointments/${existing.id}`, { method: 'DELETE' });
            items = items.filter((x) => x.id !== existing.id);
            formSlot.replaceChildren();
            draw();
            toast('Appointment deleted');
          } catch (err) {
            toast(err.message);
          }
        },
      }, icon('trash', 16), 'Delete') : h('span'),
      save));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const restore = busy(save);
    const body = { doctorName: doctor.value, speciality: speciality.value, place: place.value, date: date.value, time: time.value, reason: reason.value, notes: notes.value };
    if (status) body.status = status.value;
    try {
      const saved = existing ? await api(`/patients/me/appointments/${existing.id}`, { method: 'PATCH', body }) : await api('/patients/me/appointments', { body });
      items = existing ? items.map((x) => (x.id === saved.id ? saved : x)) : [...items, saved];
      items.sort((x, y) => `${x.date}${x.time}`.localeCompare(`${y.date}${y.time}`));
      formSlot.replaceChildren();
      draw();
      toast(existing ? 'Appointment saved' : 'Appointment logged');
    } catch (err) {
      restore();
      showErrors(form, err, message);
    }
  });

  formSlot.replaceChildren(form);
  doctor.focus();
}

function render() {
  draw();
  main.replaceChildren(h('div', { class: 'page' },
    pageHead({
      title: 'Appointments',
      sub: 'A record of the appointments you booked, so the next one is always on your dashboard.',
      actions: h('button', { class: 'btn btn-primary', type: 'button', onclick: () => openForm() }, icon('plus', 18), 'Log appointment'),
    }),
    formSlot,
    h('div', { class: 'grid-main-side' },
      h('section', { class: 'card stack-16' }, h('h2', { class: 't-title-2' }, 'Upcoming'), upcomingEl),
      h('section', { class: 'card stack-16' }, h('h2', { class: 't-title-3' }, 'Past and cancelled'), pastEl))));
}
