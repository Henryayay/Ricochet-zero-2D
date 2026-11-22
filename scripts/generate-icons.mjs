import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const publicDir = path.resolve('public');
fs.mkdirSync(publicDir, { recursive: true });

// 16x16 pixel-art Ricochet Zero icon: dark void, neon border, cyan core orb, magenta ricochet trail
const ART = [
  '................',
  '.bbbbbbbbbbbbbb.',
  '.b............b.',
  '.b..mm........b.',
  '.b...mm.......b.',
  '.b....mm...cc.b.',
  '.b.....mm.cCCcb.',
  '.b......mcCWWCb.',
  '.b.......cCWWCb.',
  '.b.......mcCCcb.',
  '.b......mm.cc.b.',
  '.b.....mm.....b.',
  '.b....mm......b.',
  '.b..ggg.......b.',
  '.bbbbbbbbbbbbbb.',
  '................',
];

const PALETTE = {
  '.': [7, 8, 15, 255],
  'b': [34, 46, 82, 255],
  'm': [255, 46, 136, 255],
  'c': [44, 245, 255, 255],
  'C': [148, 252, 255, 255],
  'W': [255, 255, 255, 255],
  'g': [255, 212, 71, 255],
};

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makePng(size) {
  const raw = Buffer.alloc(size * (1 + size * 4));
  const scale = size / 16;
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 4);
    raw[rowStart] = 0; // filter none
    const sy = Math.min(15, Math.floor(y / scale));
    const row = ART[sy];
    for (let x = 0; x < size; x++) {
      const sx = Math.min(15, Math.floor(x / scale));
      const rgba = PALETTE[row[sx]] ?? PALETTE['.'];
      const px = rowStart + 1 + x * 4;
      raw[px] = rgba[0];
      raw[px + 1] = rgba[1];
      raw[px + 2] = rgba[2];
      raw[px + 3] = rgba[3];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), makePng(192));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), makePng(512));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), makePng(180));
fs.writeFileSync(path.join(publicDir, 'favicon.png'), makePng(64));
console.log('Generated pixel-art PWA icons in public/');
