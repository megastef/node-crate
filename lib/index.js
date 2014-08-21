"use strict";
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
var connectionPool = require('./connection-pool.js'),
    crateTypes = require("./types"),
    Type = require('type-of-is'),
    http = require('http'),
    dCap = require("d.js").nodeCapsule,
    // to build hashkeys for blobs
    crypto = require('crypto'),
    fs = require('fs'),
    qMarks = '?';

function getValueByType(v) {
    if (Type.is(v, Date)) {
        return v.getTime();
    }
    return v;
}

/**
 * @param {string[]} options
 * @returns values
 * @returns values.keys
 * @returns values.values
 * @returns values.args
 */
function prepareOptions(options) {
    var values = {},
        keys = Object.keys(options);
    values.keys = keys.map(function (i) {
        return '"' + i + '"';
    });
    values.values = keys.map(function () {
        return qMarks;
    });
    values.args = keys.map(function (i) {
        return getValueByType(options[i]);
    });
    return values;
}

/**
 * @param {string[]} options
 * @returns values
 * @returns values.keys
 */
function prepareOptionsInsert(options) {
    var values = {},
        keys = Object.keys(options);
    values = keys.map(function (i) {
        return i + ' = \'' + getValueByType(options[i]) + '\'';
    });
    return values;
}



/**
 * @param {string} sql
 * @param {string[]} args
 * @param {requestCallback} cb
 */
function executeSql(sql, args, cb) {
    var callback = function (response) {
            var data = [];

            response.on('data', function (chunk) {
                data.push(chunk);
            });

            response.on('end', function () {
                var result = {};
                try {
                    result = JSON.parse(data.join("."));
                } catch (ex) {
                    cb(ex, null, null);
                    return;
                }
                if (!result.rows) { /* || /CREATE BLOB/im.test (sql)) */
                    // workaround CRATE does not return a row when it creates a BLOB
                    result.rows = [];
                }
                if (result.error) {
                    cb(result.error, null, null);
                    return;
                }
                result.json = result.rows.map(function (e) {
                    var x = {},
                        i;
                    for (i = 0; i < result.cols.length; i += 1) {
                        if (result.col_types && result.col_types[i] === crateTypes.TIMESTAMP) {
                            x[result.cols[i]] = new Date(e[i]);
                        } else {
                            x[result.cols[i]] = e[i];
                        }
                    }
                    return x;
                });
                cb(null, result);
            });

        },
        req = connectionPool.getSqlRequest(callback),
        command = JSON.stringify({
            stmt: sql,
            args: args
        });
    req.write(command);
    req.end();
}

/**
 * @param {string} tableName
 * @param {string} buffer
 * @param {requestCallback} cb
 */
function insertBlob(tableName, buffer, cb) {

    var hashCode = crypto.createHash('sha1').update(buffer, 'binary').digest('hex'),
        options = connectionPool.getHttpOptions(),
        blobOptions = {
            host: options.host,
            path: '/_blobs/' + tableName + '/' + hashCode,
            port: options.port,
            method: 'PUT',
            body: buffer
        },
        callback = function (response) {

            response.on('data', function () {
                return undefined;
            });

            response.on('end', function () {

                if (response.statusCode === 409) {
                    cb('error 409: already exists', hashCode);
                    return;
                }

                cb(null, hashCode);
            });
        },
        req = http.request(blobOptions, callback);
    req.write(buffer);
    req.end();
}

