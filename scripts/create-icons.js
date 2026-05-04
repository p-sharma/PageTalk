// Generates placeholder solid-color PNGs for 16, 48, and 128px extension icons.
// Run with: node scripts/create-icons.js
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function makeCRCTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
}

const CRC_TABLE = makeCRCTable();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBytes = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBytes, data]);
  const crcBytes = Buffer.alloc(4);
  crcBytes.writeUInt32BE(crc32(crcInput));
  return Buffer.concat([len, typeBytes, data, crcBytes]);
}

function createPNG(size, r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    row[0] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      row[1 + x * 3] = r;
      row[1 + x * 3 + 1] = g;
      row[1 + x * 3 + 2] = b;
    }
    rows.push(row);
  }

  const compressed = zlib.deflateSync(Buffer.concat(rows));

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const iconsDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(iconsDir, { recursive: true });

// Indigo-500 (#6366F1)
const [r, g, b] = [99, 102, 241];

for (const size of [16, 48, 128]) {
  const png = createPNG(size, r, g, b);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), png);
  console.log(`Created icons/icon${size}.png`);
}
