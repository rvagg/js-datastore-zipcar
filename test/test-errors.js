/* eslint-env mocha */

const fs = require('fs').promises
const assert = require('assert')
const { fromBuffer, readWriteFile } = require('../')
const { acid, zcar } = require('./fixture-data')

describe('Errors', () => {
  it('unimplemented methods', async () => {
    const zipDs = await fromBuffer(zcar)
    await assert.rejects(zipDs.batch())
    await assert.rejects(zipDs.batch('foo'))
    await zipDs.close()
  })

  it('bad gets', async () => {
    const zipDs = await fromBuffer(zcar)
    await assert.rejects(zipDs.get('blip')) // not a CID key
    await assert.doesNotReject(zipDs.get(acid)) // sanity check
    await zipDs.close()
  })

  it('bad has\'', async () => {
    const zipDs = await fromBuffer(zcar)
    await assert.rejects(zipDs.has('blip')) // not a CID key
    await assert.doesNotReject(zipDs.has(acid)) // sanity check
    await zipDs.close()
  })

  it('bad queries', async () => {
    const zipDs = await fromBuffer(zcar)
    assert.throws(() => zipDs.query('blip'))
    assert.throws(() => zipDs.query(false))
    assert.throws(() => zipDs.query(null))
    await zipDs.close()
  })

  it('bad root type', async () => {
    const zipDs = await readWriteFile('test.zcar')
    assert.rejects(zipDs.setRoots('blip'))
    assert.rejects(zipDs.setRoots(['blip']))
    assert.rejects(zipDs.setRoots([acid, false]))
    await zipDs.close()
  })

  it('bad puts', async () => {
    const zipDs = await readWriteFile('test.zcar')
    await assert.rejects(zipDs.put(acid, 'blip')) // not a Buffer value
    await assert.rejects(zipDs.put('blip', Buffer.from('blip'))) // not a CID key
    await zipDs.close()
  })

  it('create with unwritable file', async () => {
    await (fs.unlink('blip').catch(() => {}))
    await fs.writeFile('blip', '')
    await fs.chmod('blip', 0o144)
    await assert.rejects(readWriteFile('blip'))
    await fs.unlink('blip')
  })

  after(async () => {
    return fs.unlink('test.zcar').catch(() => {})
  })
})
