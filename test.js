/* eslint-env mocha */

const Block = require('@ipld/block')
const assert = require('assert')
const ZipDatastore = require('./zipcar.js')
const { DAGNode, DAGLink } = require('ipld-dag-pb')
const pbUtil = require('ipld-dag-pb').util
const unlink = require('util').promisify(require('fs').unlink)

const rawBlocks = 'aaaa bbbb cccc zzzz'.split(' ').map((s) => Block.encoder(Buffer.from(s), 'raw'))
const pbBlocks = []
const cborBlocks = []
const allBlocks = [['raw', rawBlocks], ['pb', pbBlocks], ['cbor', cborBlocks]]

describe('Zipcar', () => {
  before(async () => {
    // set up more complicated blocks
    async function toBlock (pnd) {
      const buf = pbUtil.serialize(pnd)
      const cid = await pbUtil.cid(buf, { cidVersion: 0 })
      return Block.create(buf, cid)
    }

    const pnd1 = new DAGNode(null, [
      new DAGLink('cat', await (rawBlocks[0].encode()).byteLength, await rawBlocks[0].cid())
    ])
    pbBlocks.push(await toBlock(pnd1))

    const pnd2 = new DAGNode(null, [
      new DAGLink('dog', await (rawBlocks[1].encode()).byteLength, await rawBlocks[1].cid()),
      new DAGLink('first', pnd1.size, await pbBlocks[0].cid())
    ])
    pbBlocks.push(await toBlock(pnd2))

    const pnd3 = new DAGNode(null, [
      new DAGLink('bear', await (rawBlocks[2].encode()).byteLength, await rawBlocks[2].cid()),
      new DAGLink('second', pnd2.size, await pbBlocks[1].cid())
    ])
    pbBlocks.push(await toBlock(pnd3))

    const cbstructs = [toCBORStruct('foo', 100, false), toCBORStruct('bar', -100, false), toCBORStruct('baz', 0, true)]
    for (const b of cbstructs) {
      cborBlocks.push(Block.encoder(b, 'dag-cbor'))
    }

    await unlink('./test.zcar').catch(() => {})
  })

  it('build new', async () => {
    const zipDs = new ZipDatastore('./test.zcar')
    for (const block of rawBlocks.slice(0, 3).concat(pbBlocks).concat(cborBlocks)) {
      // add all but raw zzzz
      await zipDs.put(await block.cid(), await block.encode())
    }
    zipDs.setComment((await cborBlocks[2].cid()).toString())

    await verifyHas(zipDs)
    await verifyBlocks(zipDs)
    await verifyComment(zipDs)

    await zipDs.close()
  })

  it('read existing', async () => {
    const zipDs = new ZipDatastore('./test.zcar')
    await verifyHas(zipDs)
    await verifyBlocks(zipDs)
    await verifyComment(zipDs)
    await zipDs.close()
  })

  it('modify existing', async () => {
    const zipDs = new ZipDatastore('./test.zcar')

    await verifyHas(zipDs)
    await verifyBlocks(zipDs)
    await verifyComment(zipDs)

    await zipDs.delete(await rawBlocks[1].cid()) // middle raw
    await zipDs.delete(await pbBlocks[1].cid()) // middle pb
    await zipDs.delete(await cborBlocks[1].cid()) // middle pb

    await zipDs.put(await rawBlocks[3].cid(), await rawBlocks[3].encode()) // zzzz

    zipDs.setComment((await cborBlocks[1].cid()).toString())

    await verifyHas(zipDs, true)
    await verifyBlocks(zipDs, true)
    await verifyComment(zipDs, true)

    await zipDs.close()
  })

  it('read modified', async () => {
    const zipDs = new ZipDatastore('./test.zcar')
    await verifyHas(zipDs, true)
    await verifyBlocks(zipDs, true)
    await verifyComment(zipDs, true)
    await zipDs.close()
  })

  it('from go', async () => {
    // parse a file created in go-ds-zipcar with the same data
    const zipDs = new ZipDatastore('./go.zcar')

    await verifyHas(zipDs)
    await verifyBlocks(zipDs)
    await verifyComment(zipDs)

    await zipDs.close()
  })

  after(async () => {
    unlink('./test.zcar').catch(() => {})
  })
})

function toCBORStruct (s, i, b) {
  return { s, i, b }
}

async function verifyHas (zipDs, modified) {
  async function verifyHas (cid, name) {
    assert.ok(await zipDs.has(cid), `datastore doesn't have expected key for ${name}`)
  }

  async function verifyHasnt (cid, name) {
    assert.ok(!(await zipDs.has(cid)), `datastore has unexpected key for ${name}`)
  }

  for (const [type, blocks] of allBlocks) {
    for (let i = 0; i < 3; i++) {
      if (modified && i === 1) {
        // second of each type is removed from modified
        await verifyHasnt(await blocks[i].cid(), `block #${i} (${type})`)
      } else {
        await verifyHas(await blocks[i].cid(), `block #${i} (${type})`)
      }
    }

    if (modified && type === 'raw') {
      await verifyHas(await blocks[3].cid(), `block #3 (${type})`) // zzzz
    }
  }

  // not a block we have
  await verifyHasnt(await Block.encoder(Buffer.from('dddd'), 'raw').cid(), 'dddd')
}

async function verifyBlocks (zipDs, modified) {
  async function verifyBlock (block, index, type) {
    const expected = await block.encode()
    let actual
    try {
      actual = await zipDs.get(await block.cid())
    } catch (err) {
      assert.ifError(err, `get block length #${index} (${type})`)
    }
    assert.strictEqual(actual.length, expected.length, `comparing block length #${index} (${type})`)
    for (let j = 0; j < actual.length; j++) {
      assert.deepStrictEqual(actual[j], expected[j], `comparing block byte#${j} #${index} (${type})`)
    }
  }

  for (const [type, blocks] of allBlocks) {
    for (let i = 0; i < 3; i++) {
      const block = blocks[i]

      if (modified && i === 1) {
        await assert.rejects(zipDs.get(await block.cid()), {
          name: 'Error',
          message: 'Not Found'
        })
        continue
      }

      await verifyBlock(block, i, type)
    }

    if (modified && type === 'raw') {
      await verifyBlock(blocks[3], 3, type) // zzzz
    }
  }
}

async function verifyComment (zipDs, modified) {
  const expected = (await cborBlocks[modified ? 1 : 2].cid()).toString()
  assert.strictEqual(zipDs.getComment(), expected)
}
