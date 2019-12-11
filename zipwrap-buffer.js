const Zip = require('jszip')

// see commit 24ff606a for a writable JSZip if/when that's needed

class JSZipWrap {
  constructor (zip) {
    this._zip = zip
    this.comment = zip.comment
  }

  has (key) {
    return this._zip.files[key] != null
  }

  // istanbul ignore next only used for writing
  keys () {
    // istanbul ignore next
    return Object.keys(this._zip.files)
  }

  get (key) {
    return this._zip.files[key].async('uint8array')
  }
}

async function wrap (zipData) {
  return new JSZipWrap(await Zip.loadAsync(zipData))
}

module.exports = wrap
