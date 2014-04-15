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

var http = require('http');

var options = {
	host: 'localhost',
	path: '_sql',
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

			var result = JSON.parse(str);

			if (result.error) {
				cb(result.error, null, null);
				return;
			}

			var jsons = result.rows.map(function(e) {
				var x = {};
				for (var i = 0; i < result.cols.length; i++) {
					x[result.cols[i]] = e[i];
				}

				return x;
			});

			cb(null, jsons, result);
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
exports.update = function(tableName, options, whereClaus, cb) {

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

	if (!whereClaus) {
		cb('Where claus is not defined', null);
		return;
	}

	var preparedOptions = prepareOptionsInsert(options);

	var preparedQuery = 'UPDATE ' + tableName + ' SET ' + preparedOptions + ' WHERE ' + whereClaus;
	console.log(preparedQuery);
	executeSql(preparedQuery, preparedOptions.args, cb);
}

/**
 * @param {string} tableName
 * @param {string} whereClaus
 * @param {requestCallback} cb
 */
exports.delete = function(tableName, whereClaus, cb) {

	if (arguments.length < 3) {
		console.log('missed arguments!');
		return;
	}

	if (!tableName) {
		cb('Table name is not specified', null);
		return;
	}

	if (!whereClaus) {
		cb('Where claus is not defined', null);
		return;
	}

	var preparedOptions = prepareOptionsInsert(options);

	var preparedQuery = 'DELETE FROM ' + tableName + ' WHERE ' + whereClaus;
	console.log(preparedQuery);
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

	var crypto = require('crypto');
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
	var fs = require('fs');

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
		return options[i];
	});
	return values;
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
		return i + ' = \'' + options[i] + '\'';
	});
	return values;
}
