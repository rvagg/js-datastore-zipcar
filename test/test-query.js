/* eslint-env mocha */

const assert = require('assert')
const path = require('path')
const { readBuffer, readFile } = require('../')
const { zcar, makeData, compareBlockData } = require('./fixture-data')

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

const factories = [['readBuffer', () => readBuffer(zcar)]]
if (readFile) { // not in browser
  factories.push(['readFile', () => readFile(path.join(__dirname, 'go.zcar'))])
}

for (const [factoryName, factoryFn] of factories) {
  let blocks

  describe('query', () => {
    before(async () => {
      const data = await makeData()
      blocks = data.rawBlocks.slice(0, 3).concat(data.pbBlocks).concat(data.cborBlocks)
    })

    it(`${factoryName} {}`, async () => {
      const zipDs = await factoryFn()
      const blocks_ = blocks.slice()
      const cids = []
      for (const block of blocks) {
        cids.push((await block.cid()).toString())
      }
      let i = 0
      for await (const entry of zipDs.query()) {
        const foundIndex = cids.findIndex((cid) => cid === entry.key)
        if (foundIndex < 0) {
          assert.fail(`Unexpected CID/key found: ${entry.key}`)
        }
        compareBlockData(entry.value, blocks_[foundIndex].encode(), `#${i++}`)
        cids.splice(foundIndex, 1)
        blocks_.splice(foundIndex, 1)
      }
      assert.strictEqual(cids.length, 0, 'found all expected CIDs')
      await zipDs.close()
    })

    it(`${factoryName} {keysOnly}`, async () => {
      const zipDs = await factoryFn()
      const blocks_ = blocks.slice()
      const cids = []
      for (const block of blocks) {
        cids.push((await block.cid()).toString())
      }
      for await (const entry of zipDs.query({ keysOnly: true })) {
        const foundIndex = cids.findIndex((cid) => cid === entry.key)
        if (foundIndex < 0) {
          assert.fail(`Unexpected CID/key found: ${entry.key}`)
        }
        assert.strictEqual(entry.value, undefined, 'no `value`')
        cids.splice(foundIndex, 1)
        blocks_.splice(foundIndex, 1)
      }
      assert.strictEqual(cids.length, 0, 'found all expected CIDs')
      await zipDs.close()
    })

    it(`${factoryName} {filters}`, async () => {
      const zipDs = await factoryFn()
      const blocks_ = []
      const cids = []
      for (const block of blocks) {
        const cid = await block.cid()
        if (cid.codec === 'dag-cbor') {
          cids.push(cid.toString())
          blocks_.push(block)
        }
      }
      const filter = (e) => e.key.startsWith('bafyrei')
      let i = 0
      for await (const entry of zipDs.query({ filters: [filter] })) {
        const foundIndex = cids.findIndex((cid) => cid === entry.key)
        if (foundIndex < 0) {
          assert.fail(`Unexpected CID/key found: ${entry.key}`)
        }
        compareBlockData(entry.value, blocks_[foundIndex].encode(), `#${i++}`)
        cids.splice(foundIndex, 1)
        blocks_.splice(foundIndex, 1)
      }
      assert.strictEqual(cids.length, 0, 'found all expected CIDs')
      await zipDs.close()
    })
  })
}
