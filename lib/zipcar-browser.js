const { NoWriter } = require('./reader-writer-iface')
const createBufferReader = require('./reader-buffer')
const ZipDatastore = require('./zipdatastore')

async function fromBuffer (buffer) {
  const reader = await createBufferReader(buffer)
  const writer = new NoWriter()
  return new ZipDatastore(reader, writer)
}

module.exports.fromBuffer = fromBuffer
