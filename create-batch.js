const fs = require('fs')
const { promisify } = require('util')
const ZipArchiveOutputStream = require('compress-commons').ZipArchiveOutputStream
const ZipArchiveEntry = require('compress-commons').ZipArchiveEntry
const CID = require('cids')
const { cidToKey } = require('./util')

async function createBatch (roots, iter, output) {
  if (!Array.isArray(roots)) {
    roots = [roots]
  }
  const comment = []
  for (const root of roots) {
    if (!CID.isCID(root)) {
      throw new TypeError('`roots` must be a CID or an array of CIDs')
    }
    comment.push(cidToKey(root))
  }

  if (typeof output === 'string') {
    output = fs.createWriteStream(output)
  }
  if (typeof output.pipe !== 'function' && typeof output.on !== 'function') {
    throw new TypeError('Must provide an output stream or a filename')
  }

  const zipStream = new ZipArchiveOutputStream()
  zipStream.entryAsync = promisify(zipStream.entry)
  zipStream.setComment(comment.join('\n'))
  zipStream.pipe(output)

  for await (const block of iter) {
    if (typeof block.isBlock !== 'function' || typeof block.cid !== 'function' || typeof block.encode !== 'function') {
      throw new TypeError('Iterator didn\'t yield IPLD Block type')
    }

    const cid = await block.cid()
    if (!CID.isCID(cid)) {
      throw new TypeError('Block#cid() didn\'t provide a CID')
    }

    const buf = block.encode()
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('Block#encode() didn\'t provide a Buffer')
    }

    const entry = new ZipArchiveEntry(cidToKey(cid))
    entry.setTime(new Date())
    entry.setMethod(8) // DEFLATE=8, STORE=0
    // entry.setComment(comment)
    entry.setUnixMode(40960) // 0120000
    await zipStream.entryAsync(entry, buf)
  }

  return new Promise((resolve, reject) => {
    zipStream.finish()
    zipStream.on('error', reject)
    output.on('error', reject)
    output.on('finish', resolve)
  })
}

module.exports = createBatch
