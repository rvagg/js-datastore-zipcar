const CID = require('cids')
const { Errors } = require('interface-datastore')
const { toKey } = require('./util')
const wrap = require('./zipwrap-buffer')

class ZipDatastoreImmutable {
  constructor (zipData) {
    this._zipData = zipData
    this._cache = {}
    this._wrap = null
    this._modified = false
    this._wrapper = wrap
  }

  async open () {
    if (this._wrap) {
      throw new Error('Archive is already open, cannot call open() again until close() is called')
    }

    // re-initialize
    this._cache = {}
    this._modified = false

    this._wrap = await this._wrapper(this._zipData)
  }

  async get (key) {
    key = toKey(key, 'get')

    if (!this._wrap) {
      await this.open()
    }

    if (this._cache[key]) {
      return this._cache[key]
    }

    if (!this._wrap.has(key)) {
      throw Errors.notFoundError()
    }

    const value = await this._wrap.get(key)
    this._cache[key] = value
    return value
  }

  async has (key) {
    key = toKey(key, 'has')

    if (!this._wrap) {
      await this.open()
    }

    return this._cache[key] != null || this._wrap.has(key)
  }

  async put (key, value) {
    throw new Error('Unsupported operation in this environment')
  }

  async delete (key) {
    throw new Error('Unsupported operation in this environment')
  }

  async setRoots (roots) {
    throw new Error('Unsupported operation in this environment')
  }

  async getRoots () {
    if (!this._wrap) {
      await this.open()
    }

    const roots = []
    if (this._wrap.comment) {
      for (const line of this._wrap.comment.split('\n')) {
        try {
          roots.push(new CID(line))
        } catch (e) {}
      }
    }
    return roots
  }

  close () {
  }

  async batch () {
    throw new Error('Unimplemented operation')
  }

  async query (q) {
    throw new Error('Unimplemented operation')
  }
}

module.exports = ZipDatastoreImmutable
