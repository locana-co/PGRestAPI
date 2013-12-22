////////TESTING///////////

var assert = require('chai').assert;
var tables = require('../endpoints/tables');

//common and settings files
var common = require("../common"),
    settings = require('../settings');

var gjv = require("geojson-validation");


suite('Common', function () {
    //See if the common.respond function exists
    test("response function is defined", function () {
        assert.isDefined(common.respond);
    })

    test("escapePostGresColumns returns array", function () {
        var escaped = common.escapePostGresColumns(["a", "b", "c", "geom"]);
        assert(Array.isArray(escaped), "escapePostGresColumns result is an array");
    })

    test("escapePostGresColumns returns double quoted names", function () {
        var escaped = common.escapePostGresColumns(["a", "b", "c", "geom"]);
        escaped.forEach(function (item) {
            assert.isString(item); //Should be a string
            assert(item.substring(0, 1) == '"', "first character should be double quote");
            assert(item.substring(item.length - 1) == '"', "last character should be double quote");
        });
    })

    test("unEscapePostGresColumns returns array", function () {
        var unEscaped = common.unEscapePostGresColumns(['"a"', '"b"', '"c"', '"geom"']);
        assert(Array.isArray(unEscaped), "unEscapePostGresColumns result is an array");
    })

    test("unEscapePostGresColumns returns double quoted names", function () {
        var unEscaped = common.unEscapePostGresColumns(['"a"', '"b"', '"c"', '"geom"']);
        unEscaped.forEach(function (item) {
            assert.isString(item); //Should be a string
            assert(item.substring(0, 1) != '"', "first character should NOT be double quote");
            assert(item.substring(item.length - 1) != '"', "last character should NOT be double quote");
        });
    })

    test("GeoJSON Formatter - valid GeoJSON", function () {

        //Pass in a mock object to format as GeoJSON
        var mockObject = [{ name: "objectName1", size: "large", geom: '{"type":"Point","coordinates":[8.234,9.2342]}' },
                          { name: "objectName2", size: "medium", geom: '{"type":"Point","coordinates":[8.234,9.2342]}' },
                          { name: "objectName3", size: "small", geom: '{"type":"Point","coordinates":[8.234,9.2342]}' }
                         ];

        var outputObject = common.formatters.geoJSONFormatter(mockObject);

        //Check to see if it is valid GeoJSON
        assert.isObject(outputObject, "it should be valid GeoJSON");

        assert(gjv.valid(outputObject) == true, "GeoJSON should be valid");
    })

    test("GeoJSON Formatter - INvalid GeoJSON", function () {

        //Pass in a mock object to format as GeoJSON
        var mockObject = [{ name: "objectName1", size: "large", geom: '{"type":"Point","coordinates":[8.234,9.2342]}' },
                          { name: "objectName2", size: "medium", geom: '{"type":"Point","coordinates":[8.234,9.2342]}' },
                          { name: "objectName3", size: "small", geom: '{"type":"Point","coordinate":[8.234,9.2342]}' } //This one is missing the 's' at the end of coordinate
        ];

        var outputObject = common.formatters.geoJSONFormatter(mockObject);

        //Check to see if it is valid GeoJSON
        assert.isObject(outputObject, "it should have come out as an Object");

        assert(gjv.valid(outputObject) == false, "GeoJSON should be INvalid");
    })
    
})

suite('Tables', function () {
    test("table get is defined", function () {
        assert.isDefined(tables.get);
    })
})



//This is for the API level testing
//var should = require('chai').should(),
//    supertest = require('supertest'),
//    api = supertest('http://localhost:3000');


//describe('/services', function () {

//    it('returns list of tables posts as HTML', function (done) {
//        api.get('/services')
//        .expect(200)
//        .expect('Content-Type', "text/html; charset=utf-8")
//        .end(function (err, res) {
//            console.log("Here: " + JSON.stringify(res.body, null, 4));

//            if (err) return done(err);
//            res.body.should.have.property('list').and.be.instanceof(Array);
//            done();
//        });
//    });

//});