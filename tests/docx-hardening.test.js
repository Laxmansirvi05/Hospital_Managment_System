import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { docxText } from '../server/assistant/docx.js';

function zip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const source = Buffer.from(entry.data ?? '');
    const method = entry.method ?? 0;
    const data = method === 8 ? deflateRawSync(source) : source;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(source.length, 22);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(source.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const central = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, central, end]);
}

const document = (xml, extra = []) => zip([{ name: 'word/document.xml', data: xml, method: 8 }, ...extra]);

describe('DOCX archive hardening', () => {
  it('rejects DTD and entity declarations', () => {
    const xml = '<!DOCTYPE w:document [<!ENTITY leak SYSTEM "file:///etc/passwd">]><w:document><w:t>&leak;</w:t></w:document>';
    expect(docxText(document(xml))).toBeNull();
  });

  it('rejects archives with too many entries or unsafe paths', () => {
    const crowded = document('<w:document/>', Array.from({ length: 256 }, (_, i) => ({ name: `word/empty-${i}.xml`, data: '' })));
    const traversal = document('<w:document/>', [{ name: '../outside.xml', data: 'x' }]);
    expect(docxText(crowded)).toBeNull();
    expect(docxText(traversal)).toBeNull();
  });

  it('rejects nested archive files and excessive compression ratios', () => {
    const nested = document('<w:document/>', [{ name: 'word/embeddings/attachment.zip', data: 'PK\u0003\u0004' }]);
    const bomb = document(`<w:document><w:t>${'a'.repeat(1_800_000)}</w:t></w:document>`);
    expect(docxText(nested)).toBeNull();
    expect(docxText(bomb)).toBeNull();
  });
});
