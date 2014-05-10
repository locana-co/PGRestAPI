var tilelive = require('tilelive');
var assert = require('assert');
var imageEqualsFile = require('./image.js');
var Testsource = require('./testsource');
var xray = require('..').xray;
var fs = require('fs');

// Tilelive test source.
tilelive.protocols['test:'] = Testsource;

describe('xray', function() {
    it('invalid', function(done) {
        new xray({}, function(err) {
            assert.equal('Error: opts.uri or opts.source must be set', err.toString());
            done();
        });
    });
    it('invalid-novector', function(done) {
        new xray({uri:'test:///invalid-novector'}, function(err) {
            assert.equal('Error: source must contain a vector_layers property', err.toString());
            done();
        });
    });
    it('loads uri', function(done) {
        new xray({uri:'test:///a'}, function(err, source) {
            assert.ifError(err);
            assert.ok(!!source);
            source.getTile(0,0,0, function(err,buffer) {
                assert.ifError(err);
                // fs.writeFileSync(__dirname + '/expected/xray-a-0-0-0.png', buffer);
                imageEqualsFile(buffer, __dirname + '/expected/xray-a-0-0-0.png', function(err) {
                    assert.ifError(err);
                    done();
                });
            });
        });
    });
    it('loads source', function(done) {
        var source = new Testsource('a');
        new xray({
            source: source,
            minzoom: 0,
            maxzoom: 1,
            vector_layers: [{ id:'coastline' }]
        }, function(err, source) {
            assert.ifError(err);
            assert.ok(!!source);
            done();
        });
    });
    it('color', function() {
        var results = {
            '': [68,68,68],
            'a': [68,170,68],
            'ab': [68,170,85],
            'world': [136,221,102],
            'rivers and lakes': [170,153,85]
        };
        for (var key in results) {
            assert.deepEqual(xray.color(key), results[key]);
        }
    });
    it('xml', function() {
        var results = {
            'xray-single.xml': xray.xml({
                vector_layers: [
                    { "id": "coastline" }
                ]
            }),
            'xray-multi.xml': xray.xml({
                vector_layers: [
                    { "id": "coastline" },
                    { "id": "countries" },
                    { "id": "water" },
                    { "id": "landuse" }
                ]
            }),
            'xray-interactivity.xml': xray.xml({
                vector_layers: [
                    { "id": "water", "fields": { "NAME": "String" } }
                ],
                interactivity_layer: 'water',
                template: '<div>{{NAME}}</div>'
            })
        };
        for (var key in results) {
            // fs.writeFileSync(__dirname + '/expected/' + key, results[key]);
            assert.equal(fs.readFileSync(__dirname + '/expected/' + key), results[key]);
        }
    });
});
