const fs = require('fs')
const { promisify } = require('util')
fs.open = promisify(fs.open)
fs.access = promisify(fs.access)
const { Reader, EmptyReader, NoWriter, CachingReader, CachingDeferredWriter } = require('./reader-writer-iface')
const createFileReader = require('./reader-file')
const createStreamWriter = require('./writer-stream')
const ZipDatastore = require('./zipdatastore')
const { fromBuffer } = require('./zipcar-browser')

async function fromFile (file) {
  const reader = await createFileReader(file)
  const writer = new NoWriter()
  return new ZipDatastore(reader, writer)
}

async function toStream (stream) {
  const reader = new Reader()
  const writer = await createStreamWriter(stream)
  return new ZipDatastore(reader, writer)
}

async function readWriteFile (file) {
  let reader

  try {
    await fs.access(file, fs.constants.R_OK)
  } catch (err) {
    if (err.code === 'ENOENT') {
      // new file
      reader = new EmptyReader()
    } else {
      throw err
    }
  }

  if (!reader) {
    reader = await createFileReader(file)
  }

  reader = new CachingReader(reader)
  const writer = new CachingDeferredWriter(reader, async () => {
    // deferred until close() is called
    const fd = await fs.open(file, 'w')
    const stream = fs.createWriteStream(file, { fd })
    return createStreamWriter(stream)
  })
  return new ZipDatastore(reader, writer)
}

module.exports.fromBuffer = fromBuffer
module.exports.fromFile = fromFile
module.exports.toStream = toStream
module.exports.readWriteFile = readWriteFile
