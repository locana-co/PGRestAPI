var pg        = require("pg"),
    projector = require("nodetiles-core-cache").projector,
    __        = require("lodash");
/*
 * Something like this eventually? 
 * https://github.com/mapbox/tilemill/blob/master/models/Layer.bones#L60
 */

/**
 * A PostGISSource connects to a PostGIS database and returns data to a
 * Nodetiles map for rendering. Its options object can include:
 *
 *   Required:
 *     connectionString: A standard Postgres database connection string
 *     tableName:        The name of the table to query for data
 *     geomField:        The name of the field containing your geo coordinates
 *     projection: The projection your data is *stored* in (not the projection 
 *                 of your map). Should be in the format "EPSG:[number]"
 *   Optional:
 *     fields: An array of field names to include in the data sent to the
 *             Nodetiles map renderer. If your stylesheet uses a field in its
 *             selectors or if you want particular data available for client-
 *             side interaction, make sure to include those fields here.
 *             **By default, all fields are included, so this is usually safe
 *             to leave out.**
 *     name: The name of the data source, for use in your stylesheets. If you
 *           leave this blank, the value of `tableName` will be used instead.
 */
var PostGISSource = function(options) {
  this._projection = projector.util.cleanProjString(options.projection);
  // TODO: do this properly, this will break with proj4 strings?
  this._projectionRaw = options.projection && options.projection.indexOf('EPSG')? options.projection.slice(options.projection.indexOf(':')+1):null; // for PostGIS < v1.5, if we want to support it
  this._connectionString = options.connectionString; // required
  this._tableName = options.tableName;               // required
  this._geomField = options.geomField;               // required
  this._attrFields = __.isArray(options.fields) ? 
                       options.fields.join(',') : 
                       options.fields; // array of attribute fields, or comma separated suggested for better performanace
  this.sourceName = options.name || options.tableName;
  
  // TODO: allow `pg` options to be easily set (e.g. max connections, etc.)
  // TODO: throw errors if required fields are missing
  // console.log("Creating PostGIS source: "+this._connectionString+" "+this._tableName);
  return this;
}

PostGISSource.prototype = {
  constructor: PostGISSource,

  // need some way to check projection equivalency programmatically so we can use built-in postgis projection i.e.
  //
  // check proj4 support with: SELECT PostGIS_Full_Version();
  // i.e. POSTGIS="1.3.3" GEOS="3.1.0-CAPI-1.5.0" PROJ="Rel. 4.4.9, 29 Oct 2004" USE_STATS
  // 
  // if (!projector.equals(projection,mapProjection){
  //    var query = SELECT ST_TRANSFORM(query, projection, mapProjecion)

  getShapes: function(minX, minY, maxX, maxY, mapProjection, callback) {
    // console.log("GETSHAPES", this._projection, mapProjection);
    // we don't get real coordinates from Map.js yet so we'll fake it for now
    // minX = -122.4565;
    // minY = 37.756;
    // maxX = -122.451;
    // maxY = 37.761;
    
    var min = [minX, minY];
    var max = [maxX, maxY];

    // project request coordinates into data coordinates
    if (mapProjection !== this._projection) {
      min = projector.project.Point(mapProjection, this._projection, min);
      max = projector.project.Point(mapProjection, this._projection, max);
      // console.log(min,max);
    }
    
    pg.connect(this._connectionString, function(err, client, done) { // Switched method signature... WTF?!
      if (err) { return callback(err, null); }
      // console.log("Loading features...");
      var start, query;
        
      start = Date.now();
      if (this._attrFields) {
        query = "SELECT ST_AsGeoJson("+this._geomField+") as geometry, "+this._attrFields+" FROM "+this._tableName+" WHERE "+this._geomField+" && ST_MakeEnvelope($1,$2,$3,$4);";
      }
      else {
        query = "SELECT ST_AsGeoJson("+this._geomField+") as geometry,* FROM "+this._tableName+" WHERE "+this._geomField+" && ST_MakeEnvelope($1,$2,$3,$4);";
      }
      // console.log("Querying... "+query+" "+min+", "+max);
      client.query(query, [min[0], min[1], max[0], max[1]], function(err, result) {
        if (err) { return callback(err, null); }
        // console.log("Loaded in " + (Date.now() - start) + "ms");
        
        var geoJson;

        if (result && result.rows) {
          // TODO: since we're processing blackbox data, we should probably catch any exceptions from processing it
          try {
            geoJson = this._toGeoJson(result.rows);
            if (this._projection !== mapProjection){
              // TODO: can this projection be done in PostGIS?
              // console.log("REPROJECTING GEOMETRY");
              //console.log('before',geoJson.features[0].geometry.coordinates[0][0][0]);
              geoJson = projector.project.FeatureCollection(this._projection, mapProjection, geoJson);
              //console.log('after',geoJson.features[0].geometry.coordinates[0][0][0]);
            }
          }
          catch(err) {
            done();
            return callback(err, null);
          }
        }
        done();
        callback(err, geoJson);
      }.bind(this));
    }.bind(this));
  },

  _toGeoJson: function(rows){
    var obj, i;
    
    obj = {
      type: "FeatureCollection",
      features: []
    };
    
    for (i = 0; i < rows.length; i++) {
      var item, feature, geometry;
      item = rows[i];
      
      geometry = JSON.parse(item.geometry);
      delete item.geometry;
      
      feature = {
        type: "Feature",
        properties: item,
        geometry: geometry
      }
      
      obj.features.push(feature);
    } 
    return obj;
  }
}

module.exports = PostGISSource;
