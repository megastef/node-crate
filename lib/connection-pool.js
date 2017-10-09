'use strict'

// Currently implemented round robin to the nodes - other startegies, like main node, fallback nodes
// needs to be implemented
const http = require('http')
const https = require('https')
const urlParser = require('url')
/* var optionTemplate = {
    host: 'localhost',
    path: '/_sql?types',
    port: '4200',
    method: 'POST',
    headers: {
      'Connection': 'keep-alive'
    }
} */
let httpOptions = []
let httpOptionsBlob = []
let lastUsed = 0

// limit number of sockets
// http.globalAgent.maxSockets = 3
http.globalAgent.keepAlive = true

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
  const nodes = opt.split(' ')
  const nodeInfos = nodes.map((node) => {
    const urlFields = urlParser.parse(node)
    urlFields.protocol = urlFields.protocol.replace(':', '')
    return urlFields
  })
  return nodeInfos
}

module.exports = {
  // optionString e.g. "https://localhost:9200 http://myserver:4200"
  connect: (optionString) => {
    const options = parseStringOptions(optionString)

    options.forEach((e) => {
      httpOptions.push({
        httpOpt: {
          host: e.hostname,
          port: e.port || 4200,
          auth: e.auth || null,
          path: '/_sql?types',
          method: 'POST',
          headers: {
            'Connection': 'keep-alive',
            'Content-Type': 'application/json'
          }
        },
        protocol: e.protocol
      })

      httpOptionsBlob.push(`${e.protocol}://${e.hostname}:${e.port}/_blobs/`)
    })
  },
  getSqlRequest: (callback) => {
    const options = getNextNodeOptions('sql')
    return getRequest(options, callback)
  },
  getBlobUrl: () => {
    return getNextNodeOptions('blob')
  },
  getHttpOptions: () => {
    return getNextNodeOptions('sql').httpOpt
  }
}
