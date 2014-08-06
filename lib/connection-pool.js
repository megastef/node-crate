"use strict";

// Currently implemented round robin to the nodes - other startegies, like main node, fallback nodes
// needs to be implemented
var http = require('http'),
    https = require('https'),
    urlParser = require('url'),
    optionTemplate = {
        host: 'localhost',
        path: '/_sql?types',
        port: '4200',
        method: 'POST',
        headers: {
            'Connection': 'keep-alive'
        }
    },
    httpOptions = [],
    httpOptionsBlob = [],
    lastUsed = 0;

function getNextNodeOptions(type) {
    lastUsed += 1;
    if (lastUsed > httpOptions.length - 1) {
        lastUsed = 0;
    }
    if (type === 'blob') {
        return httpOptionsBlob[lastUsed];
    }
    return httpOptions[lastUsed];
}

function getRequest(nodeOptions, callback) {
    if (nodeOptions.protocol === 'https') {
        return https.request(nodeOptions.httpOpt, callback);
    }
    return http.request(nodeOptions.httpOpt, callback);
}


function parseStringOptions(opt) {
    var nodes = opt.split(' '),
        nodeInfos = nodes.map(function (node) {
            var urlFields = urlParser.parse(node);
            urlFields.protocol = urlFields.protocol.replace(':', '');
            return urlFields;
        });
    return nodeInfos;
}

// optionString e.g. "https://localhost:9200 http://myserver:4200"
exports.connect = function (optionString) {
    var options = parseStringOptions(optionString);
    options.forEach(function (e) {
        httpOptions.push({
            httpOpt: {
                host: e.hostname,
                port: e.port || 4200,
                path: '/_sql?types',
                method: 'POST',
                headers: {
                    'Connection': 'keep-alive'
                }
            },
            protocol: e.protocol
        });
        httpOptionsBlob.push(e.protocol + '://' + e.hostname + ':' + e.port + '/_blobs/');
    });
};

exports.getSqlRequest = function (callback) {
    var options = getNextNodeOptions('sql');
    return getRequest(options, callback);
};

exports.getBlobUrl = function () {
    return getNextNodeOptions('blob');
};

exports.getHttpOptions = function () {
    return getNextNodeOptions('sql').httpOpt;
};