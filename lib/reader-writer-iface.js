const { Errors } = require('interface-datastore')
const { commentToRoots, rootsToComment } = require('./util')
const deletedSymbol = Symbol.for('deleted entry')

class Reader {
  // istanbul ignore next
  get () {
    throw new Error('Unimplemented method')
  }

  // istanbul ignore next
  has () {
    throw new Error('Unimplemented method')
  }

  // istanbul ignore next
  keys () {
    throw new Error('Unimplemented method')
  }

  close () {}

  getRoots () {
    return commentToRoots(this.comment)
  }
}

class Writer {
  put () {
    throw new Error('Unimplemented method')
  }

  delete () {
    throw new Error('Unimplemented method')
  }

  setRoots (roots) {
    this.comment = rootsToComment(roots)
  }

  close () {}
}

class EmptyReader extends Reader {
  async get () {
    throw Errors.notFoundError()
  }

  has () {
    return false
  }

  keys () {
    return []
  }
}

class NoWriter extends Writer {
  setRoots () {
    throw new Error('Unimplemented method')
  }
}

class CachingReader extends Reader {
  constructor (reader) {
    super()
    this._reader = reader
    this.cache = new Map()
  }

  get comment () {
    return this._reader.comment
  }

  set comment (comment) {
    this._reader.comment = comment
  }

  async get (key) {
    if (this.cache.has(key)) {
      const value = this.cache.get(key)
      if (value === deletedSymbol) {
        throw Errors.notFoundError()
      }
      return value
    }
    const value = this._reader.get(key)
    return value.then((v) => {
      this.cache.set(key, v)
      return v
    })
  }

  keys () { // this doesn't have to include cache keys
    return this._reader.keys()
  }

  has (key) {
    if (this.cache.has(key)) {
      return this.cache.get(key) !== deletedSymbol
    }
    return this._reader.has(key)
  }

  getRoots () {
    return Reader.prototype.getRoots.apply(this)
  }

  close () {
    return this._reader.close()
  }
}

class CachingDeferredWriter extends Writer {
  constructor (cachingReader, createWriter) {
    super()
    this.cachingReader = cachingReader
    this.createWriter = createWriter
    // we need to control the reader close operation, if it's closed
    // prematurely then we can't read the existing entries before writing
    this._cachingReaderClose = cachingReader.close
    cachingReader.close = () => {}
  }

  /* we only set comment on writer and read from reader
  get comment () {
    return this.cachingReader.comment
  }
  */

  set comment (comment) {
    this.cachingReader.comment = comment
  }

  put (key, value) {
    this.cachingReader.cache.set(key, value)
  }

  delete (key) {
    this.cachingReader.cache.set(key, deletedSymbol)
  }

  async close () {
    await Promise.all(this.cachingReader.keys().map((key) => {
      if (!this.cachingReader.cache.has(key)) {
        return this.cachingReader.get(key) // cache the value
      }
    }))

    await this._cachingReaderClose.call(this.cachingReader)
    const writer = await this.createWriter()

    for (const [key, value] of this.cachingReader.cache.entries()) {
      if (value && value !== deletedSymbol) {
        await writer.put(key, value)
      }
    }

    writer.comment = this.cachingReader.comment

    return writer.close()
  }
}

module.exports.Reader = Reader
module.exports.Writer = Writer
module.exports.EmptyReader = EmptyReader
module.exports.NoWriter = NoWriter
module.exports.CachingReader = CachingReader
module.exports.CachingDeferredWriter = CachingDeferredWriter
