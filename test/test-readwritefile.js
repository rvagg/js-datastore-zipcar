/* eslint-env mocha */

const path = require('path')
const assert = require('assert')
const unlink = require('util').promisify(require('fs').unlink)

const { readWriteFile } = require('../')
const { makeData, verifyBlocks, verifyHas, verifyRoots } = require('./fixture-data')

let rawBlocks
let pbBlocks
let cborBlocks

describe('Read / Write File', () => {
  before(async () => {
    const data = await makeData()
    rawBlocks = data.rawBlocks
    pbBlocks = data.pbBlocks
    cborBlocks = data.cborBlocks

    await unlink('./test.zcar').catch(() => {})
  })

  it('build new', async () => {
    const zipDs = await readWriteFile('./test.zcar')
    await assert.rejects(zipDs.get(await cborBlocks[0].cid())) // empty
    for (const block of rawBlocks.slice(0, 3).concat(pbBlocks).concat(cborBlocks)) {
      // add all but raw zzzz
      await zipDs.put(await block.cid(), await block.encode())
    }
    await zipDs.setRoots(await cborBlocks[2].cid())

    await verifyHas(zipDs)
    await verifyBlocks(zipDs)
    await verifyRoots(zipDs)

    await zipDs.close()
  })

  it('read existing', async () => {
    const zipDs = await readWriteFile('./test.zcar')
    await verifyHas(zipDs)
    await verifyBlocks(zipDs)
    await verifyRoots(zipDs)
    await zipDs.close()
  })

  it('modify existing', async () => {
    const zipDs = await readWriteFile('./test.zcar')

    await verifyHas(zipDs)
    await verifyBlocks(zipDs)
    await verifyRoots(zipDs)

    await zipDs.delete(await rawBlocks[1].cid()) // middle raw
    await zipDs.delete(await pbBlocks[1].cid()) // middle pb
    await zipDs.delete(await cborBlocks[1].cid()) // middle pb

    await zipDs.put(await rawBlocks[3].cid(), await rawBlocks[3].encode()) // zzzz

    zipDs.setRoots(await cborBlocks[1].cid())

    await verifyHas(zipDs, true)
    await verifyBlocks(zipDs, true)
    await verifyRoots(zipDs, true)

    await zipDs.close()
  })

  it('read modified', async () => {
    const zipDs = await readWriteFile('./test.zcar')
    await verifyHas(zipDs, true)
    await verifyBlocks(zipDs, true)
    await verifyRoots(zipDs, true)
    await zipDs.close()
  })

  it('rewrite modified, no cache prime', async () => {
    const zipDs = await readWriteFile('./test.zcar')
    await zipDs.put(await rawBlocks[1].cid(), await rawBlocks[1].encode())
    await zipDs.put(await pbBlocks[1].cid(), await pbBlocks[1].encode())
    await zipDs.put(await cborBlocks[1].cid(), await cborBlocks[1].encode())
    zipDs.setRoots(await cborBlocks[2].cid())
    await zipDs.close()
  })

  it('read rewritten modified', async () => {
    const zipDs = await readWriteFile('./test.zcar')
    await verifyHas(zipDs)
    await verifyBlocks(zipDs)
    await verifyRoots(zipDs)
    await zipDs.close()
  })

  it('redundant put()s for potential duplicates', async () => {
    const zipDs = await readWriteFile('./test.zcar')
    await zipDs.put(await rawBlocks[1].cid(), await rawBlocks[1].encode())
    await zipDs.put(await pbBlocks[1].cid(), await pbBlocks[1].encode())
    await zipDs.put(await cborBlocks[1].cid(), await cborBlocks[1].encode())
    zipDs.setRoots(await cborBlocks[2].cid())
    await zipDs.close()
  })

  it('read rewritten with redundant put()s', async () => {
    const zipDs = await readWriteFile('./test.zcar')
    await verifyHas(zipDs)
    await verifyBlocks(zipDs)
    await verifyRoots(zipDs)
    await zipDs.close()
  })

  it('verify only roots', async () => {
    // tests deferred open for getRoots()
    const zipDs = await readWriteFile('./test.zcar')
    await verifyRoots(zipDs)
    await zipDs.close()
  })

  it('verify get() first', async () => {
    // tests deferred open for getRoots()
    const zipDs = await readWriteFile('./test.zcar')
    await verifyBlocks(zipDs)
    await verifyHas(zipDs)
    await verifyRoots(zipDs)
    await zipDs.close()
  })

  it('modify delete with deferred open', async () => {
    const zipDs = await readWriteFile('./test.zcar')

    await zipDs.delete(await rawBlocks[1].cid()) // middle raw
    await zipDs.delete(await pbBlocks[1].cid()) // middle pb
    await zipDs.delete(await cborBlocks[1].cid()) // middle pb
    await zipDs.close()
  })

  it('read modified with deferred open delete', async () => {
    const zipDs = await readWriteFile('./test.zcar')
    await verifyHas(zipDs, true)
    await verifyBlocks(zipDs, true)
    await zipDs.close()
  })

  it('redundant delete()s', async () => {
    const zipDs = await readWriteFile('./test.zcar')

    // should already be gone
    await zipDs.delete(await rawBlocks[1].cid()) // middle raw
    await zipDs.delete(await pbBlocks[1].cid()) // middle pb
    await zipDs.delete(await cborBlocks[1].cid()) // middle pb
    await zipDs.close()
  })

  it('read modified with redundant deletes', async () => {
    const zipDs = await readWriteFile('./test.zcar')
    await verifyHas(zipDs, true)
    await verifyBlocks(zipDs, true)
    await zipDs.close()
  })

  it('put()s with Uint8Arrays', async () => {
    const zipDs = await readWriteFile('./test.zcar')
    await zipDs.put(await rawBlocks[1].cid(), new Uint8Array(await rawBlocks[1].encode()))
    await zipDs.put(await pbBlocks[1].cid(), new Uint8Array(await pbBlocks[1].encode()))
    await zipDs.put(await cborBlocks[1].cid(), new Uint8Array(await cborBlocks[1].encode()))
    zipDs.setRoots(await cborBlocks[2].cid())
    await zipDs.close()
  })

  it('read rewritten with Uint8Arrays', async () => {
    const zipDs = await readWriteFile('./test.zcar')
    await verifyHas(zipDs)
    await verifyBlocks(zipDs)
    await verifyRoots(zipDs)
    await zipDs.close()
  })

  it('no roots', async () => {
    await unlink('./test.zcar')

    let zipDs = await readWriteFile('./test.zcar')
    for (const block of rawBlocks.slice(0, 3).concat(pbBlocks).concat(cborBlocks)) {
      await zipDs.put(await block.cid(), await block.encode())
    }
    await verifyHas(zipDs)
    await verifyBlocks(zipDs)
    assert.deepStrictEqual(await zipDs.getRoots(), [], 'no roots')
    await zipDs.close()

    zipDs = await readWriteFile('./test.zcar')
    await verifyHas(zipDs)
    await verifyBlocks(zipDs)
    assert.deepStrictEqual(await zipDs.getRoots(), [], 'no roots')
  })

  it('noops on empty', async () => {
    await unlink('./test.zcar')
    const zipDs = await readWriteFile('./test.zcar')
    await zipDs.delete(await rawBlocks[1].cid()) // middle raw
    await zipDs.delete(await pbBlocks[1].cid()) // middle pb
    await zipDs.delete(await cborBlocks[1].cid()) // middle pb
    await assert.rejects(zipDs.get(await cborBlocks[1].cid()))
    await zipDs.close()
  })

  it('from go', async () => {
    // parse a file created in go-ds-zipcar with the same data
    const zipDs = await readWriteFile(path.join(__dirname, 'go.zcar'))

    await verifyHas(zipDs)
    await verifyBlocks(zipDs)
    await verifyRoots(zipDs)

    await zipDs.close()
  })

  after(async () => {
    unlink('./test.zcar').catch(() => {})
  })
})