module.exports = {

    types: crateTypes,

    connect: function connect(host, port) {
        if (port && port >= 0) {
            connectionPool.connect('http://' + host + ':' + port);
        } else {
            connectionPool.connect(host);
        }
    },

    /**
     * @param {string} tableName
     * @param {string[]} options
     * @param {requestCallback} cb
     */
    insert: dCap(function insert(tableName, options, cb) {

        if (arguments.length < 3) {
            console.log('missed arguments!');
            return;
        }

        if (!tableName) {
            cb('Table name is not specified', null);
            return;
        }

        if (!options) {
            cb('Record entry is not defined', null);
            return;
        }

        var preparedOptions = prepareOptions(options),
            preparedQuery = 'INSERT INTO ' + tableName + ' ' + '(' + preparedOptions.keys + ')' + ' VALUES (' + preparedOptions.values + ')';
        executeSql(preparedQuery, preparedOptions.args, cb);
    }),

    /**
     * @param {string} tableName
     * @param {string[]} options
     * @param {string} whereClaus
     * @param {requestCallback} cb
     */
    update: dCap(function update(tableName, options, whereClause, cb) {

        if (arguments.length < 3) {
            console.log('missed arguments!');
            return;
        }

        if (!tableName) {
            cb('Table name is not specified', null);
            return;
        }

        if (!options) {
            cb('Record entry is not defined', null);
            return;
        }

        if (!whereClause) {
            cb('Where clause is not defined', null);
            return;
        }

        var preparedOptions = prepareOptionsInsert(options),
            preparedQuery = 'UPDATE ' + tableName + ' SET ' + preparedOptions + ' WHERE ' + whereClause;

        executeSql(preparedQuery, preparedOptions.args, cb);
    }),

    /**
     * @param {string} tableName
     * @param {string} whereClause
     * @param {requestCallback} cb
     */
    delete: dCap(function $delete(tableName, whereClause, cb) {

        if (arguments.length < 3) {
            console.log('missed arguments!');
            return;
        }

        if (!tableName) {
            cb('Table name is not specified', null);
            return;
        }

        if (!whereClause) {
            cb('Where clause is not defined', null);
            return;
        }

        var preparedQuery = 'DELETE FROM ' + tableName + ' WHERE ' + whereClause;

        executeSql(preparedQuery, [], cb);
    }),

    /**
     * @param {string} tableName
     * @param {requestCallback} cb
     */
    drop: dCap(function drop(tableName, cb) {

        if (!tableName) {
            cb('Table name is not specified', null);
            return;
        }

        if (!cb) {
            cb('Where clause is not defined', null);
            return;
        }

        var preparedQuery = 'DROP TABLE ' + tableName;
        executeSql(preparedQuery, [], cb);
    }),

    /**
     * @param {string} tableName
     * @param {requestCallback} cb
     */
    dropBlobTable: dCap(function dropBlobTable(tableName, cb) {

        if (!tableName) {
            cb('Table name is not specified', null);
            return;
        }

        if (!cb) {
            cb('Where clause is not defined', null);
            return;
        }

        var preparedQuery = 'DROP BLOB TABLE ' + tableName;
        executeSql(preparedQuery, [], cb);
    }),

    /*
     * @param {string} sql statement
     * @param {array} args (optional)
     * @param {requestCallback} cb
    */
    execute: dCap(function execute(sql, args, cb) {

        if (typeof args === "function") {
            cb = args;
            args = [];
        }

        executeSql(sql, args, cb);
    }),


    insertBlob: dCap(insertBlob),

    /**
     * @param {string} tableName
     * @param {string} filename
     * @param {requestCallback} cb
     */
    insertBlobFile: dCap(function insertBlobFile(tableName, filename, cb) {
        fs.readFile(filename, function (err, data) {
            if (err) {
                throw err;
            }
            insertBlob(tableName, data, cb);
        });
    }),

    /**
     * @param {string} tableName
     * @param {string} hashKey
     * @param {requestCallback} cb
     */
    getBlob: dCap(function getBlob(tableName, hashKey, cb) {

        var callback = function (response) {
                var buffer = [];
                response.on('data', function (chunk) {
                    buffer.push(chunk);
                });

                response.on('end', function () {
                    cb(null, Buffer.concat(buffer));
                });
            },
            reqUrl = connectionPool.getBlobUrl() + tableName + '/' + hashKey;
        http.get(reqUrl, callback);
    }),

    /**
     * @param {object} schema like: {person: {name: 'string', age: 'integer'}}
     */
    create: dCap(function create(schema, cbf) {
        var cols = [],
            tableName = Object.keys(schema)[0],
            table = schema[tableName],
            key,
            statement;
        for (key in table) {
            if (table.hasOwnProperty(key)) {
                cols.push(key + ' ' + table[key]);
            }
        }
        statement = "CREATE TABLE " + tableName + " (" + cols + ")";
        executeSql(statement, [], cbf);
    }),

    /**
     * @param {tableName} Name of the BLOB Table
     * @param {replicas} Number of replicas
     * @param {shards} Number of shards
     */
    createBlobTable: dCap(function createBlobTable(tableName, replicas, shards, cbf) {
        var statement = "CREATE BLOB TABLE " + tableName + " clustered into " + shards + " shards with (number_of_replicas=" + replicas + ")";
        executeSql(statement, [], cbf);
    })
};