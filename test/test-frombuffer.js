/* eslint-env mocha */

const assert = require('assert')
const ZipDatastore = require('../')
const { acid, zcar, makeData, verifyBlocks, verifyHas, verifyRoots } = require('./fixture-data')

describe('From Buffer', () => {
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

  // when we instantiate from a Buffer, ZipDatastore should behave the same as ZipDatastoreImmutable
  it('immutable', async () => {
    const zipDs = new ZipDatastore(zcar)
    await assert.rejects(zipDs.put(acid, Buffer.from('blip')))
    await assert.rejects(zipDs.delete(acid, Buffer.from('blip')))
    await assert.rejects(zipDs.setRoots(acid))
    await assert.rejects(zipDs.setRoots([acid]))
  })
})
