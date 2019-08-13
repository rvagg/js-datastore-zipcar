const fs = require('fs')
const { promisify } = require('util')
fs.open = promisify(fs.open)
fs.close = promisify(fs.close)
fs.readFile = promisify(fs.readFile)
const Zip = require('jszip')
const { Errors } = require('interface-datastore')
const CID = require('cids')

/**
 * ZipDatastore is a class to manage reading from, and writing to a ZIP archives using [CID](https://github.com/multiformats/js-cid)s as keys and
 * file names in the ZIP and binary block data as the file contents.
 *
 * @class
 */
class ZipDatastore {
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
    this._zipFile = zipFile
    this._cache = {}
    this._zip = null
    this._opened = false
    this._modified = false
    this._comment = null
  }

  /**
   * Open the ZIP archive and perform an initial parse of the data. This method doesn't need to be called
   * during normal operation. An archive that isn't already open when calling `get()`, `put()`, `has()` it
   * will be opened automatically.
   */
  async open () {
    if (this._opened) {
      throw new Error('Archive is already open, cannot call open() again until close() is called')
    }

    // re-initialize
    this._cache = {}
    this._zip = null
    this._opened = false
    this._modified = false
    this._comment = null

    let fd
    try {
      fd = await fs.open(this._zipFile)
    } catch (err) {
      if (err.code === 'ENOENT') {
        // new file
        this._zip = { files: [] }
        this._opened = true
        return
      }
      throw err
    }
    const buf = await fs.readFile(fd)
    await fs.close(fd)
    this._zip = await Zip.loadAsync(buf)
    this._comment = this._zip.comment
    this._opened = true
  }

  /**
   * Store a block in this archive. `key`s are converted to `CID` automatically, whether you provide a native
   * Datastore `Key` object, a `String` or a `CID`. `key`s that cannot be converted will throw an error.
   *
   * The entry will not be written to the ZIP archive until `close()` is called, in the meantime it is stored
   * in memory.
   *
   * @param {string|Key|CID} key a `CID` or `CID`-convertable object to identify the `value`.
   * @param {Buffer|Uint8Array} value an IPLD block matching the given `key` `CID`.
   */
  async put (key, value) {
    key = toKey(key, 'put')

    if (!(value instanceof Uint8Array)) {
      throw new TypeError('put() can only receive Uint8Arrays or Buffers')
    }

    if (!this._opened) {
      await this.open()
    }

    if (!this._zip.files[key]) {
      this._cache[key] = value
      this._modified = true
    } // else dupe, assume CID is correct and ignore
  }

  /**
   * Retrieve a block from this archive. `key`s are converted to `CID` automatically, whether you provide a native
   * Datastore `Key` object, a `String` or a `CID`. `key`s that cannot be converted will throw an error.
   *
   * @param {string|Key|CID} key a `CID` or `CID`-convertable object to identify the block.
   */
  async get (key) {
    key = toKey(key, 'get')

    if (!this._opened) {
      await this.open()
    }

    if (this._cache[key]) {
      return this._cache[key]
    }

    if (!this._zip.files[key]) {
      throw Errors.notFoundError()
    }

    const value = this._zip.files[key].async('uint8array')
    value.then((v) => {
      this._cache[key] = v
    })
    return value
  }

  /**
   * Check whether a block exists in this archive. `key`s are converted to `CID` automatically, whether you provide a native
   * Datastore `Key` object, a `String` or a `CID`. `key`s that cannot be converted will throw an error.
   *
   * @param {string|Key|CID} key a `CID` or `CID`-convertable object to identify the block.
   */
  async has (key) {
    key = toKey(key, 'has')

    if (!this._opened) {
      await this.open()
    }

    return this._cache[key] != null | this._zip.files[key] != null
  }

  /**
   * Delete a block from this archive. `key`s are converted to `CID` automatically, whether you provide a native
   * Datastore `Key` object, a `String` or a `CID`. `key`s that cannot be converted will throw an error.
   *
   * If the `key` does not exist, `put()` will silently return.
   *
   * @param {string|Key|CID} key a `CID` or `CID`-convertable object to identify the block.
   */
  async delete (key) {
    key = toKey(key, 'delete')

    if (!this._opened) {
      await this.open()
    }

    if (this._cache[key]) {
      this._cache[key] = null
    }

    if (this._zip.files[key]) {
      this._zip.files[key] = null
    }
  }

  /**
   * Set a comment on this ZIP archive. Can be an arbitrary string but a good use is as a root CID, or a newline
   * separated list of root CIDs in this archive.
   *
   * The comment will not be written to the ZIP archive until `close()` is called, in the meantime it is stored
   * in memory.
   *
   * @param {string} comment an arbitrary comment to store in the ZIP archive.
   */
  setComment (comment) {
    if (typeof comment !== 'string') {
      throw new TypeError('Comment can only be a string')
    }

    this._modified = true
    this._comment = comment
  }

  /**
   * Get the comment set on this ZIP archive if one exists. See {@link ZipDatastore#setComment}.
   */
  getComment () {
    return this._comment
  }

  /**
   * Close this archive and write its new contents if required.
   *
   * If a mutation operation has been called on the open archive (`put()`, `delete()`), a new ZIP archive will be
   * written with the mutated contents.
   */
  async close () {
    if (this._opened && this._modified) {
      return this._write()
    }
  }

  async _write (callback) {
    for (const key in this._zip.files) {
      if (this._zip.files[key] && !this._cache[key]) {
        await this.get(key) // cache
      }
    }

    const zip = new Zip()
    for (const [key, value] of Object.entries(this._cache)) {
      if (value) {
        zip.file(key, value)
      }
    }

    const options = {
      type: 'nodebuffer',
      streamFiles: true,
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    }
    if (this._comment) {
      options.comment = this._comment
    }
    const file = this._zipFile

    return new Promise((resolve, reject) => {
      zip.generateNodeStream(options)
        .on('error', reject)
        .pipe(fs.createWriteStream(file))
        .on('error', reject)
        .on('finish', resolve)
    })
  }

  batch () {
    throw new Error('Unimplemented operation')
  }

  query (q) {
    throw new Error('Unimplemented operation')
  }
}

function toKey (key, method) {
  if (!CID.isCID(key)) {
    try {
      key = new CID(key.toString())
    } catch (e) {
      throw new TypeError(`${method}() only accepts CIDs or CID strings`)
    }
  }

  // toBaseEncodedString() is supposed to do this automatically but let's be explicit to be
  // sure & future-proof
  return key.toBaseEncodedString(key.version === 0 ? 'base58btc' : 'base32')
}

module.exports = ZipDatastore
