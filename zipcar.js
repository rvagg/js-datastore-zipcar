const fs = require('fs')
const { promisify } = require('util')
fs.open = promisify(fs.open)
fs.access = promisify(fs.access)
const { Reader, EmptyReader, NoWriter, CachingReader, CachingDeferredWriter } = require('./lib/reader-writer-iface')
const createFileReader = require('./lib/reader-file')
const createStreamWriter = require('./lib/writer-stream')
const ZipDatastore = require('./zipdatastore')
const { readBuffer } = require('./zipcar-browser')

/**
 * @name ZipDatastore.readFile
 * @description
 * Create a ZipDatastore from an existing ZIP archive containing IPLD data. The
 * ZipDatastore returned will not support mutation operations (`put()`,
 * `delete()`, `setRoots()`) and reads will not perform any caching but be read
 * via stream from the underlying file on demand.
 *
 * This is an efficient create-mode, useful for reading the contents of an
 * existing, large ZipDatastore archive.
 *
 * This create-mode is not available in a browser environment.
 * @function
 * @memberof ZipDatastore
 * @static
 * @async
 * @param {string} file the path to an existing ZIP archive.
 * @returns {ZipDatastore} a read-only, streaming ZipDatastore.
 */
async function readFile (file) {
  const reader = await createFileReader(file)
  const writer = new NoWriter()
  return new ZipDatastore(reader, writer)
}

/**
 * @name ZipDatastore.writeStream
 * @description
 * Create a ZipDatastore that writes to a writable stream. The ZipDatastore
 * returned will _only_ support append operations (`put()` and `setRoots()`, but
 * not `delete()`) and no caching will be performed, with entries written
 * directly to the provided stream.
 *
 * This is an efficient create-mode, useful for writing large amounts of data to
 * ZIP archive.
 *
 * This create-mode is not available in a browser environment.
 * @function
 * @memberof ZipDatastore
 * @static
 * @async
 * @param {WritableStream} stream a writable stream
 * @returns {ZipDatastore} an append-only, streaming ZipDatastore.
 */
async function writeStream (stream) {
  const reader = new Reader()
  const writer = await createStreamWriter(stream)
  return new ZipDatastore(reader, writer)
}

/**
 * @name ZipDatastore.readWriteFile
 * @description
 * Create a ZipDatastore from an existing ZIP archive containing IPLD data. The
 * ZipDatastore returned will support both read operations (`get()`, `has()`,
 * `getRoots()`), and mutation operations (`put()`,`delete()`, `setRoots()`).
 * Reads will be cached in memory for as long as this ZipDatastore is active and
 * a `close()`, where a mutation operation has been performed, will result in a
 * full read and cache of the original archive prior to flushing back to disk.
 *
 * This is an inefficient create-mode, useful for read/write operations on
 * smaller data sets but not as useful for large data sets.
 *
 * This create-mode is not available in a browser environment.
 * @function
 * @memberof ZipDatastore
 * @static
 * @async
 * @param {string} file the path to an existing ZIP archive.
 * @returns {ZipDatastore} a read-only, streaming ZipDatastore.
 */
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

module.exports.readBuffer = readBuffer
module.exports.readFile = readFile
module.exports.writeStream = writeStream
module.exports.readWriteFile = readWriteFile
