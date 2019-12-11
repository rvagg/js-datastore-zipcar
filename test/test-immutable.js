/* eslint-env mocha */

const assert = require('assert')
const ZipDatastore = require('../zipcar-immutable')
const { acid, zcar, makeData, verifyBlocks, verifyHas, verifyRoots } = require('./fixture-data')

if (!assert.rejects) {
  // browser polyfill is incomplete
  assert.rejects = async (promise, msg) => {
    try {
      await promise
    } catch (err) {
      return
    }
    assert.fail(`Promise did not reject: ${msg}`)
  }
}
describe('Immutable', () => {
  before(async () => {
    return makeData()
  })

  it('read existing', async () => {
    const zipDs = new ZipDatastore(zcar)
    await verifyHas(zipDs)
    await verifyBlocks(zipDs)
    await verifyRoots(zipDs)
    await zipDs.close()
  })

  it('verify only roots', async () => {
    // tests deferred open for getRoots()
    const zipDs = new ZipDatastore(zcar)
    await verifyRoots(zipDs)
    await zipDs.close()
  })

  it('errors', async () => {
    const zipDs = new ZipDatastore(zcar)
    await assert.rejects(zipDs.put(acid, Buffer.from('blip')))
    await assert.rejects(zipDs.delete(acid, Buffer.from('blip')))
    await assert.rejects(zipDs.setRoots(acid))
    await assert.rejects(zipDs.setRoots([acid]))
  })
})
