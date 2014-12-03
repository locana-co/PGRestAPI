/**
 * Unit tests for 'Tables' endpoint functions
 */

var assert = require('chai').assert;
var TableController = require('../endpoints/tables/controllers/tableController.js');
var request = require("request");
var chai = require('chai');
    chai.use(require('chai-things'));

var should = require('chai').should();
//common and settings files
var common = require("../common"),
    settings = require('../settings/settings');

//Bring in Mocks
var mock_results = require('./fixtures/postgres/tables/results.js');


describe('Tables', function () {

  it('parses DB table list query results', function (done) {

    //(err, result, args, cb)
    TableController.handleTablesFromDBQueryFunction(null, mock_results.tableList_normal, {}, function(resultArgs){

      //resultArgs should have featureCollection and be an array of table names
      resultArgs.should.have.property('featureCollection');

      resultArgs.featureCollection.should.be.instanceof(Array);
      done();
    });

  });



  it('checks for table details in hash', function (done) {

    //(err, result, args, cb)
    var tableName = "ag_2014";

    TableController.handleTableInfoFromDBQueryFunction(null, mock_results.table_colummnList_normal, { featureCollection: {}, table: tableName }, function(err, tableInfo){


      ////resultArgs should have rows and be an array of column names
      tableInfo.rows.should.be.instanceof(Array);

      //TableController should have a columnNames property equal to tableInfo
      TableController.columnNames[tableName].should.equal(tableInfo);
      done();
    });

  });



})



