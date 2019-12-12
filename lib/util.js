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

function rootsToComment (roots) {
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

  return comment.join('\n')
}

function commentToRoots (comment) {
  const roots = []
  if (comment) {
    for (const line of comment.split('\n')) {
      try {
        roots.push(new CID(line))
      } catch (e) {}
    }
  }
  return roots
}

module.exports.toKey = toKey
module.exports.cidToKey = cidToKey
module.exports.rootsToComment = rootsToComment
module.exports.commentToRoots = commentToRoots
