const { NoWriter } = require('./lib/reader-writer-iface')
const createBufferReader = require('./lib/reader-buffer')
const ZipDatastore = require('./zipdatastore')

/**
 * @name ZipDatastore.readBuffer
 * @description
 * Create a ZipDatastore from a Buffer containing the contents of an existing
 * ZIP archive which contains IPLD data. The ZipDatastore returned will not
 * support mutation operations (`put()`, `delete()`, `setRoots()`).
 *
 * This create-mode is memory intensive as the Buffer is kept in memory while
 * this ZipDatastore remains active. However, this create-mode is the only
 * mode supported in a browser environment.
 * @function
 * @memberof ZipDatastore
 * @static
 * @async
 * @param {Buffer|Uint8Array} buffer the byte contents of a ZIP archive
 * @returns {ZipDatastore} a read-only ZipDatastore.
 */
async function readBuffer (buffer) {
  const reader = await createBufferReader(buffer)
  const writer = new NoWriter()
  return new ZipDatastore(reader, writer)
}

module.exports.readBuffer = readBuffer

// for backward compat to not impact semver-major in v2
module.exports.fromBuffer = readBuffer
