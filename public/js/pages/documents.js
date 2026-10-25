import { h, icon, toast } from '../h.js';
import { api, uploadTo } from '../api.js';
import { shell, loadError } from '../shell.js';
import { pageHead, field, showErrors, busy, confirmDialog, empty } from '../ui.js';
import { dateLong, bytes } from '../format.js';

const KINDS = [['lab', 'Lab report'], ['prescription', 'Prescription'], ['scan', 'Scan or X-ray'], ['discharge', 'Discharge summary'], ['insurance', 'Insurance'], ['other', 'Other']];
const KIND_LABEL = Object.fromEntries(KINDS);
const TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX = 10 * 1024 * 1024;

const { main } = await shell({ nav: 'documents', title: 'Documents' });

let docs = [];
const listEl = h('div', { class: 'list' });

try {
  docs = (await api('/patients/me/reports')).reports;
  render();
} catch (err) {
  loadError(main, err);
}

function draw() {
  listEl.replaceChildren(...(docs.length ? docs.map((d) => h('div', { class: 'list-row' },
    h('span', { class: 'obj' }, icon(d.contentType === 'application/pdf' ? 'report' : 'camera', 22)),
    h('span', { class: 'list-row-main' },
      h('span', { class: 'list-row-title' }, d.title),
      h('span', { class: 'list-row-meta' }, `${KIND_LABEL[d.kind] || 'Document'} · ${dateLong(d.uploadedAt)} · ${bytes(d.sizeBytes)}`)),
    h('span', { class: 'file-row-actions' },
      h('button', {
        class: 'icon-btn', type: 'button', 'aria-label': `Open ${d.title}`,
        onclick: async () => {
          try {
            const { url } = await api(`/patients/me/reports/${d.id}/download`);
            window.open(url, '_blank', 'noopener');
          } catch (err) {
            toast(err.message);
          }
        },
      }, icon('download', 18)),
      h('button', {
        class: 'icon-btn', type: 'button', 'aria-label': `Delete ${d.title}`,
        onclick: async () => {
          if (!(await confirmDialog({ title: `Delete ${d.title}?`, text: 'The file is removed for good.' }))) return;
          try {
            await api(`/patients/me/reports/${d.id}`, { method: 'DELETE' });
            docs = docs.filter((x) => x.id !== d.id);
            draw();
            toast('Document deleted');
          } catch (err) {
            toast(err.message);
          }
        },
      }, icon('trash', 18))))) : [empty({ iconName: 'report', title: 'No documents yet', text: 'Upload lab reports, prescriptions, scans and discharge summaries so they are with you when you need them.' })]));
}

function uploadCard() {
  const file = h('input', { type: 'file', accept: '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png', class: 'visually-hidden', id: 'doc-file' });
  const chosen = h('span', { class: 't-subhead muted' }, 'PDF, JPEG or PNG, up to 10 MB.');
  const title = h('input', { class: 'input', maxlength: 120, placeholder: 'For example Blood test, October' });
  const kind = h('select', { class: 'select' }, KINDS.map(([v, l]) => h('option', { value: v }, l)));
  const message = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const submit = h('button', { class: 'btn btn-primary', type: 'submit' }, icon('upload', 18), 'Upload');

  file.addEventListener('change', () => {
    const f = file.files?.[0];
    if (!f) return;
    chosen.textContent = `${f.name} · ${bytes(f.size)}`;
    if (!title.value) title.value = f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
  });

  const form = h('form', { class: 'card card-raised form-section', novalidate: true },
    h('h2', { class: 't-title-2' }, 'Upload a document'),
    message,
    h('label', { class: 'dropzone', for: 'doc-file' },
      h('span', { class: 'empty-art' }, icon('upload', 30)),
      h('span', { class: 't-headline' }, 'Choose a file'),
      chosen,
      file),
    field({ id: 'title', label: 'Title', input: title }),
    field({ id: 'kind', label: 'Type', input: kind }),
    h('p', { class: 't-footnote muted' }, 'Private to you. Files open with short-lived links and are never public.'),
    submit);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = file.files?.[0];
    if (!f) { showErrors(form, { message: 'Choose a file to upload.' }, message); return; }
    if (!TYPES.includes(f.type)) { showErrors(form, { message: 'Use a PDF, JPEG or PNG file.' }, message); return; }
    if (f.size > MAX) { showErrors(form, { message: 'Files can be up to 10 MB.' }, message); return; }
    const restore = busy(submit, 'Uploading');
    try {
      const start = await api('/patients/me/reports', { body: { title: title.value, kind: kind.value, fileName: f.name, contentType: f.type, sizeBytes: f.size } });
      await uploadTo(start.uploadUrl, f);
      const saved = await api(`/patients/me/reports/${start.id}/complete`, { method: 'POST' });
      docs = [saved, ...docs];
      draw();
      form.reset();
      chosen.textContent = 'PDF, JPEG or PNG, up to 10 MB.';
      message.hidden = true;
      toast('Document uploaded');
    } catch (err) {
      showErrors(form, err, message);
    } finally {
      restore();
    }
  });
  return form;
}

function render() {
  draw();
  main.replaceChildren(h('div', { class: 'page' },
    pageHead({ art: 'document', title: 'Documents', sub: 'Your medical documents in one private place.' }),
    h('div', { class: 'grid-main-side' },
      h('section', { class: 'card stack-16' }, h('h2', { class: 't-title-2' }, 'Your documents'), listEl),
      uploadCard())));
}
