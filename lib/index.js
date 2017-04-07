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

var connectionPool = require('./connection-pool.js')
var crateTypes = require('./types')
var Type = require('type-of-is')
var http = require('http')
var dCap = require('d.js').nodeCapsule
// to build hashkeys for blobs
var crypto = require('crypto')
var fs = require('fs')
var qMarks = '?'

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
function prepareOptions (options) {
  var values = {}
  var keys = Object.keys(options)
  values.keys = keys.map(function (i) {
    return '"' + i + '"'
  })
  values.values = keys.map(function () {
    return qMarks
  })
  values.args = keys.map(function (i) {
    return getValueByType(options[i])
  })
  return values
}

/**
 * @param {string[]} options
 * @returns values
 * @returns values.keys
 */
function prepareOptionsInsert (options) {
  var values = {}
  var keys = Object.keys(options)
  values = keys.map(function (i) {
    var v = getValueByType(options[i])
    var rv = "\"" + i + "\" = '" + v + "'"
    if (v instanceof Number) {
      rv = "\"" + i + "\" = " + v
    }
    return rv
  })
  return values
}

function executeBulkSql (sql, bulkArgs, cb) {
  executeSql(sql, bulkArgs, cb, true)
}

/**
 * @param {string} sql
 * @param {string[]} args
 * @param {requestCallback} cb
 */
