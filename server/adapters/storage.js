// File storage behind one interface (docs/02-trd.md section 7). Supabase Storage when the
// service key is set, an in-memory map otherwise (P-27). Buckets are private; files are only
// reached through short-lived signed links (P-26).
import { randomToken } from '../auth/crypto.js';
import { getConfig } from '../config.js';
import { HttpError } from '../http.js';

const SIGNED_SECONDS = 300;

/** File types we accept, checked against the first bytes, not only the declared type. */
export const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// The first bytes of each accepted type; null matches any byte (the size field inside RIFF).
export const SIGNATURES = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/webp': [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50],
  // A .docx is a zip; the assistant checks for word/document.xml when it reads one.
  [DOCX]: [0x50, 0x4b, 0x03, 0x04],
};

export function sniffOk(contentType, bytes) {
  const sig = SIGNATURES[contentType];
  return Boolean(sig) && bytes.length >= sig.length && sig.every((b, i) => b === null || bytes[i] === b);
}

function memoryStorage() {
  const objects = new Map();
  const uploads = new Map();
  const downloads = new Map();
  return {
    kind: 'memory',
    async createUpload(bucket, path) {
      const token = randomToken(24);
      uploads.set(token, { bucket, path, expires: Date.now() + SIGNED_SECONDS * 1000 });
      return { uploadUrl: `/api/v1/uploads/${token}`, method: 'PUT' };
    },
    /** Called by the local upload route. */
    async acceptUpload(token, contentType, bytes) {
      const u = uploads.get(token);
      if (!u || u.expires < Date.now()) throw new HttpError(404, 'upload_expired', 'This upload link has expired. Start again.');
      uploads.delete(token);
      objects.set(`${u.bucket}/${u.path}`, { contentType, bytes });
    },
    async head(bucket, path) {
      const o = objects.get(`${bucket}/${path}`);
      return o ? { size: o.bytes.length, contentType: o.contentType, firstBytes: o.bytes.subarray(0, 12) } : null;
    },
    async signedDownload(bucket, path) {
      const token = randomToken(24);
      downloads.set(token, { key: `${bucket}/${path}`, expires: Date.now() + SIGNED_SECONDS * 1000 });
      return `/api/v1/files/${token}`;
    },
    async readDownload(token) {
      const d = downloads.get(token);
      if (!d || d.expires < Date.now()) return null;
      return objects.get(d.key) || null;
    },
    async remove(bucket, path) {
      objects.delete(`${bucket}/${path}`);
    },
    /** The whole file, for the assistant to read a document the patient chose (D-67). */
    async read(bucket, path) {
      const o = objects.get(`${bucket}/${path}`);
      return o ? { contentType: o.contentType, bytes: Buffer.from(o.bytes) } : null;
    },
  };
}

// Supabase Storage REST calls. Written against the documented API; not yet run against the
// project because the service key is not set (see CHANGELOG).
function supabaseStorage({ url, serviceKey }) {
  const base = `${url.replace(/\/$/, '')}/storage/v1`;
  const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey };
  async function call(method, path, body) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new HttpError(502, 'storage_error', 'File storage is not available right now. Try again.');
    return res.status === 204 ? null : res.json();
  }
  return {
    kind: 'supabase',
    async createUpload(bucket, path) {
      const out = await call('POST', `/object/upload/sign/${bucket}/${path}`);
      return { uploadUrl: `${base}${out.url}`, method: 'PUT' };
    },
    async head(bucket, path) {
      const res = await fetch(`${base}/object/authenticated/${bucket}/${path}`, { headers: { ...headers, Range: 'bytes=0-11' }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      const firstBytes = new Uint8Array(await res.arrayBuffer());
      const range = res.headers.get('content-range');
      const size = range ? Number(range.split('/')[1]) : Number(res.headers.get('content-length'));
      return { size, contentType: res.headers.get('content-type'), firstBytes };
    },
    async signedDownload(bucket, path, { download = false } = {}) {
      const out = await call('POST', `/object/sign/${bucket}/${path}`, { expiresIn: SIGNED_SECONDS });
      // Documents are forced to download so a file can never render as a page on the storage host.
      return `${base}${out.signedURL}${download ? '&download=' : ''}`;
    },
    async remove(bucket, path) {
      await call('DELETE', `/object/${bucket}`, { prefixes: [path] });
    },
    /** The whole file, for the assistant to read a document the patient chose (D-67). */
    async read(bucket, path) {
      const res = await fetch(`${base}/object/authenticated/${bucket}/${path}`, { headers, signal: AbortSignal.timeout(15000) });
      if (res.status === 404 || res.status === 400) return null;
      if (!res.ok) throw new HttpError(502, 'storage_error', 'File storage is not available right now. Try again.');
      return { contentType: res.headers.get('content-type'), bytes: Buffer.from(await res.arrayBuffer()) };
    },
  };
}

let storage = null;
export function getStorage() {
  if (!storage) {
    const cfg = getConfig().storage;
    storage = cfg ? supabaseStorage(cfg) : memoryStorage();
  }
  return storage;
}

export function setStorageForTests(s) {
  storage = s;
}

export { memoryStorage };
