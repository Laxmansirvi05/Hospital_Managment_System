// Reads the text of a Word .docx file for the assistant, with Node's own zlib: a .docx is a zip, and
// its body is word/document.xml. Only paragraph text is kept; images, tables' layout and styling are
// dropped. Anything that is not a well-formed .docx gives null rather than a guess.
import { inflateRawSync } from 'node:zlib';

const MAX_TEXT = 60000;
const MAX_XML = 2 * 1024 * 1024;
const MAX_ENTRIES = 256;
const MAX_TOTAL_UNCOMPRESSED = 8 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 1000;

/** The bytes of one file inside a zip, found through the central directory. */
function zipEntry(buf, wanted) {
  // The end-of-central-directory record sits in the last 64 KB (its comment can be up to 65535 bytes).
  const floor = Math.max(0, buf.length - 65557);
  let eocd = -1;
  for (let i = buf.length - 22; i >= floor; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd === -1) return null;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const centralSize = buf.readUInt32LE(eocd + 12);
  if (count > MAX_ENTRIES || p + centralSize > eocd || count === 0xffff) return null;
  let totalUncompressed = 0;
  let target = null;
  for (let n = 0; n < count && p + 46 <= buf.length; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) return null;
    const method = buf.readUInt16LE(p + 10);
    const compressed = buf.readUInt32LE(p + 20);
    const uncompressed = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    if (p + 46 + nameLen + extraLen + commentLen > eocd) return null;
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const parts = name.replaceAll('\\', '/').split('/');
    if (name.includes('\\') || name.startsWith('/') || parts.some((part) => part === '..') || /\.(?:zip|docx|7z|rar|tar)$/i.test(name)) return null;
    if (uncompressed > MAX_XML) return null;
    totalUncompressed += uncompressed;
    if (totalUncompressed > MAX_TOTAL_UNCOMPRESSED) return null;
    if (uncompressed > 0 && (compressed === 0 || uncompressed / compressed > MAX_COMPRESSION_RATIO)) return null;

    if (local + 30 > p || buf.readUInt32LE(local) !== 0x04034b50) return null;
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    if (start + compressed > p) return null;
    if (method === 0 && compressed >= 4 && buf.readUInt32LE(start) === 0x04034b50) return null;
    if (name === wanted) {
      const data = buf.subarray(start, start + compressed);
      if (method === 0) target = data;
      else if (method === 8) target = inflateRawSync(data, { maxOutputLength: MAX_XML });
      else return null;
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return p === buf.readUInt32LE(eocd + 16) + centralSize ? target : null;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

const decodeRef = (_, n) => {
  const code = Number(n);
  // Out-of-range references would throw; they are dropped instead.
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
};

/**
 * The document's text, or null when the bytes are not a readable .docx. Every pattern below runs in
 * linear time: a crafted file must not be able to hold the server (security review, 2026-11-03).
 */
export function docxText(bytes) {
  try {
    const entry = zipEntry(Buffer.from(bytes), 'word/document.xml');
    if (!entry || entry.length > MAX_XML) return null;
    const xml = entry.toString('utf8');
    if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) return null;
    const text = xml
      // Line breaks inside the XML are formatting, not text.
      .replace(/\r?\n/g, '')
      .replace(/<w:tab\/>/g, '\t')
      .replace(/<w:br\/>|<\/w:p>/g, '\n')
      .replace(/<[^<>]*>/g, '')
      .replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => ENTITIES[e])
      .replace(/&#(\d{1,8});/g, decodeRef)
      .split('\n').map((line) => line.trimEnd()).join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return text ? text.slice(0, MAX_TEXT) : null;
  } catch {
    // Not a well-formed .docx (bad zip, failed inflate, too large): the caller says it cannot be read.
    return null;
  }
}
