import { h } from '../h.js';
import { shell } from '../shell.js';
import { searchPage, chip, withOrigin } from '../search.js';
import { listingRow, rating, distance, doctorPhoto } from '../ui.js';

const SPECIALITIES = ['Cardiology', 'Dermatology', 'ENT', 'Gastroenterology', 'General Medicine', 'General Surgery', 'Nephrology', 'Neonatology', 'Neurology', 'Obstetrics and Gynaecology', 'Ophthalmology', 'Orthopaedics', 'Paediatrics', 'Physiotherapy', 'Pulmonology', 'Spine Surgery', 'Urology'];

function specialitySelect(params, update, key) {
  const sel = h('select', { class: 'select', 'aria-label': 'Speciality', style: 'width:auto;min-width:200px' },
    h('option', { value: '' }, 'Any speciality'),
    SPECIALITIES.map((s) => h('option', { value: s, selected: params.get(key) === s }, s)));
  sel.addEventListener('change', () => update({ [key]: sel.value }));
  return sel;
}

const { main } = await shell({ nav: 'hospitals', title: 'Hospitals and doctors' });

searchPage({
  main,
  title: 'Hospitals and doctors',
  sub: 'Find hospitals by name, speciality or department, or find a doctor directly. Contact them to confirm timings before you go.',
  tabs: [
    {
      id: 'hospitals', label: 'Hospitals', noun: 'hospital', key: 'hospitals',
      placeholder: 'Hospital name, speciality or department',
      endpoint: (p, o) => withOrigin('/hospitals', p, o, ['q', 'area', 'speciality', 'emergency']),
      filters: (p, update) => [
        specialitySelect(p, update, 'speciality'),
        chip('Emergency department', p.get('emergency') === '1', () => update({ emergency: p.get('emergency') !== '1' })),
      ],
      row: (x) => listingRow({
        href: `/hospital/?id=${x.id}`, kind: 'hospital', title: x.name,
        meta: [[x.area, x.specialities.slice(0, 3).join(', ')].filter(Boolean).join(' · '),
          h('span', { class: 'row-8' }, rating(x), x.emergencyAvailable ? h('span', { class: 'tag tag-success' }, 'Emergency department') : null)],
        trail: distance(x),
      }),
      pin: (x) => ({ ...x.location, kind: 'hospital', label: x.name, href: `/hospital/?id=${x.id}` }),
    },
    {
      id: 'doctors', label: 'Doctors', noun: 'doctor', key: 'doctors',
      placeholder: 'Doctor name or specialization',
      endpoint: (p, o) => {
        const url = withOrigin('/doctors', p, o, ['q', 'area']);
        return p.get('speciality') ? `${url}&specialization=${encodeURIComponent(p.get('speciality'))}` : url;
      },
      filters: (p, update) => [specialitySelect(p, update, 'speciality')],
      row: (d) => listingRow({
        href: `/doctor/?id=${d.id}`, kind: 'doctor', title: d.name, media: doctorPhoto(d, 'avatar-m'),
        meta: [[d.specialization, d.experienceYears !== null ? `${d.experienceYears} years` : ''].filter(Boolean).join(' · '), `${d.place.name}, ${d.place.area}`,
          h('span', { class: 'row-8' }, rating(d), d.consultationFeeInr !== null ? h('span', { class: 'tag' }, `Fee ₹${d.consultationFeeInr}`) : null, d.bookingUrl ? h('span', { class: 'tag tag-success' }, 'Online booking') : null)],
        trail: distance(d),
      }),
      pin: (d) => ({ ...d.place.location, kind: 'doctor', label: d.name, href: `/doctor/?id=${d.id}` }),
    },
  ],
});
