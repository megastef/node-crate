'use strict'

/* global describe, it */
const expect = require('expect')

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

  it('Create blob table', (done) => {
    crate.createBlobTable(blobTableName, 0, 1)
      .then((res) => {
        expect(res.rowcount).toBe(1)
        done()
      })
      .catch((err) => {
        done(err)
      })
  })

  it('Create table', (done) => {
    const schema = {}
    schema[tableName] = {id: 'integer primary key', title: 'string'}

    crate.create(schema)
      .then((res) => {
        expect(res.rowcount).toBe(1)
        done()
      })
      .catch((err) => {
        done(err)
      })
  })

  it('Create table if not exists - table exists', (done) => {
    const schema = {}
    schema[tableName] = {id: 'integer primary key', title: 'string'}

    crate.createIfNotExists(schema)
      .then((res) => {
        expect(res.rowcount).toBe(0)
        done()
      })
      .catch((err) => {
        done(err)
      })
  })

  it('Drop table to create again', (done) => {
    crate.drop(tableName)
      .then((res) => {
        expect(res.rowcount).toBe(1)
        done()
      })
      .catch((err) => {
        done(err)
      })
  })

  it('Create table if not exists - table does not exist', (done) => {
    const schema = {}
    schema[tableName] = {id: 'integer primary key', title: 'string'}

    crate.createIfNotExists(schema)
      .then((res) => {
        expect(res.rowcount).toBe(1)
        done()
      })
      .catch((err) => {
        done(err)
      })
  })

  let hashkey = ''

  it('Insert blob', (done) => {
    setTimeout(() => {
      // var buffer = new Buffer([1,3,4])
      crate.insertBlobFile(blobTableName, './lib/index.js')
        .then((res) => {
          expect(res.length).toBe(40)
          hashkey = res
          done()
        })
        .catch((err) => {
          done(err)
        })
    }, 100)
  })

  it('Insert', (done) => {
    setTimeout(() => {
      crate.insert(tableName, {
        id: '1',
        title: 'Title',
        numberVal: 42
      })
        .then((res) => {
          expect(res.rowcount).toBe(1)
          done()
        })
        .catch((err) => {
          done(err)
        })
    }, 500)
  })

  it('Insert many', (done) => {
    setTimeout(() => {
      let success = 0
      let errorReported = false
      let longTitle = 'A long title to generate larger chunks ...'

      for (let k = 0; k < 5; ++k) {
        longTitle += longTitle
      }

      for (let i = 0; i < docsToInsert; ++i) {
        crate.insert(tableName, {
          id: i + 100,
          title: longTitle,
          numberVal: 42
        })
          .then(() => {
            success++

            if (success === docsToInsert) {
              done()
            }
          })
          .catch((err) => {
            if (!errorReported) {
              errorReported = true
              done(err)
            }
          })
      }
    }, 500)
  })

  it('Insert bulk', (done) => {
    setTimeout(() => {
      let errorReported = false
      const title = 'A title'
      const bulkArgs = []

      for (let i = 0; i < docsToInsert; ++i) {
        bulkArgs[i] = [
          i + 1000,
          title,
          42
        ]
      }

      crate.executeBulk(`INSERT INTO ${tableName} ("id","title","numberVal") Values (?, ?, ?)`, bulkArgs)
        .then((res) => {
          expect(res.results.length).toBe(docsToInsert)
          done()
        })
        .catch((err) => {
          if (!errorReported) {
            errorReported = true
            done(err)
          }
        })
    }, 500)
  })

  it('Select', (done) => {
    setTimeout(() => {
      crate.execute(`SELECT * FROM ${tableName} limit ${docsToInsert}`)
        .then((res) => {
          expect(res.rowcount).toBe(docsToInsert)
          done()
        })
        .catch((err) => {
          done(err)
        })
    }, 10000)
  })

  it('Update', (done) => {
    setTimeout(() => {
      crate.update(tableName, {
        title: 'TitleNew'
      }, 'id=1')
        .then((res) => {
          expect(res.rowcount).toBe(1)
          done()
        })
        .catch((err) => {
          done(err)
        })
    }, 2000)
  })

  it('Select after update', (done) => {
    setTimeout(() => {
      crate.execute(`SELECT * FROM ${tableName} where id=1 limit 100`)
        .then((res) => {
          expect(res.json[0].title).toBe('TitleNew')
          expect(res.json[0].numberVal).toBe(42)
          done()
        })
        .catch((err) => {
          done(err)
        })
    }, 4000)
  })

  it('Get blob', (done) => {
    crate.getBlob('blobtest', hashkey)
      .then((res) => {
        if (!(res instanceof Buffer)) {
          throw new Error('Should be a buffer')
        }

        done()
      })
      .catch((err) => {
        done(err)
      })
  })

  it('Delete', (done) => {
    crate.delete(tableName, 'id=1')
      .then((res) => {
        expect(res.rowcount).toBe(1)
        done()
      })
      .catch((err) => {
        done(err)
      })
  })

  it('Drop table', (done) => {
    crate.drop(tableName)
      .then((res) => {
        expect(res.rowcount).toBe(1)
        done()
      })
      .catch((err) => {
        done(err)
      })
  })

  it('Drop blob table', (done) => {
    setTimeout(() => {
      crate.dropBlobTable(blobTableName)
        .then((res) => {
          expect(res.rowcount).toBe(1)
          done()
        })
        .catch((err) => {
          done(err)
        })
    }, 6000)
  })

  it('Drop blob table with empty name', (done) => {
    setTimeout(() => {
      crate.dropBlobTable()
        .then(() => {
          done(new Error('Expects to not succeed.'))
        })
        .catch((err) => {
          expect(err).toBe('Table name is not specified!')
          done()
        })
    }, 6000)
  })
})
