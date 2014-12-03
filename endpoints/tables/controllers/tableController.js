/**
 *
 * Logic for PostGres (Tables) API endpoint
 */
var common = require("../../../common"), settings = require('../../../settings/settings'), flow = require('flow');
var tiles;
try {
  tiles = require('../../../endpoints/tiles');
} catch (e) {
  tiles = null;
}

var TableController = exports;

//function TableController() {
//  this.columnNames = {};
//}

//Get list of public base tables from postgres
TableController.getTableList = function (req, res) {
  var args = {};

  //Grab POST or QueryString args depending on type
  args = common.getArguments(req);

  args.view = "table_list";
  args.path = req.path;
  var protocol = common.getProtocol(req);
  args.host = settings.application.publichost || req.headers.host;
  args.link = protocol + args.host + "/services/tables";
  args.breadcrumbs = [{
    link : "/services",
    name : "Home"
  }, {
    link : "",
    name : "Table Listing"
  }];

  try {
    //Check to see if we've stashed the list already.
    if (settings.tableList && !args.search) {
      //Render HTML page with results at bottom
      args.featureCollection = settings.tableList;
      common.respond(req, res, args);
    } else {

      var self = this;

      //Fetch from DB
      this.getTablesFromDBQuery(args.search, function(err, result){

        self.handleTablesFromDBQueryFunction(err, result, args, function(returnArgs){

          //Output results
          common.respond(req, res, returnArgs);

        })

      });

    }
  } catch (e) {
    args.errorMessage = e.text;
    common.respond(req, res, args);
  }
};


TableController.getTablesFromDBQuery = function(searchString, cb){
  //Fetch from DB
  var query = {
    text: "SELECT * FROM information_schema.tables WHERE table_schema = 'public'" + (settings.otherSchemas && settings.otherSchemas.length > 0 ? " OR table_schema IN ('" + settings.otherSchemas.join("', '") + "') " : "") + " and (" + (settings.displayTables === true ? "table_type = 'BASE TABLE'" : "1=1") + (settings.displayViews === true ? " or table_type = 'VIEW'" : "") + ") AND table_name NOT IN ('geography_columns', 'geometry_columns', 'raster_columns', 'raster_overviews', 'spatial_ref_sys'" + (settings.pg.noFlyList && settings.pg.noFlyList.length > 0 ? ",'" + settings.pg.noFlyList.join("','") + "'" : "") + ") " + (searchString ? " AND table_name ILIKE ('" + searchString + "%') " : "") + " ORDER BY table_schema,table_name; ",
    values: []
  };
  common.executePgQuery(query, cb);
}

TableController.handleTablesFromDBQueryFunction = function (err, result, args, cb) {
  if (err) {
    args.errorMessage = err.text;
    cb(args);
    return;
  }

  args.featureCollection = result.rows.map(function (item) {
    return item.table_name;
  });

  //Get array of table names
  //stash it for later - if not the result of a search
  if (!args.search)
    settings.tableList = args.featureCollection;

  //Callback
  cb(args);
}


