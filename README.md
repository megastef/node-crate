node-crate
==========

[![NPM](https://nodei.co/npm/node-crate.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/node-crate/)


[![Known Vulnerabilities](https://snyk.io/test/github/megastef/node-crate/badge.svg)](https://snyk.io/test/github/megastef/node-crate)
&nbsp;[![Standard - JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)
&nbsp;[![Build Status](https://travis-ci.org/megastef/node-crate.svg?branch=master)](https://travis-ci.org/megastef/node-crate.svg?branch=master)
&nbsp;[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/megastef/node-crate?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

This is an independent node.js driver implementation for CRATE using the _sql endpoint REST API.

[Crate Data](http://crate.io) "Easy to scale real time SQL data store"

Please note: Crate is a trademark of Crate Technology Gmbh, registered in the E.U. and in other countries.


## Features:
1. Async Interface
2. Conversion from rows to array of JSON entities
3. Automatic build of SQL statements from JSON or full control with SQL String with placeholders and arguments
4. Support for BLOB objects (e.g. for image uploads) with inbuilt key generation

## Known limitation
Nested JSON objects are currently not supported to generate SQL statements (e.g. for insert/update).
We might change this soon.

## Breaking changes in version 2 / Migration

Node-crate now using ES6 features and is not compatible anymore with node.js version lower than 6.0.0.

Package is using native promises, instead of promises implementation by D.js package.

Node-crate version 1.x code:
```
crate.execute("select ...", {}).success(console.log).error(console.error);
```

Should be updated to node-crate version 2.x:
```
crate.execute("select ...", {}).then((res) => {...})).catch((err) => {...}))
```


## Installation

```
npm install node-crate
```

## Test
When a crate instance is running on http://localhost:4200 you can use [lab](https://github.com/spumko/lab) based test (test/test.js).
Test actions: create table, insert, select, update, delete and drop table.

```
npm test
```

## Usage

```js
var crate = require('node-crate');
crate.connect('localhost', 4200);
// or crate.connect ('http://localhost:4200')
// to use multiple nodes in round robin crate.connect ('http://host1:4200 http://host2:4200')
// to use https crate.connect ('https://host1:4200 https://host2:4200')
crate.execute("select * from tweets where text like ? and retweed=? limit 1", ['Frohe Ostern%', true]).then((res) => {
	// res.json is an array with JSON object, with column names as properties, TIMESTAMP is converted to Date for crate V0.38+
	// res.cols are column names
	// res.rows values as array of arrays
	// res.duration execution time of query
	// res.rowcount number of rows
	// res.col_types type of column, e.g. res.col_types[i] == crate.type.TIMESTAMP
	console.log('Success', res.json, res.duration, res.rowcount, res.cols, res.rows)
})

```
### execute (sql, args)
```js
crate.execute("select * from tweets where text like ?", ['%crate%']).then((res) => console.log(res))).catch((err) => console.log(err))
```
### insert (tableName, jsonEntity)
```js
crate.insert('mytable', {columnName1: 'value1', columnName2: 'value2'}).then((res) => {})
```

### create (tableName, where)
```js
var scheme = {book: {id: 'integer primary key', title: 'string', author: 'string'}}
crate.create(scheme).then(() => {})
```

### drop (tableName)
```js
crate.drop('mytable').then(() => {})
```


### update (tableName, jsonEntity, whereClause)
```js
crate.update('mytable', {columnName1: 'value1', columnName2: 'value2'}, 'columnName3=5').then(() => {})
```


### delete (tableName, where)
```js
crate.delete('mytable', "columnName1='value1'").then(() => {})
```

## BLOB's


### createBlob (tableName, replicas, shards)
```
crate.createBlobTable('images',1,3).then((res) => {}).catch((e) => {})
```
### insertBlob (tableName, buffer)
```js
crate.insertBlob('images', buffer).then((res) => {});
```
### insertBlobFile (tableName, fileName)
The callback returns the required haskey to get the image with getBlob.

```js
crate.insertBlobFile ('images', './test.png').then((hashKey) => {
    console.log ("Assigned hashkey": hashKey)
})
```
### getBlob (tableName, hashKey)
The callback return a buffer as result - callback (buffer)
```js
crate.getBlob ('f683e0c9abcbf518704af66c6195bfd3ff121f09').then((data) => {
  	fs.writeFileSync ('test.gif', data)
});
```

# Connect to different instances or clusters

Example connect to localhost and to a crate hosted in a cloud enviroment with authentication

```js

const crateLocal = require('node-crate');
const crateCloud = crateLocal.getNewInstance();

crateLocal.connect('http://localhost:4200');
crateCloud.connect('https://user:password@cratecloud.com:4200');

```


# Use in Webbrowsers JavaScript

The intention was to use it with node.js on the server side, but it is possible to make it available in a web browser using [browserify](https://github.com/substack/node-browserify).
```
npm run bundle
```

The resulting automatically generated using drone.io. You can refer to this file:

```
<script src="https://drone.io/github.com/megastef/node-crate/files/bundle.js"></script>
```

Then you might be able to use it inside of an CRATE-Plug-In HTML page:

```
<script src="bundle.js"></script>
<script>
  var crate = require('node-crate');
  crate.execute ('select * from tweets limit 10').then(window.alert)
</script>
```

## License

The MIT License(MIT)
Copyright(C) 2014 by Stefan Thies, Igor Likhomanov

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files(the "Software"), to deal
in the Software without restriction, including without limitation the rights
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
