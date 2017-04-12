'use strict'

// Currently implemented round robin to the nodes - other startegies, like main node, fallback nodes
// needs to be implemented
var http = require('http')
var https = require('https')
var urlParser = require('url')
/* var optionTemplate = {
    host: 'localhost',
    path: '/_sql?types',
    port: '4200',
    method: 'POST',
    headers: {
      'Connection': 'keep-alive'
    }
} */
var httpOptions = []
var httpOptionsBlob = []
var lastUsed = 0

// limit number of sockets
http.globalAgent.maxSockets = 10;
http.globalAgent.keepAlive = true;

function getNextNodeOptions (type) {
  lastUsed += 1
  if (lastUsed > httpOptions.length - 1) {
    lastUsed = 0
  }
  if (type === 'blob') {
    return httpOptionsBlob[lastUsed]
  }
  return httpOptions[lastUsed]
}

function getRequest (nodeOptions, callback) {
  if (nodeOptions.protocol === 'https') {
    return https.request(nodeOptions.httpOpt, callback)
  }
  return http.request(nodeOptions.httpOpt, callback)
}

function parseStringOptions (opt) {
  var nodes = opt.split(' ')
  var nodeInfos = nodes.map(function (node) {
    var urlFields = urlParser.parse(node)
    urlFields.protocol = urlFields.protocol.replace(':', '')
    return urlFields
  })
  return nodeInfos
}

module.exports = {
  // optionString e.g. "https://localhost:9200 http://myserver:4200"
  connect: function connect (optionString) {
    var options = parseStringOptions(optionString)
    options.forEach(function (e) {
      var option = {
        httpOpt: {
          host: e.hostname,
          port: e.port || 4200,
          auth: e.auth || null,
          path: '/_sql?types',
          method: 'POST',
          headers: {
            'Connection': 'keep-alive'
          }
        },
        protocol: e.protocol
      };
     console.log("Crate Option: ", option);
      httpOptions.push(option)
      httpOptionsBlob.push(e.protocol + '://' + e.hostname + ':' + e.port + '/_blobs/')
    })
  },
  getSqlRequest: function getSqlRequest (callback) {
    var options = getNextNodeOptions('sql')
    return getRequest(options, callback)
  },
  getBlobUrl: function getBlobUrl () {
    return getNextNodeOptions('blob')
  },
  getHttpOptions: function getHttpOptions () {
    return getNextNodeOptions('sql').httpOpt
  }
}