//Get specific table details from db
TableController.getTableDetails = flow.define(


  function (req, res) {
    this.req = req;
    this.res = res;

    this.args = {};

    //Grab POST or QueryString args depending on type
    this.args = common.getArguments(req);

    this.args.table = req.params.table;
    this.args.view = "table_details";
    this.args.breadcrumbs = [
      {
        link: "/services",
        name: "Home"
      },
      {
        link: "/services/tables",
        name: "Table Listing"
      },
      {
        link: "",
        name: this.args.table
      }
    ];
    this.args.host = settings.application.publichost || req.headers.host;
    this.args.url = this.req.url;
    this.args.table_details = [];
    this.protocol = common.getProtocol(req);
    this.args.fullURL = this.protocol + (settings.application.publichost || this.req.headers.host) + this.req.path;
    this.args.link = this.protocol + this.args.host + "/services/tables/" + this.args.table;
    this.args.featureCollection = {};

    //Find Column Names
    //Grab from stash if we have it already
    //TODO: don't use settings object to store column names.  use Express' app object

    if(TableController.isTableInHash(this.args.table)){

      this.args.featureCollection.columns = TableController.columnNames[this.args.table].rows;

      //Pass on in flow
      this(settings.columnNames[this.args.table]);

    } else {
      //copy for closure
      var args = this.args;
      var flo = this;

      TableController.getTableInfoFromDBQuery(this.args.table, function (err, result) {

        TableController.handleTableInfoFromDBQueryFunction(err, result, args, function(err, tableInfo){

          if(err){
            common.respond(flo.req, flo.res, flo.args);
          }
          else{
            flo(tableInfo);
          }
        });

      });

      var query = {
        text: "select column_name, CASE when data_type = 'USER-DEFINED' THEN udt_name ELSE data_type end as data_type from INFORMATION_SCHEMA.COLUMNS where table_name = $1",
        values: [this.args.table]
      };

      common.executePgQuery(query, function (err, result) {

      });
    }
  }, function (result) {
    //Expecting an array of columns and types

    //Add supported operations in a property
    this.args.featureCollection.supportedOperations = [];
    this.args.featureCollection.supportedOperations.push({
      link: this.args.fullURL + "/query",
      name: "Query"
    });

    var rasterOrGeometry = {
      present: false,
      name: ""
    };

    var args = this.args;
    //copy for closure

    result.rows.forEach(function (item) {
      if (item.data_type == "raster") {
        args.featureCollection.supportedOperations.push({
          link: args.fullURL + "/rasterOps",
          name: "Raster Operations"
        });
        rasterOrGeometry.present = true;
        rasterOrGeometry.name = common.escapePostGresColumns([item.column_name])[0];
      } else if (item.data_type == "geometry") {
        if (tiles)
          args.featureCollection.supportedOperations.push({
            link: args.fullURL + "/" + item.column_name + "/dynamicMapLanding",
            name: "Dynamic Map Service - " + item.column_name + " column"
          });
        args.featureCollection.supportedOperations.push({
          link: args.fullURL + "/" + item.column_name + "/vector-tiles",
          name: "Dynamic Vector Tile Service - " + item.column_name + " column"
        });
        rasterOrGeometry.present = true;
        rasterOrGeometry.name = common.escapePostGresColumns([item.column_name])[0];
      }
    });

    this.args = args;
    //update this.args property

    //If there's a geom or raster column, then check for SRID
    this.spatialTables = app.get('spatialTables');

    if (rasterOrGeometry.present === true) {
      if (this.spatialTables[this.args.table] && this.spatialTables[this.args.table].srid) {
        this({
          rows: [
            {
              srid: this.spatialTables[this.args.table].srid
            }
          ]
        });
      } else {
        //check SRID
        var query = {
          text: 'select ST_SRID(' + rasterOrGeometry.name + ') as SRID FROM "' + this.args.table + '" LIMIT 1;',
          values: []
        };
        common.executePgQuery(query, this);
      }
    } else {
      //Not a spatial table
      //No SRID
      this({
        rows: [
          {
            srid: -1
          }
        ]
      }); //flow to next function
    }
  }, function (err, result) {
    //Coming from SRID check
    if (err) {
      //Report error and exit.
      this.args.errorMessage = err.text;
    } else if (result && result.rows && result.rows.length > 0) {
      //Get SRID
      if (result.rows[0].srid == 0 || result.rows[0].srid == "0") {
        this.args.infoMessage = "Warning:  this table's SRID is 0.  Projections and other operations will not function propertly until you <a href='http://postgis.net/docs/UpdateGeometrySRID.html' target='_blank'>set the SRID</a>.";
      } else if (result.rows[0].srid == -1) {
        //Not a spatial table
        this.args.SRID = "";
      }
      else {
        this.args.SRID = result.rows[0].srid;
        //Use the SRID
        if (this.spatialTables[this.args.table]) {
          this.spatialTables[this.args.table].srid = result.rows[0].srid;
        } else {
          //Add the table name and the SRID
          this.spatialTables[this.args.table] = {};
          this.spatialTables[this.args.table].srid = result.rows[0].srid;
        }
      }
    } else {
      //no match found.
      this.args.infoMessage = "Couldn't find information for this table.";
    }

    //Render HTML page with results at bottom
    common.respond(this.req, this.res, this.args);
  });


TableController.isTableInHash = function(table){

  //See if we've stored this hash of names already.
  if (this.columnNames && this.columnNames[table]) {
    return true;
  }

  //Not in the hash
  return false;
}

TableController.getTableInfoFromDBQuery = function(table, cb){
  //Fetch from DB
  var query = {
    text: "select column_name, CASE when data_type = 'USER-DEFINED' THEN udt_name ELSE data_type end as data_type from INFORMATION_SCHEMA.COLUMNS where table_name = $1",
    values: [table]
  };

  common.executePgQuery(query, cb);
}

TableController.handleTableInfoFromDBQueryFunction = function (err, result, args, cb) {

  //check for error
  if (err) {

    //Report error and exit.
    args.errorMessage = err.text;
    cb(err, null);
    return;

    //go to next flow
  } else if (result && result.rows && result.rows.length > 0) {

    args.featureCollection.columns = result.rows;

    //Stash
    if (!TableController.columnNames) {
      TableController.columnNames = {};
    }

    TableController.columnNames[args.table] = result;

    //Callback with result
    cb(null, result);
    return;

  } else {
    //unknown table, or no columns?
    args.errorMessage = "Table doesn't exist or has no columns.";
    cb(new Error(args.errorMessage), null);
    //common.respond(flo.req, flo.res, flo.args);
  }

}
