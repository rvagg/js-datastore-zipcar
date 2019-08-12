/* eslint-env mocha */

const Block = require('@ipld/block')
const assert = require('assert')
const ZipDatastore = require('./zipcar.js')
const { DAGNode, DAGLink } = require('ipld-dag-pb')
const pbUtil = require('ipld-dag-pb').util
const unlink = require('util').promisify(require('fs').unlink)

const blocks = 'aaaa bbbb cccc'.split(' ').map((s) => Block.encoder(Buffer.from(s), 'raw'))

describe('Zipcar', () => {
  before(async () => {
    // set up more complicated blocks
    async function toBlock (pnd) {
      const buf = pbUtil.serialize(pnd)
      const cid = await pbUtil.cid(buf, { cidVersion: 0 })
      return Block.create(buf, cid)
    }

    const pnd1 = new DAGNode(null, [
      new DAGLink('cat', await (blocks[0].encode()).byteLength, await blocks[0].cid())
    ])
    blocks.push(await toBlock(pnd1))

    const pnd2 = new DAGNode(null, [
      new DAGLink('dog', await (blocks[1].encode()).byteLength, await blocks[1].cid()),
      new DAGLink('first', pnd1.size, await blocks[3].cid())
    ])
    blocks.push(await toBlock(pnd2))

    const pnd3 = new DAGNode(null, [
      new DAGLink('bear', await (blocks[2].encode()).byteLength, await blocks[2].cid()),
      new DAGLink('second', pnd2.size, await blocks[4].cid())
    ])
    blocks.push(await toBlock(pnd3))

    const cbstructs = [toCBORStruct('foo', 100, false), toCBORStruct('bar', -100, false), toCBORStruct('baz', 0, true)]
    for (const b of cbstructs) {
      blocks.push(Block.encoder(b, 'dag-cbor'))
    }

    await unlink('./test.zcar').catch(() => {})
  })

  it('build new', async () => {
    const zipDs = new ZipDatastore('./test.zcar')
    for (const block of blocks) {
      await zipDs.put(await block.cid(), await block.encode())
    }

    await verifyHas(zipDs)
    await verifyBlocks(zipDs)

    await zipDs.close()
  })

  it('read existing', async () => {
    const zipDs = new ZipDatastore('./test.zcar')
    await verifyHas(zipDs)
    await verifyBlocks(zipDs)
    await zipDs.close()
  })

  it('modify existing', async () => {
    const zipDs = new ZipDatastore('./test.zcar')

    await verifyHas(zipDs)
    await verifyBlocks(zipDs)

    const newBlock = Block.encoder(Buffer.from('zzzz'), 'raw')
    await zipDs.put(await newBlock.cid(), await newBlock.encode())

    await zipDs.delete(await blocks[0].cid()) // raw
    await zipDs.delete(await blocks[3].cid()) // pb

    await verifyHas(zipDs, true)
    await verifyBlocks(zipDs, true)

    await zipDs.close()
  })

  it('read modified', async () => {
    const zipDs = new ZipDatastore('./test.zcar')
    await verifyHas(zipDs, true)
    await verifyBlocks(zipDs, true)
    await zipDs.close()
  })

  it('from go', async () => {
    // parse a file created in go-ds-zipcar with the same data
    const zipDs = new ZipDatastore('./go.zcar')

    await verifyHas(zipDs)
    await verifyBlocks(zipDs)

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

  for (let i = 0; i < blocks.length; i++) {
    if (modified && (i === 0 || i === 3)) {
      await verifyHasnt(await blocks[i].cid(), `block #${i} (${i < 3 ? 'raw' : 'pb'})`)
    } else {
      await verifyHas(await blocks[i].cid(), `block #${i} (${i < 3 ? 'raw' : 'pb'})`)
    }
  }

  await verifyHasnt(await Block.encoder(Buffer.from('dddd'), 'raw').cid(), 'dddd')
}

async function verifyBlocks (zipDs, modified) {
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]

    if (modified && (i === 0 || i === 3)) {
      await assert.rejects(zipDs.get(await block.cid()), {
        name: 'Error',
        message: 'Not Found'
      })
      continue
    }

    const expected = await block.encode()
    let actual
    try {
      actual = await zipDs.get(await block.cid())
    } catch (err) {
      assert.ifError(err, `get block length #${i} (${i < 3 ? 'raw' : 'pb'})`)
    }
    assert.strictEqual(actual.length, expected.length, `comparing block length #${i} (${i < 3 ? 'raw' : i < 6 ? 'pb' : 'cbor'})`)
    for (let j = 0; j < actual.length; j++) {
      assert.deepStrictEqual(actual[j], expected[j], `comparing block byte#${j} #${i} (${i < 3 ? 'raw' : i < 6 ? 'pb' : 'cbor'})`)
    }
  }
}
