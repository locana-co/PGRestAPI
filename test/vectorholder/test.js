var tilelive = require('tilelive');
var url = require('url');
var zlib = require('zlib');
var assert = require('assert');
var Vector = require('..');
var path = require('path');
var fs = require('fs');
var imageEqualsFile = require('./image.js');
var Testsource = require('./testsource');

// Tilelive test source.
tilelive.protocols['test:'] = Testsource;

var xml = {
    a: fs.readFileSync(path.resolve(__dirname + '/fixtures/a.xml'), 'utf8'),
    b: fs.readFileSync(path.resolve(__dirname + '/fixtures/b.xml'), 'utf8'),
    c: fs.readFileSync(path.resolve(__dirname + '/fixtures/c.xml'), 'utf8')
};

describe('init', function() {
    it('should fail without backend', function(done) {
        new Vector({ xml: xml.c }, function(err) {
            assert.equal(err.message, 'No backend');
            done();
        });
    });
    it('should fail without xml', function(done) {
        new Vector({ backend: new Testsource() }, function(err) {
            assert.equal(err.message, 'No xml');
            done();
        });
    });
    it('should load with callback', function(done) {
        new Vector({ backend: new Testsource(), xml: xml.a }, function(err, source) {
            assert.ifError(err);
            assert.ok(source);
            done();
        });
    });
    it('#open should call all listeners', function(done) {
        var v = new Vector({ backend: new Testsource(), xml: xml.a });
        var remaining = 3;
        for (var i = 0; i < remaining; i++) v.open(function(err, source) {
            assert.ifError(err);
            assert.ok(source);
            if (!--remaining) done();
        });
    });
    it('should get info', function(done) {
        new Vector({ backend: new Testsource(), xml: xml.a }, function(err, source) {
            assert.ifError(err);
            assert.ok(source);
            source.getInfo(function(err, info) {
                assert.ifError(err);
                assert.equal('test-a', info.name);
                assert.equal(0, info.minzoom);
                assert.equal(8, info.maxzoom);
                assert.deepEqual([0,0,2], info.center);
                assert.deepEqual([-180,-85.0511,180,85.0511], info.bounds);
                assert.deepEqual({"level2":"property"}, info.level1, 'JSON key stores deep attribute data');
                assert.deepEqual(1, info.scale, 'JSON key does not overwrite other params');
                done();
            });
        });
    });
    it('should update xml, backend', function(done) {
        new Vector({xml:xml.a}, function(err, source) {
            assert.ifError(err);
            source.getInfo(function(err, info) {
                assert.ifError(err);
                assert.equal('test-a', info.name);
                source.update({xml:xml.b}, function(err) {
                    assert.ifError(err);
                    source.getInfo(function(err, info) {
                        assert.ifError(err);
                        assert.equal('test-b', info.name);
                        done();
                    });
                });
            });
        });
    });
    it('should use fallback backend', function(done) {
        new Vector({ source:'test:///a', xml: xml.c }, function(err, source) {
            assert.ifError(err);
            assert.ok(source);
            done();
        });
    });
});

