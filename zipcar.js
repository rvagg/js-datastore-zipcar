const fs = require('fs')
const { promisify } = require('util')
fs.open = promisify(fs.open)
fs.close = promisify(fs.close)
fs.readFile = promisify(fs.readFile)
fs.stat = promisify(fs.stat)
fs.access = promisify(fs.access)
const ZipArchiveOutputStream = require('compress-commons').ZipArchiveOutputStream
const ZipArchiveEntry = require('compress-commons').ZipArchiveEntry
const CID = require('cids')
const { toKey } = require('./util')
const ZipDatastoreImmutable = require('./zipcar-immutable')
const wrap = require('./zipwrap')

/**
 * ZipDatastore is a class to manage reading from, and writing to a ZIP archives using [CID](https://github.com/multiformats/js-cid)s as keys and
 * file names in the ZIP and binary block data as the file contents.
 *
 * @class
 */
class ZipDatastore extends ZipDatastoreImmutable {
  /**
   * Create a new ZipDatastore backed by a ZIP archive located at the path provided by the `zipFile`
   * argument.
   *
   * If the file located at `zipFile` does not exist, it will be written when `close()` is called. If
   * it exists, it will be opened and parsed and entries made available via `get()` and `has()`.
   *
   * @param {string} zipFile a path to a ZIP archive that may or may not exist.
   */
  constructor (zipFile) {
    super(zipFile)
    this._wrapper = wrap
    this._fromBuffer = Buffer.isBuffer(zipFile)
  }

  /**
   * @name ZipDatastore#open
   * @description
   * Open the ZIP archive and perform an initial parse of the data. This method doesn't need to be called
   * during normal operation. An archive that isn't already open when calling `get()`, `put()`, `has()` it
   * will be opened automatically.
   * @function
   * @async
   * @memberof ZipDatastore
   */
  // super.open()

  /**
   * @name ZipDatastore#get
   * @description
   * Retrieve a block from this archive. `key`s are converted to `CID` automatically, whether you provide a native
   * Datastore `Key` object, a `String` or a `CID`. `key`s that cannot be converted will throw an error.
   * @function
   * @async
   * @memberof ZipDatastore
   * @param {string|Key|CID} key a `CID` or `CID`-convertable object to identify the block.
   * @return {Buffer} the IPLD bloc data referenced by the CID
   */
  // super.get()

  /**
   * @name ZipDatastore#has
   * @description
   * Check whether a block exists in this archive. `key`s are converted to `CID` automatically, whether you provide a native
   * Datastore `Key` object, a `String` or a `CID`. `key`s that cannot be converted will throw an error.
   * @function
   * @async
   * @memberof ZipDatastore
   * @param {string|Key|CID} key a `CID` or `CID`-convertable object to identify the block.
   * @return {boolean}
   */
  // super.has()

  /**
   * @name ZipDatastore#put
   * @description
   * Store a block in this archive. `key`s are converted to `CID` automatically, whether you provide a native
   * Datastore `Key` object, a `String` or a `CID`. `key`s that cannot be converted will throw an error.
   *
   * The entry will not be written to the ZIP archive until `close()` is called, in the meantime it is stored
   * in memory.
   * @function
   * @async
   * @memberof ZipDatastore
   * @param {string|Key|CID} key a `CID` or `CID`-convertable object to identify the `value`.
   * @param {Buffer|Uint8Array} value an IPLD block matching the given `key` `CID`.
   */
  async put (key, value) {
    if (this._fromBuffer) {
      return super.put(key, value)
    }

    key = toKey(key, 'put')

    if (!(value instanceof Uint8Array)) {
      throw new TypeError('put() can only receive Uint8Arrays or Buffers')
    }

    if (!this._wrap) {
      await this.open()
    }

    if (!this._wrap.has(key)) {
      this._cache[key] = value
      this._modified = true
    } // else dupe, assume CID is correct and ignore
  }

  /**
   * @name ZipDatastore#delete
   * @description
   * Delete a block from this archive. `key`s are converted to `CID` automatically, whether you provide a native
   * Datastore `Key` object, a `String` or a `CID`. `key`s that cannot be converted will throw an error.
   *
   * If the `key` does not exist, `put()` will silently return.
   * @function
   * @async
   * @memberof ZipDatastore
   * @param {string|Key|CID} key a `CID` or `CID`-convertable object to identify the block.
   */
  async delete (key) {
    if (this._fromBuffer) {
      return super.delete(key)
    }

    key = toKey(key, 'delete')

    if (!this._wrap) {
      await this.open()
    }

    if (this._cache[key]) {
      this._cache[key] = null
    }

    if (this._wrap.delete(key)) {
      this._modified = true
    }
  }

  /**
   * @name ZipDatastore#setRoots
   * @description
   * Set the list of roots in the ZipDatastore archive on this ZIP archive.
   *
   * The roots will be written to the comment section of the ZIP archive when `close()` is called, in the meantime it is stored
   * in memory.
   * @function
   * @async
   * @param {string} comment an arbitrary comment to store in the ZIP archive.
   */
  async setRoots (roots) {
    if (this._fromBuffer) {
      return super.setRoots(roots)
    }

    if (!this._wrap) {
      await this.open()
    }

    if (!Array.isArray(roots)) {
      roots = [roots]
    }
    const comment = []
    for (const root of roots) {
      if (!CID.isCID(root)) {
        throw new TypeError('Roots may only be a CID or an array of CIDs')
      }
      comment.push(root)
    }

    this._modified = true
    this._wrap.comment = comment.join('\n')
  }

  /**
   * @name ZipDatastore#getRoots
   * @description
   * Get the list of roots set on this ZIP archive if they exist exists. See {@link ZipDatastore#setRoots}.
   * @function
   * @async
   * @return {Array<CID>} an array of CIDs
   */
  // super.getRoots ()

  /**
   * @name ZipDatastore#close
   * @description
   * Close this archive and write its new contents if required.
   *
   * If a mutation operation has been called on the open archive (`put()`, `delete()`), a new ZIP archive will be
   * written with the mutated contents.
   * @function
   * @async
   */
  async close () {
    if (this._wrap && this._modified) {
      return this._write()
    }
  }

  // TODO: if this._zipData is a Buffer then it should be immutable
  async _write () {
    // since ZipStream get()s are streaming/async we can parallelise cache priming
    await Promise.all(this._wrap.keys().map((key) => {
      if (this._wrap.has(key) && !this._cache[key]) {
        return this.get(key) // cache
      }
    }))

    const zipStream = new ZipArchiveOutputStream()
    zipStream.entryAsync = promisify(zipStream.entry)
    zipStream.setComment(this._wrap.comment || '')
    const outStream = fs.createWriteStream(this._zipData)
    zipStream.pipe(outStream)

    for (const [key, value] of Object.entries(this._cache)) {
      if (!value) { // deleted
        continue
      }
      const entry = new ZipArchiveEntry(key)
      entry.setTime(new Date())
      entry.setMethod(8) // DEFLATE=8, STORE=0
      entry.setUnixMode(40960) // 0120000
      await zipStream.entryAsync(entry, Buffer.isBuffer(value) ? value : Buffer.from(value))
    }

    return new Promise((resolve, reject) => {
      zipStream.finish()
      zipStream.on('error', reject)
      outStream.on('error', reject)
      outStream.on('finish', resolve)
    })
  }
}

module.exports = ZipDatastore
