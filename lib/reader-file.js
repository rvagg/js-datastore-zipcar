const fs = require('fs')
const { promisify } = require('util')
fs.access = promisify(fs.access)
const StreamZip = require('node-stream-zip')
const bl = require('bl')
const { Errors } = require('interface-datastore')
const { Reader } = require('./reader-writer-iface')

class StreamZipReader extends Reader {
  constructor (streamZip) {
    super()
    this._streamZip = streamZip
    this.comment = streamZip.comment
  }

  has (key) {
    return this._streamZip.entry(key) != null
  }

  keys () {
    return Object.keys(this._streamZip.entries())
  }

  async get (key) {
    if (!this.has(key)) {
      throw Errors.notFoundError()
    }
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

  async close () {
    return this._streamZip.closeAsync()
  }
}

async function create (zipFile) {
  await fs.access(zipFile, fs.constants.R_OK)

  const streamZip = await new Promise((resolve, reject) => {
    const zip = new StreamZip({
      file: zipFile,
      storeEntries: true
    })
    zip.on('error', reject)
    zip.on('ready', () => resolve(zip))
    zip.closeAsync = promisify(zip.close.bind(zip))
  })

  return new StreamZipReader(streamZip)
}

module.exports = create