describe('tiles', function() {
    var sources = {
        a: new Vector({ backend: new Testsource('a'), xml: xml.a }),
        'a@vt': new Vector({ backend: new Vector.Backend('test:///a'), xml: xml.a }),
        b: new Vector({ backend: new Testsource('b'), xml: xml.b }),
        'b@2x': new Vector({ backend: new Testsource('b'), xml: xml.b }),
        c: new Vector({ backend: new Testsource('b'), xml: xml.b, scale:2 }),
        d: new Vector({ backend: new Testsource('a'), xml: xml.a }),
        e: new Vector({ backend: new Testsource('a'), xml: xml.a, format:'png8:c=2' }),
        f: new Vector({ backend: new Testsource('a'), xml: xml.a.replace('png8:m=h', 'png8:c=2') }),
        g: new Vector({ backend: new Testsource('a'), xml: xml.a.replace('"scale">1', '"scale">2') })
    };
    var tests = {
        // 2.0.0, 2.0.1 test overzooming.
        // 1.1.2, 1.1.3 test that solid bg tiles are generated even when no
        // backend tile exists.
        a: ['0.0.0', '1.0.0', '1.0.1', '1.1.0', '1.1.1', '1.1.2', '1.1.3', '2.0.0', '2.0.1'],
        'a@vt': ['0.0.0', '1.0.0', '1.0.1', '1.1.0', '1.1.1', '1.1.2', '1.1.3', '2.0.0', '2.0.1'],
        // 2.1.1 should use z2 vector tile -- a coastline shapefile
        // 2.1.2 should use maskLevel -- place dots, like the others
        b: ['0.0.0', '1.0.0', '1.0.1', '1.1.0', '1.1.1', '2.1.1', '2.1.2'],
        // test scale factor. unlike previous test, 3.2.2/3.2.3 will be coast
        // and 3.2.4 should fallback to the maskLevel
        c: ['0.0.0', '1.0.0', '1.0.1', '1.1.0', '1.1.1', '2.1.1', '2.1.2', '3.2.2', '3.2.3', '3.2.4'],
        // should match results for 'c' which has a 2x factor map object.
        'b@2x': ['0.0.0', '1.0.0', '1.0.1', '1.1.0', '1.1.1', '2.1.1', '2.1.2', '3.2.2', '3.2.3', '3.2.4'],
        // Checks for ETag stability.
        d: ['0.0.0', '1.0.0', '1.0.1', '1.1.0'],
        // Checks that explicit format in source URI overrides map parameters.
        e: ['0.0.0'],
        // Checks that format in map parameters beats default code fallback.
        f: ['0.0.0'],
        // Checks that scale in map parameters beats default code fallback.
        g: ['0.0.0']
    };
    var formats = {
        json: { ctype: 'application/json' },
        jpeg: { ctype: 'image/jpeg' },
        png: { ctype: 'image/png' },
        svg: { ctype: 'image/svg+xml' },
        utf: { ctype: 'application/json' }
    };
    var etags = {};
    Object.keys(tests).forEach(function(source) {
        before(function(done) { sources[source].open(done); });
    });
    Object.keys(tests).forEach(function(source) {
        tests[source].forEach(function(key) {
            var z = key.split('.')[0] | 0;
            var x = key.split('.')[1] | 0;
            var y = key.split('.')[2] | 0;
            var remaining = 2;
            it('should render ' + source + ' (' + key + ')', function(done) {
                var cbTile = function(err, buffer, headers) {
                    assert.ifError(err);
                    // No backend tiles last modified defaults to Date 0.
                    // Otherwise, Last-Modified from backend should be passed.
                    if (['1.1.2','1.1.3'].indexOf(key) >= 0) {
                        assert.equal(headers['Last-Modified'], new Date(0).toUTCString());
                    } else {
                        assert.equal(headers['Last-Modified'], Testsource.now.toUTCString());
                    }
                    // Check for presence of ETag and store away for later
                    // ETag comparison.
                    assert.ok('ETag' in headers);
                    etags[source] = etags[source] || {};
                    etags[source][key] = headers['ETag'];
                    // Content-Type.
                    assert.equal(headers['Content-Type'], 'image/png');
                    // Load/draw stats attached to buffer.
                    assert.equal('number', typeof buffer._loadtime);
                    assert.equal('number', typeof buffer._drawtime);
                    // fs.writeFileSync(__dirname + '/expected/' + source + '.' + key + '.png', buffer);
                    imageEqualsFile(buffer, __dirname + '/expected/' + source + '.' + key + '.png', function(err) {
                        assert.ifError(err);
                        if (!--remaining) done();
                    });
                };
                var cbHead = function(err, headers) {
                    assert.ifError(err);
                    // No backend tiles last modified defaults to Date 0.
                    // Otherwise, Last-Modified from backend should be passed.
                    if (['1.1.2','1.1.3'].indexOf(key) >= 0) {
                        assert.equal(headers['Last-Modified'], new Date(0).toUTCString());
                    } else {
                        assert.equal(headers['Last-Modified'], Testsource.now.toUTCString());
                    }
                    // Content-Type.
                    assert.equal(undefined, headers['Content-Type']);
                    if (!--remaining) done();
                };
                if (/\@2x/.test(source)) {
                    cbTile.scale = 2;
                    cbHead.scale = 2;
                }
                sources[source].getTile(z,x,y, cbTile);
                sources[source].getHeaders(z,x,y, cbHead);
            });
        });
    });
    Object.keys(formats).forEach(function(format) {
        it('format a (0.0.0) as ' + format, function(done) {
            var source = 'a';
            var key = '0.0.0';
            var filepath = __dirname + '/expected/' + source + '.' + key + '.' + format;
            var cbTile = function(err, buffer, headers) {
                assert.ifError(err);
                assert.equal(headers['Content-Type'], formats[format].ctype);
                if (format === 'utf' || format === 'json') {
                    assert.deepEqual(buffer, JSON.parse(fs.readFileSync(filepath, 'utf8')));
                    done();
                    // fs.writeFileSync(filepath, JSON.stringify(buffer, null, 2));
                    // done();
                } else if (format === 'svg') {
                    assert.equal(buffer.length, fs.readFileSync(filepath).length);
                    done();
                } else {
                    imageEqualsFile(buffer, filepath, function(err) {
                        assert.ifError(err);
                        done();
                    });
                    // fs.writeFileSync(filepath, buffer);
                    // done();
                }
            };
            cbTile.format = format;
            if (format == 'png') cbTile.format = 'png8:m=h';
            sources[source].getTile(0,0,0, cbTile);
        });
    });
    it('errors out on bad deflate', function(done) {
        sources.a.getTile(1, 0, 2, function(err) {
            assert.equal('Z_DATA_ERROR', err.code);
            done();
        });
    });
    it('errors out on bad protobuf', function(done) {
        sources.a.getTile(1, 0, 3, function(err) {
            assert.equal('could not parse buffer as protobuf', err.message);
            done();
        });
    });
    it('same backend/xml => same ETags', function(done) {
        tests.a.slice(0,4).forEach(function(key) {
            assert.equal(etags.a[key], etags.d[key]);
        });
        done();    });
    it('diff blank tiles => diff ETags', function(done) {
        assert.notEqual(etags.a['1.1.2'], etags.a['1.1.3']);
        done();
    });
    it('diff backend => diff ETags', function(done) {
        tests.a.slice(0,4).forEach(function(key) {
            assert.notEqual(etags.a[key], etags.b[key]);
        });
        done();
    });
    it('diff scale => diff ETags', function(done) {
        tests.a.slice(0,4).forEach(function(key) {
            assert.notEqual(etags.b[key], etags.c[key]);
        });
        done();
    });
});

