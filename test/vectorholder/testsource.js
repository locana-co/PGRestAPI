var tilelive = require('tilelive');
var zlib = require('zlib');
var fs = require('fs');
var path = require('path');

module.exports = Testsource;

// Load fixture data.
var infos = {
    a: {
        minzoom:0,
        maxzoom:1,
        vector_layers: [
            {
                "id": "coastline",
                "description": "",
                "minzoom": 0,
                "maxzoom": 22,
                "fields": {
                    "FeatureCla": "String",
                    "Note": "String",
                    "ScaleRank": "Number"
                }
            }
        ]
    },
    b: {
        minzoom:0,
        maxzoom:2,
        maskLevel:1,
        vector_layers: [
            {
                "id": "coastline",
                "description": "",
                "minzoom": 0,
                "maxzoom": 22,
                "fields": {
                    "FeatureCla": "String",
                    "Note": "String",
                    "ScaleRank": "Number"
                }
            }
        ]
    },
    'invalid-novector': {
        minzoom:0,
        maxzoom:1
    }
};
var tiles = {
    a: fs.readdirSync(path.resolve(__dirname + '/fixtures/a')).reduce(function(memo, basename) {
        var key = basename.split('.').slice(0,3).join('.');
        memo[key] = fs.readFileSync(path.resolve(__dirname + '/fixtures/a/' + basename));
        return memo;
    }, {}),
    b: fs.readdirSync(path.resolve(__dirname + '/fixtures/b')).reduce(function(memo, basename) {
        var key = basename.split('.').slice(0,3).join('.');
        memo[key] = fs.readFileSync(path.resolve(__dirname + '/fixtures/b/' + basename));
        return memo;
    }, {})
};

// Additional error tile fixtures.
zlib.deflate(new Buffer('asdf'), function(err, deflated) {
    if (err) throw err;
    tiles.a['1.0.2'] = new Buffer('asdf'); // invalid deflate
    tiles.a['1.0.3'] = deflated;           // invalid protobuf
});
zlib.deflate(new Buffer(0), function(err, deflated) {
    if (err) throw err;
    tiles.a['0.0.1'] = deflated;
});

Testsource.now = new Date;

function Testsource(uri, callback) {
    if (uri && uri.pathname) uri = uri.pathname.slice(1);

    this.uri = uri;
    if (uri) this.data = {
        minzoom: infos[uri].minzoom,
        maxzoom: infos[uri].maxzoom,
        maskLevel: infos[uri].maskLevel,
        vector_layers: infos[uri].vector_layers
    };
    this.stats = {};
    return callback && callback(null, this);
};

Testsource.prototype.getTile = function(z,x,y,callback) {
    var key = [z,x,y].join('.');

    // Count number of times each key is requested for tests.
    this.stats[key] = this.stats[key] || 0;
    this.stats[key]++;

    // Headers.
    var headers = {
        'Last-Modified': Testsource.now.toUTCString(),
        'ETag':'73f12a518adef759138c142865287a18',
        'Content-Type':'application/x-protobuf'
    };

    if (!tiles[this.uri][key]) {
        return callback(new Error('Tile does not exist'));
    } else {
        return callback(null, tiles[this.uri][key], headers);
    }
};

Testsource.prototype.getInfo = function(callback) {
    return callback(null, this.data);
};

