const CID = require('cids')

function toKey (key, method) {
  if (!CID.isCID(key)) {
    try {
      key = new CID(key.toString())
    } catch (e) {
      throw new TypeError(`${method}() only accepts CIDs or CID strings`)
    }
  }

  return cidToKey(key)
}

function cidToKey (cid) {
  // toBaseEncodedString() is supposed to do this automatically but let's be explicit to be
  // sure & future-proof
  return cid.toBaseEncodedString(cid.version === 0 ? 'base58btc' : 'base32')
}

module.exports.toKey = toKey
module.exports.cidToKey = cidToKey
