// Generates required PNG assets for EAS build
const zlib = require('zlib')
const fs   = require('fs')
const path = require('path')

function crc32(buf) {
  let crc = 0xFFFFFFFF
  for (const b of buf) {
    crc ^= b
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const t   = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}

function makePNG(w, h, r, g, b, a = 255) {
  const sig  = Buffer.from([137,80,78,71,13,10,26,10])
  const ihdr = Buffer.from([
    0,0,0,0, 0,0,0,0, // w, h — filled below
    8, 6,             // 8-bit RGBA
    0, 0, 0,
  ])
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)

  // One row: filter(0) + RGBA * w
  const row = Buffer.alloc(1 + w * 4)
  for (let x = 0; x < w; x++) {
    row[1 + x*4]   = r; row[1 + x*4+1] = g
    row[1 + x*4+2] = b; row[1 + x*4+3] = a
  }
  const rows = []
  for (let y = 0; y < h; y++) rows.push(row)
  const idat = zlib.deflateSync(Buffer.concat(rows))

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

const dir = path.join(__dirname, 'assets')
fs.mkdirSync(dir, { recursive: true })

// Brand purple: #6C47FF = 108, 71, 255
fs.writeFileSync(path.join(dir, 'icon.png'),          makePNG(1024, 1024, 108, 71, 255))
fs.writeFileSync(path.join(dir, 'adaptive-icon.png'), makePNG(1024, 1024, 108, 71, 255))
fs.writeFileSync(path.join(dir, 'splash.png'),        makePNG(1284, 2778, 108, 71, 255))
fs.writeFileSync(path.join(dir, 'notification-icon.png'), makePNG(96, 96, 255, 255, 255))

console.log('Assets created in ./assets/')
