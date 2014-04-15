node-crate
==========

Node.js base DB-Driver for CRATE (www.crate.io)

## Features: 
1. Async Interface
2. Conversion from rows to array of JSON entities
3. Automatic build of SQL statements from JSON or full control with SQL String with placeholders and arguments 
4. Support for BLOB objects (e.g. for image uploads) with inbuilt key generation

## Known limitation
Nested JSON objects are currently not supported to generate SQL statements (e.g. for insert/update).
We might change this soon. 
This driver was created during MountainHackathon2014 - I guess there is more testing required :) 

## Roadmap
1. We plan to support in future waterline.js as ORM on top of this base driver. 
2. Generate browser version (e.g. to build web based console with Angular.js)


## Installation
```
npm install megastef/node-crate
```

## Usage

```js
var crate = require('node-crate');
crate.connect('localhost', 4200);
function printResult (err, res1, res2) { 
  console.log (err)   //  error.message contains message from crate server
  console.log (res1)  // Array of JSON Onjects with properties named as table column
  console.log (res2)  // original result from _sql REST endpoint 
}
```
### execute (sql, args, cbf)
```js
crate.execute ("select * from tweetswhere text like ?", ['%crate%'], printResult) 
```
### insert (tableName, jsonEntity,  cbf)

```js
crate.insert ('mytable', {columnName1: 'value1', columnName2: 'value2'}, printResult)
```
### update (tableName, jsonEntity, whereClause, cbf)
```js


crate.update ('mytable', {columnName1: 'value1', columnName2: 'value2'}, 'columnName3=5', printResult)
```
### delete (tableName, where, cbf)
```js
crate.delete ('mytable', "columnName1='value1'", printResults)
```

## BLOB's
### insertBlob (tableName, buffer, cbf)
```js
crate.insertBlob ('images', buffer, printResult)
```
### insertBlobFile (tableName, fileName, cbf)
The callback returns the required haskey to get the image with getBlob.
Callback signature: - callback (error, hashKey)

```js
crate.insertBlobFile ('images', './test.png', function (err, hashKey) {
    console.log ("Assigned hashkey": hashKey)
})
```
### getBlob (tableName, hashKey, cbf)
The callback return a buffer as result - callback (error, buffer)
```js
crate.getBlob ('f683e0c9abcbf518704af66c6195bfd3ff121f09', function (err, data) {
  if (!err) fs.writeFileSync ('test.gif', data)
})
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
