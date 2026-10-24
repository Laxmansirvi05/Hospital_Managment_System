// CareRoute patient reviews (D-43, P-28), shown beside the source platform's rating.
import { z } from 'zod';
import { getStore } from '../db/index.js';
import { parse, readJson, notFound, invalid } from '../http.js';
import { limit } from '../limits.js';

const SIGNED_IN = ['patient', 'driver', 'admin'];
const KINDS = ['hospital', 'doctor', 'pharmacy', 'diagnostic_centre'];
// A review is hidden for admin checking after this many different patients report it (P-28).
const HIDE_AFTER_REPORTS = 3;

const LOOKUP = {
  hospital: (s, id) => s.listings.hospital(id),
  doctor: (s, id) => s.listings.doctor(id),
  pharmacy: (s, id) => s.listings.pharmacy(id),
  diagnostic_centre: (s, id) => s.listings.diagnostic(id),
};

const target = z.object({ kind: z.enum(KINDS), id: z.string().uuid() });
const reviewSchema = z.object({
  kind: z.enum(KINDS),
  id: z.string().uuid(),
  rating: z.number().int().min(1, 'Choose a rating from 1 to 5').max(5, 'Choose a rating from 1 to 5'),
  body: z.string().trim().max(1000, 'Keep it under 1,000 characters').default(''),
}).strict();

/** Only the first name is shown, so a review does not identify its author in full. */
const firstName = (name) => (name || '').trim().split(/\s+/)[0] || 'Patient';

const view = (r, viewerId) => ({
  id: r.id, rating: r.rating, body: r.body, author: firstName(r.authorName), updatedAt: r.updatedAt, mine: r.userId === viewerId,
});

function reviewId(params) {
  const r = z.string().uuid().safeParse(params.id);
  if (!r.success) throw notFound();
  return r.data;
}

export const routes = [
  {
    method: 'GET', path: '/reviews', roles: SIGNED_IN,
    async handler({ query, user }) {
      const t = parse(target, { kind: query.get('kind'), id: query.get('id') });
      const list = await getStore().reviews.list(t.kind, t.id);
      const count = list.length;
      const average = count ? Math.round((list.reduce((a, r) => a + r.rating, 0) / count) * 10) / 10 : null;
      return { body: { summary: { average, count }, reviews: list.map((r) => view(r, user.id)) } };
    },
  },
  {
    method: 'PUT', path: '/reviews', roles: ['patient'],
    async handler({ req, user }) {
      await limit('review-write', user.id, 30, 3600);
      const body = parse(reviewSchema, await readJson(req));
      const store = getStore();
      if (!(await LOOKUP[body.kind](store, body.id))) throw invalid('id', 'This listing no longer exists.');
      const saved = await store.reviews.upsert(user.id, { kind: body.kind, listingId: body.id, rating: body.rating, body: body.body });
      return { body: view({ ...saved, authorName: user.name }, user.id) };
    },
  },
  {
    method: 'DELETE', path: '/reviews/:id', roles: ['patient'],
    async handler({ params, user }) {
      if (!(await getStore().reviews.remove(user.id, reviewId(params)))) throw notFound();
      return { status: 204 };
    },
  },
  {
    method: 'POST', path: '/reviews/:id/report', roles: ['patient'],
    async handler({ params, user }) {
      await limit('review-report', user.id, 20, 3600);
      const id = reviewId(params);
      const r = await getStore().reviews.get(id);
      if (!r || r.status !== 'visible') throw notFound();
      if (r.userId === user.id) throw invalid('review', 'You cannot report your own review.');
      await getStore().reviews.report(user.id, id, HIDE_AFTER_REPORTS);
      return { status: 204 };
    },
  },
];
