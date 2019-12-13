/* eslint-env mocha */

const assert = require('assert')
const { readBuffer } = require('../')
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

let rawBlocks

describe('Read Buffer', () => {
  before(async () => {
    const data = await makeData()
    rawBlocks = data.rawBlocks
  })

  it('read existing', async () => {
    const zipDs = await readBuffer(zcar)
    await verifyHas(zipDs)
    await verifyBlocks(zipDs)
    await verifyRoots(zipDs)
    await assert.rejects(zipDs.get(await rawBlocks[3].cid())) // doesn't exist
    await zipDs.close()
  })

  it('verify only roots', async () => {
    // tests deferred open for getRoots()
    const zipDs = await readBuffer(zcar)
    await verifyRoots(zipDs)
    await zipDs.close()
  })

  // when we instantiate from a Buffer, ZipDatastore should be immutable
  it('immutable', async () => {
    const zipDs = await readBuffer(zcar)
    await assert.rejects(zipDs.put(acid, Buffer.from('blip')))
    await assert.rejects(zipDs.delete(acid, Buffer.from('blip')))
    await assert.rejects(zipDs.setRoots(acid))
    await assert.rejects(zipDs.setRoots([acid]))
  })
})