function executeSql (sql, args, cb, bulk) {
  bulk = (typeof bulk === 'undefined') ? false : bulk
  var callback = function (response) {
    var data = []
    response.on('data', function (chunk) {
      data.push(chunk)
    })
    response.on('uncaughtException', function (err) {
      cb(err, null)
    })
    response.on('error', function (err) {
      cb(err, null)
    })
    response.on('end', function () {
      var result = {}
      var json
      try {
        result = JSON.parse(data.join(''))
      } catch (ex) {
        cb(ex, null, null)
        return
      }
      if (!result.rows) { /* || /CREATE BLOB/im.test (sql)) */
        // workaround CRATE does not return a row when it creates a BLOB
        result.rows = []
      }
      if (result.error) {
        cb(result.error, null, null)
        return
      }
      /* jslint nomen: true */
      result.__defineGetter__('json', function () {
        if (!json) {
          json = result.rows.map(function (e) {
            var x = {}
            for (var i = 0; i < result.cols.length; i += 1) {
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
      cb(null, result)
    })
  }
  var req = connectionPool.getSqlRequest(callback)
  var command = {
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
    cb(ex, null)
  }
}

/**
 * @param {string} tableName
 * @param {string} buffer
 * @param {requestCallback} cb
 */
function insertBlob (tableName, buffer, cb) {
  var hashCode = crypto.createHash('sha1').update(buffer, 'binary').digest('hex')
  var callback = function (response) {
    var body = ''
    response.on('data', function (data) {
      body = body + data.toString()
      return undefined
    })
    response.on('error', function (err) {
      cb(err)
    })
    response.on('end', function () {
      // if the object already exists CRATE returns 409 status code
      if (response.statusCode === 409) {
        cb(new Error('error 409: already exists'), hashCode)
        return
      }
      // if everything is alreight CRATE returns '201 created' status
      if (response.statusCode > 299) {
        cb(new Error('error HTTP status code:' + response.statusCode + ' ' + body), hashCode)
        return
      }
      cb(null, hashCode)
    })
  }
  var req = createBlobWriteStream(tableName, hashCode, callback)
  try {
    req.write(buffer)
    req.end()
  } catch (ex) {
    cb(ex, null)
  }
}

/**
 * @param {string} tableName
 * @param {string} streamId - unique ID for the blob
 * @param {requestCallback} cb - callback function gor the http request
 * @returns http.request object (writeable)
 */
function createBlobWriteStream (tableName, streamId, cb) {
  var options = connectionPool.getHttpOptions()
  var blobOptions = {
    host: options.host,
    path: '/_blobs/' + tableName + '/' + streamId,
    port: options.port,
    method: 'PUT',
    headers: {'Conent-Type': 'application/binary'}
  }
  var req = http.request(blobOptions, cb)
  return req
}

module.exports = {
  types: crateTypes,

  connect: function connect (host, port) {
    if (port && port >= 0) {
      connectionPool.connect('http://' + host + ':' + port)
    } else {
      connectionPool.connect(host)
    }
  },

  /**
   * @param {string} tableName
   * @param {string[]} options
   * @param {requestCallback} cb
   */
  insert: dCap(function insert (tableName, options, cb) {
    if (arguments.length < 3) {
      console.log('missed arguments!')
      return
    }

    if (!tableName) {
      cb('Table name is not specified', null)
      return
    }

    if (!options) {
      cb('Record entry is not defined', null)
      return
    }

    var preparedOptions = prepareOptions(options)
    var preparedQuery = 'INSERT INTO ' + tableName + ' ' + '(' + preparedOptions.keys + ')' + ' VALUES (' + preparedOptions.values + ')'
    executeSql(preparedQuery, preparedOptions.args, cb)
  }),

  /**
   * @param {string} tableName
   * @param {string[]} options
   * @param {string} whereClaus
   * @param {requestCallback} cb
   */
  update: dCap(function update (tableName, options, whereClause, cb) {
    if (arguments.length < 3) {
      console.log('missed arguments!')
      return
    }

    if (!tableName) {
      cb('Table name is not specified', null)
      return
    }

    if (!options) {
      cb('Record entry is not defined', null)
      return
    }

    if (!whereClause) {
      cb('Where clause is not defined', null)
      return
    }

    var preparedOptions = prepareOptions(options)
    var setStmtParts = [];
    for(var x = 0; x < preparedOptions.keys.length; x++){
      setStmtParts.push(preparedOptions.keys[x] + " = " + preparedOptions.values[x]);
    }
    var preparedQuery = 'UPDATE ' + tableName + ' SET ' + setStmtParts.join(' , ') + ' WHERE ' + whereClause

    executeSql(preparedQuery, preparedOptions.args, cb)
  }),

  /**
   * @param {string} tableName
   * @param {string} whereClause
   * @param {requestCallback} cb
   */
  delete: dCap(function $delete (tableName, whereClause, cb) {
    if (arguments.length < 3) {
      console.log('missed arguments!')
      return
    }

    if (!tableName) {
      cb('Table name is not specified', null)
      return
    }

    if (!whereClause) {
      cb('Where clause is not defined', null)
      return
    }

    var preparedQuery = 'DELETE FROM ' + tableName + ' WHERE ' + whereClause

    executeSql(preparedQuery, [], cb)
  }),

  /**
   * @param {string} tableName
   * @param {requestCallback} cb
   */
  drop: dCap(function drop (tableName, cb) {
    if (!tableName) {
      cb('Table name is not specified', null)
      return
    }

    if (!cb) {
      cb('Where clause is not defined', null)
      return
    }

    var preparedQuery = 'DROP TABLE ' + tableName
    executeSql(preparedQuery, [], cb)
  }),

  /**
   * @param {string} tableName
   * @param {requestCallback} cb
   */
  dropBlobTable: dCap(function dropBlobTable (tableName, cb) {
    if (!tableName) {
      cb('Table name is not specified', null)
      return
    }

    if (!cb) {
      cb('Where clause is not defined', null)
      return
    }

    var preparedQuery = 'DROP BLOB TABLE ' + tableName
    executeSql(preparedQuery, [], cb)
  }),

  /*
   * @param {string} sql statement
   * @param {array} args (optional)
   * @param {requestCallback} cb
  */
  execute: dCap(function execute (sql, args, cb) {
    if (typeof args === 'function') {
      cb = args
      args = []
    }

    executeSql(sql, args, cb)
  }),

  executeBulk: dCap(function executeBulk (sql, bulkArgs, cb) {
    if (typeof args === 'function') {
      cb = bulkArgs
      bulkArgs = []
    }

    executeBulkSql(sql, bulkArgs, cb)
  }),

  insertBlob: dCap(insertBlob),

  /**
   * @param {string} tableName
   * @param {string} filename
   * @param {requestCallback} cb
   */
  insertBlobFile: dCap(function insertBlobFile (tableName, filename, cb) {
    fs.readFile(filename, function (err, data) {
      if (err) {
        return cb(err)
      }
      insertBlob(tableName, data, cb)
    })
  }),

  /**
   * @param {string} tableName
   * @param {string} hashKey
   * @param {requestCallback} cb
   */
  getBlob: dCap(function getBlob (tableName, hashKey, cb) {
    var callback = function (response) {
      var buffer = []
      response.on('data', function (chunk) {
        buffer.push(chunk)
      })

      response.on('end', function () {
        cb(null, Buffer.concat(buffer))
      })
    }
    var reqUrl = connectionPool.getBlobUrl() + tableName + '/' + hashKey
    http.get(reqUrl, callback)
  }),

  /**
   * @param {object} schema like: {person: {name: 'string', age: 'integer'}}
   */
  create: dCap(function create (schema, cbf) {
    var tableName = Object.keys(schema)[0]
    var table = schema[tableName]
    var cols = Object.keys(table).map(function (key) {
      return key + ' ' + table[key]
    })
    var statement = 'CREATE TABLE ' + tableName + ' (' + cols + ')'
    executeSql(statement, [], cbf)
  }),

  /**
   * @param {tableName} Name of the BLOB Table
   * @param {replicas} Number of replicas
   * @param {shards} Number of shards
   */
  createBlobTable: dCap(function createBlobTable (tableName, replicas, shards, cbf) {
    var statement = 'CREATE BLOB TABLE ' + tableName + ' clustered into ' + shards + ' shards with (number_of_replicas=' + replicas + ')'
    executeSql(statement, [], cbf)
  })
}
