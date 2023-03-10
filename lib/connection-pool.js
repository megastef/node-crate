'use strict'

// Currently implemented round robin to the nodes - other startegies, like main node, fallback nodes
// needs to be implemented
const http = require('http')
const https = require('https')
const {URL} = require('url')
/* var optionTemplate = {
    host: 'localhost',
    path: '/_sql?types',
    port: '4200',
    method: 'POST',
    headers: {
      'Connection': 'keep-alive'
    }
} */

// limit number of sockets
// http.globalAgent.maxSockets = 3
http.globalAgent.keepAlive = true

function getRequest (nodeOptions, callback) {
  if (nodeOptions.protocol === 'https') {
    return https.request(nodeOptions.httpOpt, callback)
  }
  return http.request(nodeOptions.httpOpt, callback)
}

function parseStringOptions (opt) {
  const nodes = opt.split(' ')
  const nodeInfos = nodes.map(node => {
    const url = new URL(node);
    const urlFields = {
      hostname: url.hostname,
      port: url.port,
      protocol: url.protocol.replace(':', ''),
      auth: url.username ? `${url.username}:${url.password}` : null
    }
    return urlFields
  })
  return nodeInfos
}

class ConnectionPool {
  constructor () {
    this.httpOptions = []
    this.httpOptionsBlob = []
    this.lastUsed = 0
  }

  // optionString e.g. "https://localhost:9200 http://myserver:4200"
  connect (optionString) {
    const options = parseStringOptions(optionString)

    options.forEach(e => {
      this.httpOptions.push({
        httpOpt: {
          host: e.hostname,
          port: e.port || 4200,
          auth: e.auth || null,
          path: '/_sql?types',
          method: 'POST',
          headers: {
            Connection: 'keep-alive',
            'Content-Type': 'application/json',
            Accept: 'application/json'
          }
        },
        protocol: e.protocol
      })

      this.httpOptionsBlob.push(`${e.protocol}://${e.hostname}:${e.port}/_blobs/`)
    })
  }

  getNextNodeOptions (type) {
    this.lastUsed += 1
    if (this.lastUsed > this.httpOptions.length - 1) {
      this.lastUsed = 0
    }

    if (type === 'blob') {
      return this.httpOptionsBlob[this.lastUsed]
    }

    return this.httpOptions[this.lastUsed]
  }

  getSqlRequest (callback) {
    const options = this.getNextNodeOptions('sql')
    return getRequest(options, callback)
  }

  getBlobUrl () {
    return this.getNextNodeOptions('blob')
  }

  getHttpOptions () {
    return this.getNextNodeOptions('sql').httpOpt
  }
}

module.exports = ConnectionPool
