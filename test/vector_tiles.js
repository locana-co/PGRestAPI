////////TESTING///////////

var assert = require('chai').assert;
var tables = require('../endpoints/tables');
var request = require("request");
var chai = require('chai');
chai.use(require('chai-things'));

//This is for the API level testing
var should = require('chai').should(),
  supertest = require('supertest'),
  api = supertest('http://localhost:3001');

//common and settings files
var common = require("../common"),
    settings = require('../settings/settings');

var gjv = require("geojson-validation");

var VectorTile = require("vector-tile").VectorTile;
var Protobuf = require("pbf");

describe('Vector Tiles', function () {

  //Currently, these tests are run against a local PostGres DB with a known table called agricultre_2014.
  //TODO: Create startup scripts that build DB and insert rows into tables to test this against.

  it('requests a dynamic .pbf tile from a PostGIS database', function (done) {
    api.get('/services/postgis/agriculture_2014/geom/vector-tiles/14/11967/6906.pbf')
      .expect(200)
      .expect('Content-Type', "application/x-protobuf")
      .end(function (err, res) {
        if (err) return done(err);
        console.log(res);
        var arrayBuffer = new Uint8Array(res.text);
        var buf = new Protobuf(arrayBuffer);
        //Pull apart the tile and verify it's legit.
        var vt = new VectorTile(buf);
        console.log(vt);
        done();
      });
  });

})



