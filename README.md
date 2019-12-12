# datastore-zipcar (js-ds-zipcar) [![Build Status](https://github.com/rvagg/js-ds-zipcar/workflows/CI/badge.svg)](https://github.com/rvagg/js-ds-zipcar/actions?workflow=CI)

[![NPM](https://nodei.co/npm/datastore-zipcar.svg)](https://nodei.co/npm/datastore-zipcar/)

An implementation of a [Datastore](https://github.com/ipfs/interface-datastore) for [IPLD](https://ipld.io) data that operates on ZIP files, supporting interacting via [CID](https://github.com/ipfs/go-cid) rather than the native Datastore Key type.

A Go implementation is also available at [go-ds-zipcar](https://github.com/rvagg/go-ds-zipcar).

## Example

```js
const ZipDatastore = require('datastore-zipcar')
const Block = require('@ipld/block')

async function example () {
  const block = Block.encoder(Buffer.from('random meaningless bytes'), 'raw')
  const cid = await block.cid()

  const ds = await ZipDatastore.readWriteFile('example.zcar')

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

In this example, the `readWriteFile()` create-mode is used. This allows for read and mutation operations on a single ZipDatastore. Other create-modes are useful where the environment, data and needs demand:

* **[`ZipDatastore.readWriteFile(file)`](#ZipDatastore__readWriteFile)**: read and mutate a ZIP archive file. Makes use of memory to cache reads and buffer the entire contents of the archive prior to writing. This mode is _not available_ in a browser environment.
* **[`ZipDatastore.fromBuffer(buffer)`](#ZipDatastore__fromBuffer)**: read a ZIP archive from a `Buffer` or `Uint8Array`. Does not support mutation operations, only reads. This mode is the only mode _available_ in a browser environment.
* **[`ZipDatastore.fromFile(file)`](#ZipDatastore__fromFile)**: read a ZIP archive directly from a file. Does not support mutation operations, only reads. However, this mode is very efficient for large data sets, with no caching and streaming reads internally. This mode is _not available_ in a browser environment.
* **[`ZipDatastore.toStream(stream)`](#ZipDatastore__toStream)**: write a ZIP archive to a stream (e.g. `fs.createWriteStream(file)`). Does not support read operations, only writes, and the writes are append-only (i.e. no `delete()`). However, this mode is very efficient for dumping large data sets, with minimal caching (the manifest at the end of the ZIP requires some caching of keys and positions), and streaming writes. This mode is _not available_ in a browser environment.

The nature of ZIP archives (and the libraries currently available in JavaScript to work with them) means there are some awkward limitations. For example, there is no `fromStream()` operation because ZIP files require a seek to the end to read the manifest before entries may be individually read.

## API

### Contents

 * [`async ZipDatastore.fromBuffer(buffer)`](#ZipDatastore__fromBuffer)
 * [`async ZipDatastore.fromFile(file)`](#ZipDatastore__fromFile)
 * [`async ZipDatastore.toStream(stream)`](#ZipDatastore__toStream)
 * [`async ZipDatastore.readWriteFile(file)`](#ZipDatastore__readWriteFile)
 * [`class ZipDatastore`](#ZipDatastore)
 * [`async ZipDatastore#get(key)`](#ZipDatastore_get)
 * [`async ZipDatastore#has(key)`](#ZipDatastore_has)
 * [`async ZipDatastore#put(key, value)`](#ZipDatastore_put)
 * [`async ZipDatastore#delete(key)`](#ZipDatastore_delete)
 * [`async ZipDatastore#setRoots(comment)`](#ZipDatastore_setRoots)
 * [`async ZipDatastore#getRoots()`](#ZipDatastore_getRoots)
 * [`async ZipDatastore#close()`](#ZipDatastore_close)
 * [`async ZipDatastore#query([q])`](#ZipDatastore_query)

<a name="ZipDatastore__fromBuffer"></a>
### `async ZipDatastore.fromBuffer(buffer)`

Create a ZipDatastore from a Buffer containing the contents of an existing
ZIP archive which contains IPLD data. The ZipDatastore returned will not
support mutation operations (`put()`, `delete()`, `setRoots()`).

This create-mode is memory intensive as the Buffer is kept in memory while
this ZipDatastore remains active. However, this create-mode is the only
mode supported in a browser environment.

**Parameters:**

* **`buffer`** _(`Buffer|Uint8Array`)_: the byte contents of a ZIP archive

**Return value**  _(`ZipDatastore`)_: a read-only ZipDatastore.

<a name="ZipDatastore__fromFile"></a>
### `async ZipDatastore.fromFile(file)`

Create a ZipDatastore from an existing ZIP archive containing IPLD data. The
ZipDatastore returned will not support mutation operations (`put()`,
`delete()`, `setRoots()`) and reads will not perform any caching but be read
via stream from the underlying file on demand.

This is an efficient create-mode, useful for reading the contents of an
existing, large ZipDatastore archive.

This create-mode is not available in a browser environment.

**Parameters:**

* **`file`** _(`string`)_: the path to an existing ZIP archive.

**Return value**  _(`ZipDatastore`)_: a read-only, streaming ZipDatastore.

<a name="ZipDatastore__toStream"></a>
### `async ZipDatastore.toStream(stream)`

Create a ZipDatastore that writes to a writable stream. The ZipDatastore
returned will _only_ support append operations (`put()` and `setRoots()`, but
not `delete()`) and no caching will be performed, with entries written
directly to the provided stream.

This is an efficient create-mode, useful for writing large amounts of data to
ZIP archive.

This create-mode is not available in a browser environment.

**Parameters:**

* **`stream`** _(`WritableStream`)_: a writable stream

**Return value**  _(`ZipDatastore`)_: an append-only, streaming ZipDatastore.

<a name="ZipDatastore__readWriteFile"></a>
### `async ZipDatastore.readWriteFile(file)`

Create a ZipDatastore from an existing ZIP archive containing IPLD data. The
ZipDatastore returned will support both read operations (`get()`, `has()`,
`getRoots()`), and mutation operations (`put()`,`delete()`, `setRoots()`).
Reads will be cached in memory for as long as this ZipDatastore is active and
a `close()`, where a mutation operation has been performed, will result in a
full read and cache of the original archive prior to flushing back to disk.

This is an inefficient create-mode, useful for read/write operations on
smaller data sets but not as useful for large data sets.

This create-mode is not available in a browser environment.

**Parameters:**

* **`file`** _(`string`)_: the path to an existing ZIP archive.

**Return value**  _(`ZipDatastore`)_: a read-only, streaming ZipDatastore.

<a name="ZipDatastore"></a>
### `class ZipDatastore`

ZipDatastore is a class to manage reading from, and writing to a ZIP archives
using [CID](https://github.com/multiformats/js-cid)s as keys and file names
in the ZIP and binary block data as the file contents.

<a name="ZipDatastore_get"></a>
### `async ZipDatastore#get(key)`

Retrieve a block from this archive. `key`s are converted to `CID`
automatically, whether you provide a native Datastore `Key` object, a
`String` or a `CID`. `key`s that cannot be converted will throw an error.

This operation may not be supported in some create-modes; a write-only mode
may throw an error if unsupported.

**Parameters:**

* **`key`** _(`string|Key|CID`)_: a `CID` or `CID`-convertable object to identify
  the block.

**Return value**  _(`Buffer`)_: the IPLD block data referenced by the CID.

<a name="ZipDatastore_has"></a>
### `async ZipDatastore#has(key)`

Check whether a block exists in this archive. `key`s are converted to `CID`
automatically, whether you provide a native Datastore `Key` object, a
`String` or a `CID`. `key`s that cannot be converted will throw an error.

This operation may not be supported in some create-modes; a write-only mode
may throw an error if unsupported.

**Parameters:**

* **`key`** _(`string|Key|CID`)_: a `CID` or `CID`-convertable object to identify
  the block.

**Return value**  _(`boolean`)_: indicating whether the key exists in this Datastore.

<a name="ZipDatastore_put"></a>
### `async ZipDatastore#put(key, value)`

Store a block in this archive. `key`s are converted to `CID` automatically,
whether you provide a native Datastore `Key` object, a `String` or a `CID`.
`key`s that cannot be converted will throw an error.

Depending on the create-mode of this ZipDatastore, the entry may not be
written to the ZIP archive until `close()` is called and in the meantime be
stored in memory. If you need to write a lot of data, ensure you are using
a stream-writing create-mode.

**Parameters:**

* **`key`** _(`string|Key|CID`)_: a `CID` or `CID`-convertable object to identify
  the `value`.
* **`value`** _(`Buffer|Uint8Array`)_: an IPLD block matching the given `key`
  `CID`.

<a name="ZipDatastore_delete"></a>
### `async ZipDatastore#delete(key)`

Delete a block from this archive. `key`s are converted to `CID`
automatically, whether you provide a native Datastore `Key` object, a
`String` or a `CID`. `key`s that cannot be converted will throw an error.

If the `key` does not exist, `delete()` will silently return.

This operation may not be supported in some create-modes; a write-only mode
may throw an error if unsupported. Where supported, this mode is likely to
result in state stored in memory until the final `close()` is called.

**Parameters:**

* **`key`** _(`string|Key|CID`)_: a `CID` or `CID`-convertable object to identify
  the block.

<a name="ZipDatastore_setRoots"></a>
### `async ZipDatastore#setRoots(comment)`

Set the list of roots in the ZipDatastore archive on this ZIP archive.

The roots will be written to the comment section of the ZIP archive when
`close()` is called, in the meantime it is stored in memory.

In some create-modes this operation may not be supported. In read-only
modes you cannot change the roots of a ZipDatastore and an error may be
thrown.

**Parameters:**

* **`comment`** _(`string`)_: an arbitrary comment to store in the ZIP archive.

<a name="ZipDatastore_getRoots"></a>
### `async ZipDatastore#getRoots()`

Get the list of roots set on this ZIP archive if they exist exists. See
[`ZipDatastore#setRoots`](#ZipDatastore_setRoots).

**Return value**  _(`Array.<CID>`)_: an array of CIDs

<a name="ZipDatastore_close"></a>
### `async ZipDatastore#close()`

Close this archive, free resources and write its new contents if required
and supported by the create-mode used.

If the create-mode of the current ZipDatastore supports writes and a
mutation operation has been called on the open archive (`put()`,
`delete()`), a new ZIP archive will be written with the mutated contents.

<a name="ZipDatastore_query"></a>
### `async ZipDatastore#query([q])`

Create an async iterator for the entries of this ZipDatastore. Ideally for
use with `for await ... of` to lazily iterate over the entries.

By default, each element returned by the iterator will be an object with a
`key` property with the string CID of the entry and a `value` property with
the binary data.

Supply `{ keysOnly: true }` as an argument and the elements will only
contain the keys, without needing to load the values from storage.

The `filters` parameter is also supported as per the Datastore interface.

**Parameters:**

* **`q`** _(`Object`, optional)_: query parameters

**Return value**  _(`AsyncIterator.<key, value>`)_

## License and Copyright

Copyright 2019 Rod Vagg

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
