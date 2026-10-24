// Documents and the patient photo (D-06, D-39, P-26). The browser uploads straight to storage
// with a one-time link; the server then checks the stored bytes before marking the file ready.
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getStore } from '../db/index.js';
import { getStorage, sniffOk } from '../adapters/storage.js';
import { HttpError, parse, readJson, readRaw, notFound, invalid } from '../http.js';
import { fileView } from './patients.js';
import { limit, LIMITS as RATE } from '../limits.js';

const PATIENT = ['patient'];
const BUCKETS = { document: 'patient-documents', photo: 'patient-photos' };
// Limits are PROPOSED until Q-11 is answered (P-26 for photos).
const LIMITS = {
  document: { types: ['application/pdf', 'image/jpeg', 'image/png'], maxBytes: 10 * 1024 * 1024 },
  photo: { types: ['image/jpeg', 'image/png'], maxBytes: 2 * 1024 * 1024 },
};

const docSchema = z.object({
  title: z.string().trim().min(1, 'Enter a title').max(120),
  kind: z.enum(['lab', 'prescription', 'scan', 'discharge', 'insurance', 'other']),
  fileName: z.string().trim().min(1).max(200),
  contentType: z.enum(LIMITS.document.types, { message: 'Use a PDF, JPEG or PNG file' }),
  sizeBytes: z.number().int().min(1).max(LIMITS.document.maxBytes, 'Files can be up to 10 MB'),
}).strict();

const photoSchema = z.object({
  contentType: z.enum(LIMITS.photo.types, { message: 'Use a JPEG or PNG photo' }),
  sizeBytes: z.number().int().min(1).max(LIMITS.photo.maxBytes, 'Photos can be up to 2 MB'),
}).strict();

function fileId(params) {
  const r = z.string().uuid().safeParse(params.id);
  if (!r.success) throw notFound();
  return r.data;
}

async function startUpload(user, purpose, meta) {
  await limit('upload-account', user.id, ...RATE.uploadPerAccount);
  // Unfinished uploads hold storage until cleaned up, so each account may only have a few open.
  if ((await getStore().files.pendingCount(user.id)) >= RATE.maxPendingUploads) {
    throw new HttpError(429, 'too_many_uploads', 'Finish or cancel your other uploads first.');
  }
  const path = `${user.id}/${randomUUID()}`;
  const record = await getStore().files.create(user.id, { purpose, storagePath: path, ...meta });
  const { uploadUrl, method } = await getStorage().createUpload(BUCKETS[purpose], path);
  return { id: record.id, uploadUrl, method, contentType: meta.contentType };
}

async function verifyUpload(user, id, purpose) {
  const store = getStore();
  const f = await store.files.get(user.id, id);
  if (!f || f.purpose !== purpose) throw notFound();
  if (f.status === 'ready') return f;
  const head = await getStorage().head(BUCKETS[purpose], f.storagePath);
  if (!head) throw invalid('file', 'The file has not finished uploading.');
  const bad = head.size !== f.sizeBytes || !sniffOk(f.contentType, head.firstBytes);
  if (bad) {
    await getStorage().remove(BUCKETS[purpose], f.storagePath);
    await store.files.remove(user.id, id);
    throw invalid('file', 'The file does not match its type or size. Upload it again.');
  }
  return store.files.markReady(user.id, id);
}

