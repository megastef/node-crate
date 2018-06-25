'use strict'
/*
The MIT License(MIT)
Copyright(C) 2014 by Stefan Thies, Igor Likhomanov

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files(the "Software"),
to deal in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and / or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

const connectionPool = require('./connection-pool.js')
const crateTypes = require('./types')
const Type = require('type-of-is')
const http = require('http')
const crypto = require('crypto')
const fs = require('fs')

const qMarks = '?'

function getValueByType (v) {
  if (Type.is(v, Date)) {
    return v.getTime()
  }
  return v
}

/**
 * @param {string[]} options
 * @returns values
 * @returns values.keys
 * @returns values.values
 * @returns values.args
 */
function _prepareOptions (options) {
  const values = {}
  const keys = Object.keys(options)
  values.keys = keys.map((i) => '"' + i + '"')
  values.values = keys.map(() => qMarks)
  values.args = keys.map((i) => getValueByType(options[i]))

  return values
}

function _executeBulkSql (sql, bulkArgs) {
  return _executeSql(sql, bulkArgs, true)
}

/**
 * @param {string} sql
 * @param {string[]} args
 */
function _executeSql (sql, args = [], bulk = false) {
  return new Promise((resolve, reject) => {
    const callback = function (response) {
      const data = []

      response.on('data', (chunk) => {
        data.push(chunk)
      })

      response.on('error', (err) => {
        return reject(err)
      })

      response.on('end', () => {
        let result = {}
        let json

        try {
          result = JSON.parse(data.join(''))
        } catch (ex) {
          return reject(ex)
        }

        if (!result.rows) { /* || /CREATE BLOB/im.test (sql)) */
          // workaround CRATE does not return a row when it creates a BLOB
          result.rows = []
        }

        if (result.error) {
          return reject(result.error)
        }

        /* jslint nomen: true */
        result.__defineGetter__('json', () => {
          if (!json) {
            json = result.rows.map((e) => {
              const x = {}
              for (let i = 0; i < result.cols.length; ++i) {
                if (result.col_types && result.col_types[i] === crateTypes.TIMESTAMP) {
                  x[result.cols[i]] = new Date(e[i])
                } else {
                  x[result.cols[i]] = e[i]
                }
              }

              return x
            })
          }

          return json
        })

        /* jslint nomen: false */
        return resolve(result)
      })
    }

    const req = connectionPool.getSqlRequest(callback)
    // let node know what to do in case of unexpected errors
    // before anything has been sent/received.
    req.on('error', (err) => {
      console.log('Unexpected connection error', err)
      req.end()
      return reject(err)
    })
    let command = {
      stmt: sql
    }

    if (bulk === true) {
      command['bulk_args'] = args
    } else {
      command['args'] = args
    }

    command = JSON.stringify(command)

    try {
      req.write(command)
      req.end()
    } catch (ex) {
      return reject(ex)
    }
  })
}

/**
 * @param {string} tableName
 * @param {string} buffer
 */
function _insertBlob (tableName, buffer) {
  return new Promise((resolve, reject) => {
    const hashCode = crypto.createHash('sha1').update(buffer, 'binary').digest('hex')

    const callback = function (response) {
      let body = ''

      response.on('data', (data) => {
        body += data.toString()
        return undefined
      })

      response.on('error', (err) => {
        return reject(err)
      })

      response.on('end', () => {
        // if the object already exists CRATE returns 409 status code
        if (response.statusCode === 409) {
          return reject(new Error('error 409: already exists'))
        }

        // if everything is alreight CRATE returns '201 created' status
        if (response.statusCode > 299) {
          return reject(new Error(`error HTTP status code: ${response.statusCode} ${body}`))
        }

        return resolve(hashCode)
      })
    }

    const req = createBlobWriteStream(tableName, hashCode, callback)

    try {
      req.write(buffer)
      req.end()
    } catch (ex) {
      return reject(ex)
    }
  })
}

/**
 * @param {string} tableName
 * @param {string} streamId - unique ID for the blob
 * @param {requestCallback} cb - callback function gor the http request
 * @returns http.request object (writeable)
 */
function createBlobWriteStream (tableName, streamId, cb) {
  const options = connectionPool.getHttpOptions()
  const blobOptions = {
    host: options.host,
    path: `/_blobs/${tableName}/${streamId}`,
    port: options.port,
    method: 'PUT',
    headers: { 'Conent-Type': 'application/binary' }
  }

  return http.request(blobOptions, cb)
}

