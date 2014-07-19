node-crate
==========

 
[![Dependency Status](https://gemnasium.com/megastef/node-crate.png)](https://gemnasium.com/megastef/node-crate)
&nbsp;[![Build Status](https://drone.io/github.com/megastef/node-crate/status.png)](https://drone.io/github.com/megastef/node-crate/latest)

[Crate Data](http://crate.io) "Crate Data is an open source massively scalable data store.
It requires zero administration." 


## Features: 
1. Async Interface
2. Conversion from rows to array of JSON entities
3. Automatic build of SQL statements from JSON or full control with SQL String with placeholders and arguments 
4. Support for BLOB objects (e.g. for image uploads) with inbuilt key generation

## Known limitation
Nested JSON objects are currently not supported to generate SQL statements (e.g. for insert/update).
We might change this soon. 

## Installation

```
npm install node-crate
```

## Test
When a crate instance is running on http://localhost:4200 you can use mocha based test (test/test.js).
Test actions: create table, insert, select, update, delete and drop table.  

```
npm test 
```

## Usage

```js
var crate = require('node-crate');
crate.connect ('localhost', 4200)
crate.execute ("select * from tweets where text like ? and retweed=? limit 1", ['Frohe Ostern%', true]).success (function (res){
	// res.json is an array with JSON object, with column names as properties, TIMESTAMP is converted to Date for crate V0.38+
	// res.cols are column names
	// res.rows values as array of arrays
	// res.duration execution time of query
	// res.rowcount number of rows
	// res.col_types type of column, e.g. res.col_types[i] == crate.type.TIMESTAMP
	console.log ('Success', res.json, res.duration, res.rowcount, res.cols, res.rows)
})

```
### execute (sql, args)
```js
crate.execute ("select * from tweets where text like ?", ['%crate%']).success (console.log).error(console.error) 
```
### insert (tableName, jsonEntity)
```js
crate.insert ('mytable', {columnName1: 'value1', columnName2: 'value2'}).success (console.log)
```

### create (tableName, where)
```js
var scheme = {book: {id: 'integer primary key', title: 'string', author: 'string'}}
crate.create (scheme).success (console.log)
```

### drop (tableName)
```js
crate.drop ('mytable').success (console.log)
```


### update (tableName, jsonEntity, whereClause)
```js
crate.update ('mytable', {columnName1: 'value1', columnName2: 'value2'}, 'columnName3=5').success (console.log)
```


### delete (tableName, where)
```js
crate.delete ('mytable', "columnName1='value1'").success (console.log)
```

## BLOB's


### createBlob (tableName, replicas, shards)
```
crate.createBlobTable ('images',1,3).success(console.log).error(console.log)
```
### insertBlob (tableName, buffer)
```js
crate.insertBlob ('images', buffer).success (console.log)
```
### insertBlobFile (tableName, fileName)
The callback returns the required haskey to get the image with getBlob.

```js
crate.insertBlobFile ('images', './test.png').success (function (hashKey) {
    console.log ("Assigned hashkey": hashKey)
})
```
### getBlob (tableName, hashKey)
The callback return a buffer as result - callback (buffer)
```js
crate.getBlob ('f683e0c9abcbf518704af66c6195bfd3ff121f09').success (function (data) {
  	fs.writeFileSync ('test.gif', data)
})
```

# Use in Webbrowsers JavaScript

The intention was to use it with node.js on the server side, but it is possible to make it available in a web browser using [browserify](https://github.com/substack/node-browserify). 
```
browserify -r ./node-crate.js:node-crate > bundle.js
```

The resulting bundle.js is included in this repository.but It might not be up-to-date - therefore it is included in the automatic build/test on drone.io you can refer to this file:

```
<script src="https://drone.io/github.com/megastef/node-crate/files/bundle.js"></script>
```

Then you might be able to use it inside of an CRATE-Plug-In HTML page: 

```
<script src="bundle.js"></script>
<script>
  var crate = require('node-crate');
  crate.execute ('select * from tweets limit 10').success (window.alert)
</script>
```

## Roadmap
1. We plan to support in future waterline.js as ORM on top of this base driver. 

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
