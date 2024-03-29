/* eslint-env mocha */

const assert = require('assert')
const fs = require('fs')
const unlink = require('util').promisify(require('fs').unlink)
const { writeStream, readFile } = require('../')
const { makeData, verifyBlocks, verifyHas, verifyRoots } = require('./fixture-data')

let rawBlocks
let pbBlocks
let cborBlocks

describe('Read File & Write Stream', () => {
  before(async () => {
    const data = await makeData()
    rawBlocks = data.rawBlocks
    pbBlocks = data.pbBlocks
    cborBlocks = data.cborBlocks

    await unlink('./test.zcar').catch(() => {})
  })

  it('writeStream', async () => {
    const zipDs = await writeStream(fs.createWriteStream('./test.zcar'))
    for (const block of rawBlocks.slice(0, 3).concat(pbBlocks).concat(cborBlocks)) {
      // add all but raw zzzz
      await zipDs.put(await block.cid(), await block.encode())
    }
    await zipDs.setRoots(await cborBlocks[2].cid())
    await zipDs.close()
  })

  it('readFile', async () => {
    const zipDs = await readFile('./test.zcar')
    await verifyHas(zipDs)
    await verifyBlocks(zipDs)
    await verifyRoots(zipDs)
    await zipDs.close()
  })

  it('writeStream errors', async () => {
    const zipDs = await writeStream(fs.createWriteStream('./test.zcar'))
    await zipDs.put(await cborBlocks[0].cid(), await cborBlocks[0].encode())
    await assert.rejects(zipDs.delete(await cborBlocks[0].cid()))
    await zipDs.close()
    await assert.rejects(zipDs.close())
  })

  after(async () => {
    unlink('./test.zcar').catch(() => {})
  })
})
