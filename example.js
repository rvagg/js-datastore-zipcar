const ZipDatastore = require('./zipcar.js')
const Block = require('@ipld/block')

async function example () {
  const block = Block.encoder(Buffer.from('random meaningless bytes'), 'raw')
  const cid = await block.cid()

  const ds = new ZipDatastore('example.zcar')

  // store a new block, creates a new file entry in the ZIP archive
  await ds.put(cid, await block.encode())

  // retrieve a block, as a UInt8Array, reading from the ZIP archive
  const got = await ds.get(cid)

  console.log('Retrieved [%s] from zipcar with CID [%s]\n', Buffer.from(got).toString(), cid.toString())

  await ds.close()
}

example().catch((err) => {
  console.error(err)
  process.exit(1)
})
