"use strict";

var Lab = require("lab"),
    lab = Lab,//Lab.script(),
    expect = Lab.expect,
    describe = lab.describe,
    it = lab.it,
    request = require("request"),
    https = require("https"),
    async = require("async"),
    change = require("change-case"),
    types = require("../lib/types"),
    fs = require("fs"),
    path = require("path"),
    gitTokenFile,
    githubPrivateAccessToken;

/*jslint nomen: true*/
gitTokenFile = path.resolve(__dirname, "../.gittoken");
/*jslint nomen: false*/

function trim(str) {
    return str.replace(/(?:(?:^|\n)\s+|\s+(?:$|\n))/g, '').replace(/\s+/g, ' ');
}

/*jslint stupid: true*/
if (fs.existsSync(gitTokenFile)) {
    githubPrivateAccessToken = new Buffer(trim(fs.readFileSync(gitTokenFile).toString()) + ":x-oauth-basic").toString("base64");
}
/*jslint stupid: false*/

if (!githubPrivateAccessToken) {
    console.warn("|  Warning: Git requests that are unauthorized are severely limited! (and we use them to indentify the tokens)");
    console.warn("|  Create a token here: https://github.com/settings/applications#personal-access-tokens");
    console.warn("|  Add the personal token to the '.gittoken' file like: '<token>';");
}

function typeFiles(typeFolderItem) {
    return typeFolderItem.type === "file"
        && /Type\.java$/.test(typeFolderItem.name)
        && !/DataType\.java$/.test(typeFolderItem.name)
        && !/CollectionType\.java$/.test(typeFolderItem.name);
}

function requestJson(url, callback) {
    var options = {
        headers: {
            'User-Agent': 'megastef/node-crate unit tests'
        }
    };
    if (githubPrivateAccessToken) {
        options.headers.Authorization = 'Basic ' + githubPrivateAccessToken;
    }
    /*jslint unparam: true*/
    request(url, options, function (error, response, body) {
        if (error) {
            throw new Error("Error while trying to access url '" + url + "': " + error);
        }
        var json = JSON.parse(body);
        if (json.message) {
            throw new Error("Error while fetching git data from url '" + url + "': " + json.message);
        }
        callback(json);
    });
    /*jslint unparam: false*/
}

function parseFileForId(reference, callback) {

    requestJson(reference.url.replace("https://api./", "https://api.github.com/"), function (data) {
        var content = new Buffer(data.content, data.encoding).toString('ascii'),
            ID = /public\s+(static\s+final|final\s+static)?\s+int\s+ID\s+\=\s+(\d+);/.exec(content);
        if (ID) {
            callback(null, {
                name: change.constantCase(/^(\w*)Type\.java$/.exec(reference.name)[1]),
                id: parseInt(ID[2], 10)
            });
        } else {
            callback(new Error("Don't know how to deal with " + reference.name));
        }
    });
}

function byId(entryA, entryB) {
    return (entryA.id > entryB.id) ? 1 : (entryA.id < entryB.id) ? -1 : 0;
}

describe("Typedefinitions", function () {
    it("should match the definitions on github!", function (done) {
        requestJson("https://api.github.com/repos/crate/crate/contents/core/src/main/java/io/crate/types", function (typeFolderList) {
            async.map(typeFolderList.filter(typeFiles), parseFileForId, function (error, results) {
                if (error) {
                    throw error;
                }
                var map = {};
                // Sorting to make sure that if an error occurs the map is properly sorted
                // (else the error is hard to understand)
                results.sort(byId).forEach(function (entry) {
                    map[entry.name] = entry.id;
                });
                expect(map).to.deep.eql(types);
                done();
            });
        });
    });
});

exports.lab = lab;