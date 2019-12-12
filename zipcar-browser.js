const { NoWriter } = require('./lib/reader-writer-iface')
const createBufferReader = require('./lib/reader-buffer')
const ZipDatastore = require('./lib/zipdatastore')

async function fromBuffer (buffer) {
  const reader = await createBufferReader(buffer)
  const writer = new NoWriter()
  return new ZipDatastore(reader, writer)
}

module.exports.fromBuffer = fromBuffer
