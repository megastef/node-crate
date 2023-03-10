'use strict'

/* global describe, it */
const {expect} = require('expect')

const crate = require('../')

// Why only 50? the default setting in crate ...
// EsThreadPoolExecutor[bulk, queue capacity = 50]
// for more than 50 inserts at once use Bulk insert or increase queue in Crate
const docsToInsert = 50

crate.connect(process.env.CRATE_URL || 'http://127.0.0.1:4200')

const blobTableName = 'blob_test_3'
const tableName = 'NodeCrateTest_3'

describe('#node-crate', function () {
  this.slow(15000)

  it('should create blob table', async () => {
    const res = await crate.createBlobTable(blobTableName, 0, 1)
    expect(res.rowcount).toBe(1)
  });

  it('should create table', async () => {
    const schema = {}
    schema[tableName] = { id: 'integer primary key', title: 'string', numberVal: 'integer' }

    const res = await crate.create(schema)
    expect(res.rowcount).toBe(1)
  });

  it('should create table if not exists - table exists', async () => {
    const schema = {}
    schema[tableName] = { id: 'integer primary key', title: 'string', numberVal: 'integer' }

    const res = await crate.createIfNotExists(schema)
    expect(res.rowcount).toBe(0)
  })

  it('should drop table to create again', async () => {
    const res = await crate.drop(tableName)
    expect(res.rowcount).toBe(1)
  })

  it('should create table if not exists - table does not exist', async () => {
    const schema = {}
    schema[tableName] = { id: 'integer primary key', title: 'string', numberVal: 'integer' }

    const res = await crate.createIfNotExists(schema)
    expect(res.rowcount).toBe(1)
  })

  let hashkey = ''

  it('should insert blob', async () => {
    const res = await crate.insertBlobFile(blobTableName, './lib/index.js');
    expect(res.length).toBe(40);
    hashkey = res;
  });

  it('should insert', async () => {
    const res = await crate.insert(tableName, {
      id: '1',
      title: 'Title',
      numberVal: 42
    });
    expect(res.rowcount).toBe(1);
  });

  it('should insert many', async () => {
    let success = 0
    let errorReported = false
    let longTitle = 'A long title to generate larger chunks ...'

    for (let k = 0; k < 5; ++k) {
      longTitle += longTitle
    }

    for (let i = 0; i < docsToInsert; ++i) {
      await crate.insert(tableName, {
        id: i + 100,
        title: longTitle,
        numberVal: 42
      })
      .then(() => {
        success++;
      })
      .catch((err) => {
        throw err;
      });
    }
    expect(success).toBe(docsToInsert);
  });

  it('should insert bulk documents', async () => {
    const title = 'A title';
    const bulkArgs = [];

    for (let i = 0; i < docsToInsert; ++i) {
      bulkArgs[i] = [i + 1000, title, 42];
    }

    const res = await crate.executeBulk(`INSERT INTO ${tableName} ("id","title","numberVal") Values (?, ?, ?)`, bulkArgs);
    expect(res.results.length).toBe(docsToInsert);
  });

  it('should select', async () => {
    await crate.execute(`REFRESH TABLE ${tableName}`);
    const res = await crate.execute(`SELECT * FROM ${tableName} limit ${docsToInsert}`);
    expect(res.rowcount).toBe(docsToInsert);
  });

  it('should update', async () => {
    const res = await crate.update(tableName, {
      title: 'TitleNew'
    }, 'id=1');
    expect(res.rowcount).toBe(1);
  });

  it('should select after update', async () => {
    await crate.execute(`REFRESH TABLE ${tableName}`);
    const res = await crate.execute(`SELECT * FROM ${tableName} where id=1 limit 100`);
    expect(res.json[0].title).toBe('TitleNew');
    expect(res.json[0].numberVal).toBe(42);
  });

  it('should get blob', async () => {
    const res = await crate.getBlob('blobtest', hashkey);
    expect(res instanceof Buffer).toBe(true);
  });

  it('should delete', async () => {
    const res = await crate.delete(tableName, 'id=1');
    await crate.execute(`REFRESH TABLE ${tableName}`);
    expect(res.rowcount).toBe(1);
  });

  it('should drop table', async () => {
    const res = await crate.drop(tableName);
    expect(res.rowcount).toBe(1);
  });

  it('should drop blob table', async () => {
    const res = await crate.dropBlobTable(blobTableName);
    expect(res.rowcount).toBe(1);
  });

  it('should fail to drop blob table with empty name', async () => {
    try {
      await crate.dropBlobTable();
    } catch (err) {
      expect(err.message).toBe('Table name is not specified!');
    }
  });
})
