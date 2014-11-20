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

var tableList = [];

describe('Tables', function () {

  //Currently, these tests are run against a local PostGres DB with a known table called agricultre_2014.
  //TODO: Create startup scripts that build DB and insert rows into tables to test this against.

  it('returns list of tables posts as an array', function (done) {
    api.get('/services/tables?format=json')
      .expect(200)
      .expect('Content-Type', "application/json")
      .end(function (err, res) {
        if (err) return done(err);
        res.body.should.be.instanceof(Array);
        tableList = res.body; //Store list of tables
        done();
      });
  });

  it('Loads a specific table endoint', function (done) {
    api.get('/services/tables/agriculture_2014?format=json')
      .expect(200)
      .expect('Content-Type', "application/json")
      .end(function (err, res) {
        if (err) return done(err);
        (res.body).should.have.property('columns');
        done();
      });
  });

  it('Queries a specific table endoint with returnFields set to country, limit = 100', function (done) {
    api.get('/services/tables/agriculture_2014/query?format=json&returnfields=country&limit=100')
      .expect(200)
      .expect('Content-Type', "application/json")
      .end(function (err, res) {
        if (err) return done(err);
        (res.body).should.have.property('features');
        (res.body.features).should.have.length(100);
        done();
      });
  });

  it('Queries a specific table endoint to get geojson: whereClause is 1=1, returnFields set to country, limit 100', function (done) {
    api.get('/services/tables/agriculture_2014/query?format=json&returnfields=country&limit=100')
      .expect(200)
      .expect('Content-Type', "application/json")
      .end(function (err, res) {
        if (err) return done(err);
        //Check for proper length of response features.  Should be 100
        (res.body).should.have.property('features').with.length(100);

        //Check that the response features have a properties property, and that all properties have a country property.
        (res.body.features).should.contain.a.thing.with.property('properties').should.all.have.property('country');
        done();
      });
  });

  it('Queries a specific table endoint to get geojson: whereClause is id<10, returnFields set to country', function (done) {
    api.get('/services/tables/agriculture_2014/query?format=json&returnfields=country&where=id%3C%2010')
      .expect(200)
      .expect('Content-Type', "application/json")
      .end(function (err, res) {
        if (err) return done(err);
        //Check for proper length of response features.  Should be 9
        (res.body).should.have.property('features').with.length(9);

        //Check that the response features have a properties property, and that all properties have a country property.
        (res.body.features).should.contain.a.thing.with.property('properties').should.all.have.property('country');
        done();
      });
  });

  it('Queries a specific table endoint to get geojson: whereClause is id<10, returnFields set to country, returnGeometry=no', function (done) {
    api.get('/services/tables/agriculture_2014/query?format=json&returnfields=country&where=id%3C%2010&returnGeometry=no')
      .expect(200)
      .expect('Content-Type', "application/json")
      .end(function (err, res) {
        if (err) return done(err);
        //Check for proper length of response features.  Should be 9
        (res.body).should.have.property('features').with.length(9);

        //Check that the response features have a properties property, and that all properties have a country property.
        (res.body.features).should.contain.a.thing.with.property('properties').should.all.have.property('country');
        done();
      });
  });

  it('Queries a specific table endoint to get geojson: whereClause is id<10, returnFields set to country, returnGeometry=no, returnGeometryEnvelopes=yes', function (done) {
    api.get('/services/tables/agriculture_2014/query?format=json&returnfields=country&where=id%3C%2010&returnGeometry=no&returnGeometryEnvelopes=yes')
      .expect(200)
      .expect('Content-Type', "application/json")
      .end(function (err, res) {
        if (err) return done(err);
        //Check for proper length of response features.  Should be 9
        (res.body).should.have.property('features').with.length(9);

        //Check that the response features have a properties property, and that all properties have a country property.
        (res.body.features).should.contain.a.thing.with.property('properties').should.all.have.property('country');
        done();
      });
  });

  it('Queries a specific table endoint to get geojson: group by with no statsdef', function (done) {
    api.get('/services/tables/agriculture_2014/query?where=id%3C%2010&returnfields=country&format=geojson&returnGeometry=yes&returnGeometryEnvelopes=no&groupby=country&limit=100')
      .expect(200)
      .expect('Content-Type', "application/json")
      .end(function (err, res) {
        if (err) return done(err);
        //Response should be json with error
        (res.body).should.have.property('error');
        done();
      });
  });

  it('Queries a specific table endoint to get geojson: whereClause is id<10, returnFields set to country, returnGeometry=no, group by country, statsdev = count:id,sum:number_employees limit=100', function (done) {
    api.get('/services/tables/agriculture_2014/query?where=id%3C%2010&returnfields=country&format=geojson&returnGeometry=no&returnGeometryEnvelopes=no&groupby=country&statsdef=count%3Aid%2Csum%3Anumber_employees&limit=100')
      .expect(200)
      .expect('Content-Type', "application/json")
      .end(function (err, res) {
        if (err) return done(err);
        //Check for proper length of response features.  Should be 1
        (res.body).should.have.property('features').with.length(1);

        //Check that the response features have a properties property, and that all properties have a country property.
        (res.body.features).should.contain.a.thing.with.property('properties').should.all.have.property('count_id', 'country', 'sum_number_employees');
        done();
      });
  });

  it('Queries a specific table endoint to get geojson - using wkt intersect geom: whereClause is id<10, returnFields set to country, limit=100', function (done) {
    api.get('/services/tables/agriculture_2014/query?where=id%3C%2010&returnfields=country&format=geojson&returnGeometry=yes&returnGeometryEnvelopes=no&wkt=POLYGON((80.0628662109375%2027.193571414057214%2C81.1614990234375%2027.193571414057214%2C81.1614990234375%2026.162833742569937%2C80.0628662109375%2026.162833742569937%2C80.0628662109375%2027.193571414057214))&limit=100')
      .expect(200)
      .expect('Content-Type', "application/json")
      .end(function (err, res) {
        if (err) return done(err);
        //Check for proper length of response features.  Should be 9
        (res.body).should.have.property('features').with.length(9);

        //Check that the response features have a properties property, and that all properties have a country property.
        (res.body.features).should.contain.a.thing.with.property('properties').should.all.have.property('count_id', 'country', 'sum_number_employees');
        done();
      });
  });

  it('Queries a specific table endoint to get geojson:  Offset = 1000, returnFields set to country and id, limit=100', function (done) {
    api.get('/services/tables/agriculture_2014/query?returnfields=country%2Cid&format=geojson&returnGeometry=yes&returnGeometryEnvelopes=no&limit=100&offset=1000')
      .expect(200)
      .expect('Content-Type', "application/json")
      .end(function (err, res) {
        if (err) return done(err);
        //Check for proper length of response features.  Should be 100
        (res.body).should.have.property('features').with.length(100);

        //Check that the response features have a properties property, and that all properties have a country property.
        (res.body.features).should.contain.a.thing.with.property('properties').should.all.have.property('id', 'country');
        done();
      });
  });

  it('Queries a specific table endoint as csv: whereClause is 1=1, returnFields set to country, limit 100', function (done) {
    api.get('/services/tables/agriculture_2014/query?format=csv&returnfields=country&limit=100')
      .expect(200)
      .expect('Content-Type', "text/csv")
      .end(function (err, res) {
        if (err) return done(err);
        //Check for proper length of response features.  Should be 102
        (res.text.split(',\r\n')).should.have.length(102);
        //Check for column header - should be 'country'
        (res.text.split(',\r\n'))[0].should.equal("country");
        done();
      });
  });

  it('Queries a specific table endoint as shapefile: whereClause is 1=1, returnFields set to country, limit 100', function (done) {
    api.get('/services/tables/agriculture_2014/query?format=shapefile&returnfields=country&limit=100&returnGeometry=yes')
      .expect(200)
      .expect('Content-Type', "application/zip")
      .end(function (err, res) {
        if (err) return done(err);

        done();
      });
  });


})



