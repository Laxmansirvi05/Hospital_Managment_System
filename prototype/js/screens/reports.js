import { h, icon, toast } from '../h.js';
import { REPORTS } from '../data.js';
import { pageHead, disclaimer } from './ui.js';

export function list() {
  const file = h('input', { type: 'file', id: 'file', class: 'visually-hidden', accept: '.pdf,.jpg,.jpeg,.png' });
  file.addEventListener('change', () => {
    if (file.files?.length) toast('Prototype only. The file was not uploaded anywhere.');
    file.value = '';
  });

  const el = h('div', { class: 'page' },
    pageHead({ title: 'Medical reports', sub: 'Keep lab reports, prescriptions and scans in one place, and get a plain-language explanation of any report.' }),
    h('div', { class: 'grid-main-side' },
      h('section', { class: 'card stack-16', 'aria-labelledby': 'rl-h' },
        h('h2', { class: 't-title-2', id: 'rl-h' }, `Your reports (${REPORTS.length})`),
        h('div', { class: 'list' }, REPORTS.map((r) => h('a', { class: 'list-row', href: `#/reports/${r.id}` },
          h('span', { class: 'obj' }, icon('report', 22)),
          h('span', { class: 'list-row-main' },
            h('span', { class: 'list-row-title' }, r.title),
            h('span', { class: 'list-row-meta' }, `${r.kind} · ${r.lab} · Uploaded ${r.uploaded}`),
          ),
          h('span', { class: 'list-row-trail' },
            r.values.some((v) => v.flag) ? h('span', { class: 'tag tag-warning' }, 'Values flagged by the report') : null,
            icon('chevron', 18)),
        ))),
      ),
      h('div', { class: 'stack-16' },
        h('label', { class: 'dropzone', for: 'file' },
          h('span', { class: 'obj', style: 'width:56px;height:56px' }, icon('upload', 26)),
          h('span', { class: 't-headline' }, 'Upload a report'),
          h('span', { class: 't-subhead muted' }, 'PDF, JPEG or PNG. The file is private until you choose to share it.'),
          h('span', { class: 'btn btn-secondary', style: 'margin-top:var(--space-8)' }, 'Choose file'),
          file,
        ),
        h('p', { class: 'notice notice-neutral' }, icon('shield', 18), h('span', {}, 'Only you can see your reports. Files are opened with short-lived links and are never public.')),
      ),
    ),
  );
  return { el, title: 'Medical reports' };
}

function pageStack(r) {
  const rows = r.values.length
    ? r.values.map((v) => h('div', { class: `page3d-row${v.flag ? ' is-flag' : ''}` }, h('span', {}, v.name), h('span', { class: 'num' }, `${v.value} ${v.unit}`)))
    : [1, 2, 3, 4, 5, 6].map((n) => h('div', { class: 'page3d-line', style: `width:${100 - n * 9}%` }));
  return h('div', { class: 'pages3d', 'aria-hidden': 'true' },
    h('div', { class: 'pages3d-stack' },
      h('div', { class: 'page3d' }),
      h('div', { class: 'page3d' }),
      h('div', { class: 'page3d' },
        h('div', { class: 'spread' }, h('span', { style: 'font-size:11px;font-weight:700' }, r.lab), h('span', { style: 'font-size:9px;color:var(--text-2)' }, r.uploaded)),
        h('div', { style: 'font-size:12px;font-weight:700;margin-top:var(--space-4)' }, r.title),
        h('div', { class: 'page3d-line', style: 'width:60%' }),
        rows,
        h('div', { class: 'page3d-line', style: 'width:80%;margin-top:var(--space-8)' }),
        h('div', { class: 'page3d-line', style: 'width:50%' }),
      ),
    ),
  );
}

