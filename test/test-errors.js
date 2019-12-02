/* eslint-env mocha */
const path = require('path')
const fs = require('fs').promises
const assert = require('assert')
const CID = require('cids')
const ZipDatastore = require('../')

const acid = new CID('bafyreih34u3kglyunorqexbllnkkejmxtvrbwivtz63iaujzf5w47nbvka')

describe('Errors', () => {
  it('unimplemented methods', async () => {
    const zipDs = new ZipDatastore(path.join(__dirname, 'go.zcar'))

    await assert.rejects(zipDs.query())
    await assert.rejects(zipDs.query('foo'))
    await assert.rejects(zipDs.batch())
    await assert.rejects(zipDs.batch('foo'))
    await zipDs.close()
  })

  it('bad root type', async () => {
    const zipDs = new ZipDatastore(path.join(__dirname, 'go.zcar'))
    assert.throws(() => { zipDs.setRoots('blip') })
    assert.throws(() => { zipDs.setRoots(['blip']) })
    assert.throws(() => { zipDs.setRoots([acid, false]) })
    await zipDs.close()
  })

  it('bad gets', async () => {
    const zipDs = new ZipDatastore(path.join(__dirname, 'go.zcar'))
    await assert.rejects(zipDs.get('blip')) // not a CID key
    await assert.doesNotReject(zipDs.get(acid)) // sanity check
    await zipDs.close()
  })

  it('bad has\'', async () => {
    const zipDs = new ZipDatastore(path.join(__dirname, 'go.zcar'))
    await assert.rejects(zipDs.has('blip')) // not a CID key
    await assert.doesNotReject(zipDs.has(acid)) // sanity check
    await zipDs.close()
  })

  it('bad puts', async () => {
    const zipDs = new ZipDatastore(path.join(__dirname, 'go.zcar'))
    await assert.rejects(zipDs.put(acid, 'blip')) // not a Buffer value
    await assert.rejects(zipDs.put('blip', Buffer.from('blip'))) // not a CID key
    await zipDs.close()
  })

  it('double open', async () => {
    const zipDs = new ZipDatastore(path.join(__dirname, 'go.zcar'))
    await zipDs.open()
    await assert.rejects(zipDs.open())
    await zipDs.close()
  })

  it('create with unwritable file', async () => {
    await fs.writeFile('blip', '')
    await fs.chmod('blip', 0o144)
    const zipDs = new ZipDatastore('blip')
    await assert.rejects(zipDs.open())
    await fs.unlink('blip')
  })
})
