# datastore-zipcar (js-ds-zipcar)

[![NPM](https://nodei.co/npm/datastore-zipcar.svg)](https://nodei.co/npm/datastore-zipcar/)

An implementation of a [Datastore](https://github.com/ipfs/interface-datastore) for [IPLD](https://ipld.io) blocks that operates on ZIP files, supporting interacting via [CID](https://github.com/ipfs/go-cid) rather than the native Datastore Key type.

A Go implementation is also available at [go-ds-zipcar](https://github.com/rvagg/go-ds-zipcar).


## Example

```js
const ZipDatastore = require('datastore-zipcar')
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
```

Will output:

```
Retrieved [random meaningless bytes] from zipcar with CID [bafkreihwkf6mtnjobdqrkiksr7qhp6tiiqywux64aylunbvmfhzeql2coa]
```

*example.zcar* is now a properly formatted ZIP archive:

```
$ unzip -l example.zcar
Archive:  example.zcar
  Length      Date    Time    Name
---------  ---------- -----   ----
       24  2019-08-12 04:15   bafkreihwkf6mtnjobdqrkiksr7qhp6tiiqywux64aylunbvmfhzeql2coa
---------                     -------
       24                     1 file
```

## API

### Contents

 * [`class ZipDatastore`](#ZipDatastore)
   * [`ZipDatastore(zipFile)`](#ZipDatastore_new)
 * [`async ZipDatastore#open()`](#ZipDatastore_open)
 * [`async ZipDatastore#put(key, value)`](#ZipDatastore_put)
 * [`async ZipDatastore#get(key)`](#ZipDatastore_get)
 * [`async ZipDatastore#has(key)`](#ZipDatastore_has)
 * [`async ZipDatastore#delete(key)`](#ZipDatastore_delete)
 * [`async ZipDatastore#close()`](#ZipDatastore_close)

<a name="ZipDatastore"></a>
### `class ZipDatastore`

ZipDatastore is a class to manage reading from, and writing to a ZIP archives using [CID](https://github.com/multiformats/js-cid)s as keys and
file names in the ZIP and binary block data as the file contents.

<a name="ZipDatastore_new"></a>
#### `ZipDatastore(zipFile)`

Create a new ZipDatastore backed by a ZIP archive located at the path provided by the `zipFile`
argument.

If the file located at `zipFile` does not exist, it will be written when `close()` is called. If
it exists, it will be opened and parsed and entries made available via `get()` and `has()`.

**Parameters:**

* **`zipFile`** _(`string`)_: a path to a ZIP archive that may or may not exist.

<a name="ZipDatastore_open"></a>
### `async ZipDatastore#open()`

Open the ZIP archive and perform an initial parse of the data. This method doesn't need to be called
during normal operation. An archive that isn't already open when calling `get()`, `put()`, `has()` it
will be opened automatically.

<a name="ZipDatastore_put"></a>
### `async ZipDatastore#put(key, value)`

Store a block in this archive. `key`s are converted to `CID` automatically, whether you provide a native
Datastore `Key` object, a `String` or a `CID`. `key`s that cannot be converted will throw an error.

The entry will not be written to the ZIP archive until `close()` is called, in the meantime it is stored
in memory.

**Parameters:**

* **`key`** _(`string|Key|CID`)_: a `CID` or `CID`-convertable object to identify the `value`.
* **`value`** _(`Buffer|Uint8Array`)_: an IPLD block matching the given `key` `CID`.

<a name="ZipDatastore_get"></a>
### `async ZipDatastore#get(key)`

Retrieve a block from this archive. `key`s are converted to `CID` automatically, whether you provide a native
Datastore `Key` object, a `String` or a `CID`. `key`s that cannot be converted will throw an error.

**Parameters:**

* **`key`** _(`string|Key|CID`)_: a `CID` or `CID`-convertable object to identify the block.

<a name="ZipDatastore_has"></a>
### `async ZipDatastore#has(key)`

Check whether a block exists in this archive. `key`s are converted to `CID` automatically, whether you provide a native
Datastore `Key` object, a `String` or a `CID`. `key`s that cannot be converted will throw an error.

**Parameters:**

* **`key`** _(`string|Key|CID`)_: a `CID` or `CID`-convertable object to identify the block.

<a name="ZipDatastore_delete"></a>
### `async ZipDatastore#delete(key)`

Delete a block from this archive. `key`s are converted to `CID` automatically, whether you provide a native
Datastore `Key` object, a `String` or a `CID`. `key`s that cannot be converted will throw an error.

If the `key` does not exist, `put()` will silently return.

**Parameters:**

* **`key`** _(`string|Key|CID`)_: a `CID` or `CID`-convertable object to identify the block.

<a name="ZipDatastore_close"></a>
### `async ZipDatastore#close()`

Close this archive and write its new contents if required.

If a mutation operation has been called on the open archive (`put()`, `delete()`), a new ZIP archive will be
written with the mutated contents.

## License and Copyright

Copyright 2019 Rod Vagg

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