function explanation(r) {
  return h('div', { class: 'stack-24' },
    h('section', { class: 'card card-raised stack-12' },
      h('h2', { class: 't-title-3' }, 'In plain words'),
      h('p', { class: 't-callout', style: 'max-width:680px' }, r.summary),
    ),
    r.values.length ? h('section', { class: 'stack-12' },
      h('h2', { class: 't-title-3' }, 'Your values against the report’s ranges'),
      h('div', { class: 'table-wrap' },
        h('table', {},
          h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Test'), h('th', { scope: 'col', class: 'num' }, 'Your value'), h('th', { scope: 'col' }, 'Range on report'), h('th', { scope: 'col' }, 'Report says'))),
          h('tbody', {}, r.values.map((v) => h('tr', {},
            h('td', {}, v.name),
            h('td', { class: 'num strong', style: 'white-space:nowrap' }, `${v.value} ${v.unit}`),
            h('td', { class: 'num' }, v.range),
            h('td', {}, v.flag ? h('span', { class: 'status status-warn' }, v.flag) : h('span', { class: 'status status-ok' }, 'In range')),
          ))),
        ),
      ),
    ) : null,
    h('section', { class: 'card stack-12' },
      h('h2', { class: 't-title-3' }, 'Words on this report'),
      h('dl', { class: 'facts' }, r.terms.map((x) => h('div', {}, h('dt', { style: 'color:var(--text-1);font-size:var(--fs-callout)' }, x.term), h('dd', { class: 'muted' }, x.meaning)))),
    ),
    h('section', { class: 'card stack-12' },
      h('h2', { class: 't-title-3' }, 'Questions you could ask your doctor'),
      h('ul', { class: 'stack-8' }, r.questions.map((q) => h('li', { class: 'row-8', style: 'flex-wrap:nowrap;align-items:flex-start' }, h('span', { style: 'color:var(--primary)' }, icon('assistant', 18)), q))),
    ),
    disclaimer('This explanation is general information, not a diagnosis. Only a doctor who knows your history can say what these results mean for you.'),
  );
}

export function detail({ params }) {
  const r = REPORTS.find((x) => x.id === params.id) || REPORTS[0];
  const right = h('div', { class: 'stack-24' });

  const consent = h('section', { class: 'card card-raised stack-16' },
    h('div', { class: 'stack-4' },
      h('h2', { class: 't-title-2' }, 'Explain this report'),
      h('p', { class: 't-subhead muted' }, 'Get the terms and values explained in plain words, with questions you could ask your doctor.'),
    ),
    h('p', { class: 'notice' }, icon('info', 18),
      h('span', {}, 'In the real product, this report is sent to an AI service to explain it. In this prototype the explanation is a sample and nothing is sent.')),
    h('div', { class: 'row' },
      h('button', { class: 'btn btn-primary', type: 'button', onclick: () => { right.replaceChildren(explanation(r)); right.querySelector('h2')?.focus?.(); } }, 'Explain this report'),
    ),
  );
  right.append(consent);

  const el = h('div', { class: 'page' },
    pageHead({ title: r.title, crumbs: [['Reports', '#/reports'], [r.title]], large: false, sub: `${r.kind} from ${r.lab} · Uploaded ${r.uploaded}` }),
    h('div', { class: 'grid-report' },
      h('div', { class: 'stack-16' },
        pageStack(r),
        h('section', { class: 'card stack-12' },
          h('dl', { class: 'facts facts-2' },
            h('div', {}, h('dt', {}, 'File'), h('dd', {}, r.file)),
            h('div', {}, h('dt', {}, 'Size'), h('dd', { class: 'num' }, r.size)),
          ),
          h('p', { class: 'status status-ok' }, 'Private. Only you can see this report.'),
          h('div', { class: 'row' },
            h('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => toast('Prototype only. Nothing was downloaded.') }, 'Download'),
            h('button', { class: 'btn btn-destructive btn-sm', type: 'button', onclick: () => toast('Prototype only. Nothing was deleted.') }, 'Delete'),
          ),
        ),
      ),
      right,
    ),
  );
  return { el, title: r.title };
}
