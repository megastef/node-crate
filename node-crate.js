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



/* CRATE TYPES
Id's of all currently available data types:
According to https://github.com/crate/crate/blob/9796dbc9104f47a97f7cc8d92e1fa98ae84e93a0/docs/sql/rest.txt#L77

===== ===================
    Id Data Type
===== ===================
    0 Null
----- -------------------
    1 Not Supported
----- -------------------
    2 Byte
----- -------------------
    3 Boolean
----- -------------------
    4 String
----- -------------------
    5 Ip
----- -------------------
    6 Double
----- -------------------
    7 Float
----- -------------------
    8 Short
----- -------------------
    9 Integer
----- -------------------
    10 Long
----- -------------------
    11 Timestamp
----- -------------------
    12 Object
----- -------------------
    13 GeoPoint (Double[])
----- -------------------
    100 Array
----- -------------------
    101 Set
===== ===================
*/

var crateTypes = {
    NULL:           0,
    NOT_SUPPORTED:  1,
    BYTE:           2,
    BOOLEAN:        3,
    STRING:         4,
    IP:             5,
    DOUBLE:         6,
    FLOAT:          7,
    SHORT:          8,
    INTEGER:        9,
    LONG:           10,
    TIMESTAMP:      11,
    OBJECT:         12,
    GEO_POINT:      13,
    ARRAY:          100,
    SET:            101
}
exports.types =  crateTypes;
var Type = require('type-of-is');
var http = require('http');
var D = require('d.js')
// to build hashkeys for blobs
var crypto = require('crypto');
var fs = require('fs');

var options = {
    host: 'localhost',
    path: '/_sql?types',
    port: '4200',
    method: 'POST',
    headers: {
        'Connection': 'keep-alive'
    }
};

var qMarks = '?';


exports.connect = function(host, port) {
	options.host = host;
	options.port = port;
}

/**
 * @param {string} sql
 * @param {string[]} args
 * @param {requestCallback} cb
 */
function executeSql (sql, args, cb) {
	callback = function(response) {

		var str = ''

		response.on('data', function(chunk) {
			str += chunk;
		});

		response.on('end', function() {
			var result = {};
			try {
				result = JSON.parse(str);
			} catch (ex) {
				console.log('error:' + sql)
				if (cb) cb(ex, null, null);
				return;
			}
			if (!result.rows) // || /CREATE BLOB/im.test (sql))
			{
				// workaround CRATE does not return a row when it creates a BLOB
				result.rows=[];
			}

			var jsons = result.rows.map(function(e) {
				var x = {};
				for (var i = 0; i < result.cols.length; i++)
                {
                    if (result.col_types && result.col_types[i] === crateTypes.TIMESTAMP)
                    {
                        x[result.cols[i]] = new Date (e[i]);
                    }  else {
                        x[result.cols[i]] = e[i];
                    }
				}
				return x;
			});
            result.json = jsons;
			cb(null, result);
		});

	}

	var req = http.request(options, callback);

	req.write(JSON.stringify({
		stmt: sql,
		args: args
	}));

	req.end();

}

/**
 * @param {string} tableName
 * @param {string[]} options
 * @param {requestCallback} cb
 */
exports.insert = function(tableName, options, cb) {


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

	var preparedOptions = prepareOptions(options);
	var preparedQuery = 'INSERT INTO ' + tableName + ' ' + '(' + preparedOptions.keys + ')' + ' VALUES (' + preparedOptions.values + ')';
	executeSql(preparedQuery, preparedOptions.args, cb);
}

/**
 * @param {string} tableName
 * @param {string[]} options
 * @param {string} whereClaus
 * @param {requestCallback} cb
 */
exports.update = function(tableName, options, whereClause, cb) {

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

	var preparedOptions = prepareOptionsInsert(options);

	var preparedQuery = 'UPDATE ' + tableName + ' SET ' + preparedOptions + ' WHERE ' + whereClause;

	executeSql(preparedQuery, preparedOptions.args, cb);
}

/**
 * @param {string} tableName
 * @param {string} whereClause
 * @param {requestCallback} cb
 */
exports.delete = function(tableName, whereClause, cb) {

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

	var preparedOptions = prepareOptionsInsert(options);

	var preparedQuery = 'DELETE FROM ' + tableName + ' WHERE ' + whereClause;

	executeSql(preparedQuery, [], cb);
}

/**
 * @param {string} tableName
 * @param {requestCallback} cb
 */
exports.drop = function(tableName, cb) {

	if (!tableName) {
		cb('Table name is not specified', null);
		return;
	}

	if (!cb) {
		cb('Where clause is not defined', null);
		return;
	}

	

	var preparedQuery = 'DROP TABLE '+tableName;

	executeSql(preparedQuery, [], cb);
}

/**
 * @param {string} tableName
 * @param {requestCallback} cb
 */
