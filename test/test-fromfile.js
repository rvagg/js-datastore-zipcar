/* eslint-env mocha */

const path = require('path')
const assert = require('assert')
const { fromFile } = require('../')
const { acid, makeData, verifyBlocks, verifyHas, verifyRoots } = require('./fixture-data')

describe('From File', () => {
  before(async () => {
    return makeData()
  })

  it('read existing', async () => {
    const zipDs = await fromFile(path.join(__dirname, 'go.zcar'))
    await verifyHas(zipDs)
    await verifyBlocks(zipDs)
    await verifyRoots(zipDs)
    await zipDs.close()
  })

  it('verify only roots', async () => {
    // tests deferred open for getRoots()
    const zipDs = await fromFile(path.join(__dirname, 'go.zcar'))
    await verifyRoots(zipDs)
    await zipDs.close()
  })

  // when we instantiate from a file, ZipDatastore should be immutable
  it('immutable', async () => {
    const zipDs = await fromFile(path.join(__dirname, 'go.zcar'))
    await assert.rejects(zipDs.put(acid, Buffer.from('blip')))
    await assert.rejects(zipDs.delete(acid, Buffer.from('blip')))
    await assert.rejects(zipDs.setRoots(acid))
    await assert.rejects(zipDs.setRoots([acid]))
  })

  it('errors', async () => {
    const zipDs = await fromFile(path.join(__dirname, 'go.zcar'))
    await zipDs.close()
    await assert.rejects(zipDs.close())
  })

  it('from go', async () => {
    // parse a file created in go-ds-zipcar with the same data
    const zipDs = await fromFile(path.join(__dirname, 'go.zcar'))

    await verifyHas(zipDs)
    await verifyBlocks(zipDs)
    await verifyRoots(zipDs)

    await zipDs.close()
  })
})
