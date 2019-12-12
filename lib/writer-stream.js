const { Writer } = require('./reader-writer-iface')
const { promisify } = require('util')
const ZipArchiveOutputStream = require('compress-commons').ZipArchiveOutputStream
const ZipArchiveEntry = require('compress-commons').ZipArchiveEntry

class ZipArchiveOutputStreamWriter extends Writer {
  constructor (outStream) {
    super()
    this._outStream = outStream
    this._zipStream = new ZipArchiveOutputStream()
    this._zipStream.entryAsync = promisify(this._zipStream.entry)
    this._zipStream.pipe(outStream)
    this.comment = ''
  }

  delete (key) {
    throw new Error('Unsupported operation for streaming writer')
  }

  async put (key, value) {
    const entry = new ZipArchiveEntry(key)
    entry.setTime(new Date())
    entry.setMethod(8) // DEFLATE=8, STORE=0
    entry.setUnixMode(40960) // 0120000
    return this._zipStream.entryAsync(entry, Buffer.isBuffer(value) ? value : Buffer.from(value))
  }

  async close () {
    this._zipStream.setComment(this.comment || '')
    return new Promise((resolve, reject) => {
      this._zipStream.finish()
      this._zipStream.on('error', reject)
      this._outStream.on('error', reject)
      this._outStream.on('finish', resolve)
    })
  }
}

async function create (stream) {
  return new ZipArchiveOutputStreamWriter(stream)
}

module.exports = create
