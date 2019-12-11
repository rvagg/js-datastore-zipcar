const fs = require('fs')
const { promisify } = require('util')
fs.access = promisify(fs.access)
const StreamZip = require('node-stream-zip')
const bl = require('bl')
const wrapBuffer = require('./zipwrap-buffer')

class StreamZipWrap {
  constructor (streamZip) {
    this._streamZip = streamZip
    this.comment = streamZip.comment
  }

  has (key) {
    return this._streamZip.entry(key) != null
  }

  keys () {
    return Object.keys(this._streamZip.entries())
  }

  delete (key) {
    if (this.has(key)) {
      // this is a little a bit unsafe, no guarantee this will be mutable into the future
      this._streamZip.entries()[key] = null
      return true
    }
    return false
  }

  get (key) {
    return new Promise((resolve, reject) => {
      this._streamZip.stream(key, (err, stream) => {
        // istanbul ignore next toohard
        if (err) {
          return reject(err)
        }
        stream.on('error', reject)
          .pipe(bl((err, data) => {
            // istanbul ignore next toohard
            if (err) {
              return reject(err)
            }
            resolve(data)
          }))
      })
    })
  }
}

class EmptyZipWrap {
  has (key) {
    return false
  }

  keys () {
    return []
  }

  delete (key) {
    return false
  }

  // istanbul ignore next only here for completeness, never invoked
  get (key) { }
}

async function wrap (zipFile) {
  if (Buffer.isBuffer(zipFile)) {
    return wrapBuffer(zipFile)
  }

  try {
    await fs.access(zipFile, fs.constants.R_OK)
  } catch (err) {
    if (err.code === 'ENOENT') {
      // new file
      return new EmptyZipWrap()
    }
    throw err
  }

  const streamZip = await new Promise((resolve, reject) => {
    const zip = new StreamZip({
      file: zipFile,
      storeEntries: true
    })
    zip.on('error', reject)
    zip.on('ready', () => resolve(zip))
  })

  this._opened = true

  return new StreamZipWrap(streamZip)
}

module.exports = wrap