export const routes = [
  {
    method: 'POST', path: '/patients/me/reports', roles: PATIENT,
    async handler({ req, user }) {
      const body = parse(docSchema, await readJson(req));
      return { status: 201, body: await startUpload(user, 'document', body) };
    },
  },
  {
    method: 'POST', path: '/patients/me/reports/:id/complete', roles: PATIENT,
    async handler({ params, user }) {
      return { body: fileView(await verifyUpload(user, fileId(params), 'document')) };
    },
  },
  {
    method: 'GET', path: '/patients/me/reports', roles: PATIENT,
    async handler({ user }) {
      return { body: { reports: (await getStore().files.list(user.id, 'document')).map(fileView) } };
    },
  },
  {
    method: 'GET', path: '/patients/me/reports/:id/download', roles: PATIENT,
    async handler({ params, user }) {
      const f = await getStore().files.get(user.id, fileId(params));
      if (!f || f.purpose !== 'document' || f.status !== 'ready') throw notFound();
      return { body: { url: await getStorage().signedDownload(BUCKETS.document, f.storagePath, { download: true }), expiresInSeconds: 300 } };
    },
  },
  {
    method: 'DELETE', path: '/patients/me/reports/:id', roles: PATIENT,
    async handler({ params, user }) {
      const f = await getStore().files.get(user.id, fileId(params));
      if (!f || f.purpose !== 'document') throw notFound();
      // Storage object first, then the row, so a failure never leaves an orphaned file behind a deleted record.
      await getStorage().remove(BUCKETS.document, f.storagePath);
      await getStore().files.remove(user.id, f.id);
      return { status: 204 };
    },
  },

  {
    method: 'POST', path: '/patients/me/photo', roles: PATIENT,
    async handler({ req, user }) {
      const body = parse(photoSchema, await readJson(req));
      return { status: 201, body: await startUpload(user, 'photo', { title: 'Profile photo', kind: 'photo', fileName: 'photo', ...body }) };
    },
  },
  {
    method: 'POST', path: '/patients/me/photo/:id/complete', roles: PATIENT,
    async handler({ params, user }) {
      const f = await verifyUpload(user, fileId(params), 'photo');
      const store = getStore();
      const previous = (await store.profiles.get(user.id))?.photoFileId;
      await store.profiles.upsert(user.id, { photoFileId: f.id });
      if (previous && previous !== f.id) {
        const old = await store.files.get(user.id, previous);
        if (old) {
          await getStorage().remove(BUCKETS.photo, old.storagePath);
          await store.files.remove(user.id, old.id);
        }
      }
      return { body: { hasPhoto: true } };
    },
  },
  {
    method: 'GET', path: '/patients/me/photo', roles: PATIENT,
    async handler({ user }) {
      const store = getStore();
      const pid = (await store.profiles.get(user.id))?.photoFileId;
      const f = pid ? await store.files.get(user.id, pid) : null;
      if (!f) throw notFound('No photo yet.');
      return { body: { url: await getStorage().signedDownload(BUCKETS.photo, f.storagePath), expiresInSeconds: 300 } };
    },
  },
  {
    method: 'DELETE', path: '/patients/me/photo', roles: PATIENT,
    async handler({ user }) {
      const store = getStore();
      const pid = (await store.profiles.get(user.id))?.photoFileId;
      if (!pid) throw notFound('No photo yet.');
      const f = await store.files.get(user.id, pid);
      if (f) {
        await getStorage().remove(BUCKETS.photo, f.storagePath);
        await store.files.remove(user.id, f.id);
      }
      await store.profiles.upsert(user.id, { photoFileId: null });
      return { status: 204 };
    },
  },

  // Local upload and download endpoints for the in-memory storage only (P-27).
  {
    method: 'PUT', path: '/uploads/:token', roles: 'public', raw: true,
    async handler({ req, res, params }) {
      const storage = getStorage();
      if (storage.kind !== 'memory') throw notFound();
      const contentType = String(req.headers['content-type'] || '').split(';')[0];
      const bytes = await readRaw(req, LIMITS.document.maxBytes);
      await storage.acceptUpload(params.token, contentType, bytes);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end('{"ok":true}');
    },
  },
  {
    method: 'GET', path: '/files/:token', roles: 'public', raw: true,
    async handler({ res, params }) {
      const storage = getStorage();
      if (storage.kind !== 'memory') throw notFound();
      const obj = await storage.readDownload(params.token);
      if (!obj) throw new HttpError(404, 'link_expired', 'This link has expired.');
      // A fixed, safe type and a sandbox, so an uploaded file can never run as a page.
      const type = LIMITS.document.types.includes(obj.contentType) ? obj.contentType : 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': type,
        'Content-Disposition': type === 'application/pdf' ? 'attachment' : 'inline',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      });
      res.end(obj.bytes);
    },
  },
];
