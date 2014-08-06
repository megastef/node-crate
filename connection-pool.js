// some workarounds to make it work without major changes on node-crate
// TODO: handling of connection fails
// currently round robin to the nodes - other startegies, like main node, fallback nodes
// needs to be implemented

var http = require('http');
var https = require('https')
var urlParser = require('url')

var optionTemplate = {
    host: 'localhost',
    path: '/_sql?types',
    port: '4200',
    method: 'POST',
    headers: {
        'Connection': 'keep-alive'
    }
};
var _options = {https: false, nodes: ['localhost:4200'] };
var httpOptions = []
var httpOptionsBlob = []
var lastUsed = 0;

function getNextNodeOptions(type) {
    lastUsed++
    if (lastUsed > httpOptions.length - 1)
        lastUsed = 0;
    if (type == 'blob')
        return httpOptionsBlob[lastUsed];
    else
        return httpOptions [lastUsed];

}

function getRequest(nodeOptions, callback) {
    if (nodeOptions.protocol == 'https')
        return https.request(nodeOptions.httpOpt, callback)
    else
        return http.request(nodeOptions.httpOpt, callback)
}


function parseStringOptions(opt) {
    var nodes = opt.split(' ');
    var nodeInfos = nodes.map(function (node) {
        var urlFields = urlParser.parse(node)
        urlFields.protocol = urlFields.protocol.replace(':', '')
        return urlFields;
    })
    return nodeInfos;
}
// optionString e.g. "https://localhost:9200 http://myserver:4200"
exports.connect = function (optionString) {
    var options = parseStringOptions(optionString)

    options.forEach(function (e) {
        //console.log (e.hostname)
        //console.log (e.port)
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
        })
        httpOptionsBlob.push(e.protocol + '://' + e.hostname + ':' + e.port + '/_blobs/')
    })
}


exports.getSqlRequest = function (callback) {
    var options = getNextNodeOptions('sql')
    //console.log (options)
    return getRequest(options, callback);
}

exports.getBlobUrl = function (callback) {
    return options = getNextNodeOptions('blob')
    //return options.protocol + '://' +  options.httpOpt.hostname + ':'  + options.httpOpt.port
}

exports.getHttpOptions = function () {
    return getNextNodeOptions('sql').httpOpt;
}