exports.dropBlobTable = function(tableName, cb) {

	if (!tableName) {
		cb('Table name is not specified', null);
		return;
	}

	if (!cb) {
		cb('Where clause is not defined', null);
		return;
	}

	

	var preparedQuery = 'DROP BLOB TABLE '+tableName;

	executeSql(preparedQuery, [], cb);
}

/*
    if 1 args pass - invalid args
    if 2 args pass - 1st: sql, 2: callbak
    if 3 args pass - 1st: sql, 2: args, 3: callback

*/
exports.execute = function(arg1, arg2, arg3) {

	if (arguments.length < 2) {
		return;
	} else if (arguments.length == 2) {
		executeSql(arg1, [], arg2);
	} else if (arguments.length == 3) {
		executeSql(arg1, arg2, arg3);
	}
}

/**
 * @param {string} tableName
 * @param {string} buffer
 * @param {requestCallback} cb
 */
function insertBlob(tableName, buffer, cb) {

	
	var shasum = crypto.createHash('sha1');
	shasum.update(buffer, 'binary')
	var hashCode = shasum.digest('hex');

	var blobOptions = {
		host: options.host,
		path: '/_blobs/' + tableName + '/' + hashCode,
		port: options.port,
		method: 'PUT',
		body: buffer
	};

	callback = function(response) {

		var str = '';
		response.on('data', function(chunk) {
			str += chunk;
		});

		response.on('end', function() {

			if (response.statusCode == 409) {
				cb('error 409: already exists', hashCode);
				return;
			}

			cb(null, hashCode);
		});
	}

	var req = http.request(blobOptions, callback);
	req.write(buffer);
	req.end();
}

exports.insertBlob = insertBlob;

/**
 * @param {string} tableName
 * @param {string} filename
 * @param {requestCallback} cb
 */
exports.insertBlobFile = function(tableName, filename, cb) {
	

	fs.readFile(filename, function(err, data) {
		if (err) throw err;

		insertBlob('bob', data, cb);

	})
}

/**
 * @param {string} tableName
 * @param {string} hashKey
 * @param {requestCallback} cb
 */
exports.getBlob = function(tableName, hashKey, cb) {

	callback = function(response) {
		var buffer = [];
		response.on('data', function(chunk) {
			buffer.push(chunk);
		});

		response.on('end', function() {
			cb(null, Buffer.concat(buffer))
		});
	}

	var reqUrl = 'http://' + options.host + ':' + options.port + '/_blobs/' + tableName + '/' + hashKey;
	http.get(reqUrl, callback);

}

/**
 * @param {string[]} options
 * @returns values
 * @returns values.keys
 * @returns values.values
 * @returns values.args
 */
function prepareOptions(options) {
	var values = {};
	var keys = Object.keys(options);
	values.keys = keys.map(function(i) {
		return '"' + i + '"';
	});
	values.values = keys.map(function(i) {
		return qMarks;
	});
	values.args = keys.map(function(i) {
		return getValueByType (options[i]);
	});
	return values;
}

function getValueByType (v)
{
    if (Type.is (v, Date))
        return v.getTime()
    else return v;
}

/**
 * @param {string[]} options
 * @returns values
 * @returns values.keys
 */
function prepareOptionsInsert(options) {
	var values = {};
	var keys = Object.keys(options);
	values = keys.map(function(i) {
		return i + ' = \'' + getValueByType (options[i]) + '\'';
	});
	return values;
}

/**
 * @param {object} schema like: {person: {name: 'string', age: 'integer'}}
 */
exports.create = function (schema, cbf)
{
	var cols = []
	var tableName = Object.keys(schema)[0];
	for (key in schema[tableName])
	{
		cols.push (key + ' ' + schema[tableName][key])
	}
	var statement = "CREATE TABLE " + tableName +  " (" + cols + ")"
	executeSql (statement, [], cbf)
}

/**
 * @param {tableName} Name of the BLOB Table
 * @param {replicas} Number of replicas
 * @param {shards} Number of shards
 */
exports.createBlobTable = function (tableName, replicas, shards, cbf)
{
	
	var statement = "CREATE BLOB TABLE " + tableName +  " clustered into ? shards with (number_of_replicas=?)"
	executeSql (statement, [shards, replicas], cbf)
}
// adding promise .success ./ .error functions
exports.execute = D.nodeCapsule (exports.execute)
exports.insert = D.nodeCapsule (exports.insert)
exports.update = D.nodeCapsule (exports.update)
exports.delete = D.nodeCapsule (exports.delete)
exports.getBlob = D.nodeCapsule (exports.getBlob)
exports.insertBlobFile = D.nodeCapsule (exports.insertBlobFile)
exports.insertBlob = D.nodeCapsule (exports.insertBlob)
exports.create = D.nodeCapsule (exports.create)
exports.drop = D.nodeCapsule (exports.drop)
exports.createBlobTable = D.nodeCapsule (exports.createBlobTable)
exports.dropBlobTable = D.nodeCapsule (exports.dropBlobTable)