module.exports = {
  types: crateTypes,
  connect: (host, port) => {
    if (port && port >= 0) {
      connectionPool.connect(`http://${host}:${port}`)
    } else {
      connectionPool.connect(host)
    }
  },

   /**
    * @param {string} tableName
    * @param {string[]} options
    */
  insert: (tableName, options) => {
    if (arguments.length < 2) {
      return Promise.reject('missed arguments!')
    }

    if (!tableName) {
      return Promise.reject('Table name is not specified')
    }

    if (!options) {
      return Promise.reject('Record entry is not defined')
    }

    const preparedOptions = _prepareOptions(options)
    const preparedQuery = `INSERT INTO ${tableName} (${preparedOptions.keys}) VALUES (${preparedOptions.values})`

    return _executeSql(preparedQuery, preparedOptions.args)
  },

   /**
    * @param {string} tableName
    * @param {string[]} options
    * @param {string} whereClause
    */
  update: (tableName, options, whereClause) => {
    if (arguments.length < 3) {
      return Promise.reject('missed arguments!')
    }

    if (!tableName) {
      return Promise.reject('Table name is not specified!')
    }

    if (!options) {
      return Promise.reject('Record entry is not defined')
    }

    if (!whereClause) {
      return Promise.reject('Where clause is not defined')
    }

    const preparedOptions = _prepareOptions(options)
    const setStmtParts = []

    for (let i = 0; i < preparedOptions.keys.length; ++i) {
      setStmtParts.push(`${preparedOptions.keys[i]}=${preparedOptions.values[i]}`)
    }

    const preparedQuery = `UPDATE ${tableName} SET ${setStmtParts.join(' , ')}  WHERE  ${whereClause}`

    return _executeSql(preparedQuery, preparedOptions.args)
  },

   /**
    * @param {string} tableName
    * @param {string} whereClause
    */
  delete: (tableName, whereClause) => {
    if (arguments.length < 2) {
      return Promise.reject('missed arguments!')
    }

    if (!tableName) {
      return Promise.reject('Table name is not specified!')
    }

    if (!whereClause) {
      return Promise.reject('Where clause is not defined')
    }

    const preparedQuery = `DELETE FROM ${tableName} WHERE ${whereClause}`

    return _executeSql(preparedQuery)
  },

   /**
    * @param {string} tableName
    */
  drop: (tableName) => {
    if (!tableName) {
      return Promise.reject('Table name is not specified!')
    }

    const preparedQuery = `DROP TABLE ${tableName}`
    return _executeSql(preparedQuery)
  },

   /**
    * @param {string} tableName
    */
  dropBlobTable: (tableName) => {
    if (!tableName) {
      return Promise.reject('Table name is not specified!')
    }

    const preparedQuery = `DROP BLOB TABLE ${tableName}`
    return _executeSql(preparedQuery)
  },

   /**
    * @param {string} sql statement
    * @param {array} args (optional)
    */
  execute: (sql, args = []) => _executeSql(sql, args),

  executeBulk: (sql, bulkArgs = []) => _executeBulkSql(sql, bulkArgs),

  insertBlob: _insertBlob,

   /**
    * @param {string} tableName
    * @param {string} filename
    */
  insertBlobFile: (tableName, filename) => {
    return new Promise((resolve, reject) => {
      fs.readFile(filename, (err, data) => {
        if (err) {
          return reject(err)
        }

        _insertBlob(tableName, data)
          .then((res) => resolve(res))
          .catch((err) => reject(err))
      })
    })
  },

  /**
   * @param {string} tableName
   * @param {string} hashKey
   */
  getBlob: (tableName, hashKey) => {
    return new Promise((resolve, reject) => {
      const callback = function (response) {
        const buffer = []

        response.on('data', (chunk) => {
          buffer.push(chunk)
        })

        response.on('error', (err) => {
          return reject(err)
        })

        response.on('end', () => {
          return resolve(Buffer.concat(buffer))
        })
      }

      const reqUrl = `${connectionPool.getBlobUrl()}${tableName}/${hashKey}`
      http.get(reqUrl, callback)
    })
  },

   /**
    * @param {object} schema like: {person: {name: 'string', age: 'integer'}}
    */
  create: (schema) => {
    const tableName = Object.keys(schema)[0]
    const table = schema[tableName]
    const cols = Object.keys(table).map((key) => {
      return `${key} ${table[key]}`
    })

    const statement = `CREATE TABLE ${tableName} (${cols})`
    return _executeSql(statement)
  },
   /**
    * @param {object} schema like: {person: {name: 'string', age: 'integer'}}
    */
  createIfNotExists: (schema) => {
    const tableName = Object.keys(schema)[0]
    const table = schema[tableName]
    const cols = Object.keys(table).map((key) => {
      return `${key} ${table[key]}`
    })

    const statement = `CREATE TABLE IF NOT EXISTS ${tableName} (${cols})`
    return _executeSql(statement)
  },

   /**
    * @param {tableName} Name of the BLOB Table
    * @param {replicas} Number of replicas
    * @param {shards} Number of shards
    */
  createBlobTable: (tableName, replicas, shards) => {
    const statement = `CREATE BLOB TABLE ${tableName} clustered into ${shards} shards with (number_of_replicas=${replicas})`
    return _executeSql(statement)
  }

}
