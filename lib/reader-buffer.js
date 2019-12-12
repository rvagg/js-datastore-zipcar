const Zip = require('jszip')
const { Reader } = require('./reader-writer-iface')
const { Errors } = require('interface-datastore')

// see commit 24ff606a for a writable JSZip if/when that's needed

class JSZipReader extends Reader {
  constructor (zip) {
    super()
    this._zip = zip
    this.comment = zip.comment
  }

  has (key) {
    return this._zip.files[key] != null
  }

  async get (key) {
    if (!this.has(key)) {
      throw Errors.notFoundError()
    }
    return this._zip.files[key].async('uint8array')
  }

  /* currently unused
  keys () {
    return Object.keys(this._zip.files)
  }
  */
}

async function create (zipData) {
  return new JSZipReader(await Zip.loadAsync(zipData))
}

module.exports = create
