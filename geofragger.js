var gjv = require("geojson-validation");

module.exports = Geofragger;

function Geofragger(geojson) {
    if (!(this instanceof geofragger)) return new Geofragger(geojson)
    var _self = this;

    _self.originalGeoJSON = geojson;
    _self.SRS = "EPSG:4326";

    //start process

    //validate
    if (_self.validate(geojson) == true) {

    }
    else {
        throw new Error('The GeoJSON input is invalid.')
    }

}

Geofragger.prototype.validate = function (geojson) {
    return gjv.valid(outputObject);
}

//Convert GeoJSON to PostGIS compatible format (for inserts into PostGIS for example)
Geofragger.prototype.toPostGISFragment = function (geojson) {
    //This is a valid fragment for importing 2 point geometries using ST_GeomFromGeoJSON
    //'{"type": "GeometryCollection", "geometries": [{"type":"Point","coordinates":[32.531362,0.354736]}, {"type":"Point","coordinates":[32.122497,3.260663]}], "crs":{"type":"name","properties":{"name":"EPSG:4326"}}}'

    //Starting Point
    //{"type":"FeatureCollection","features":[{"type":"Feature","properties":{},"geometry":{"type":"Point","coordinates":[32.531362,0.354736]}},{"type":"Feature","properties":{},"geometry":{"type":"Point","coordinates":[32.577196,0.355251]}},{"type":"Feature","properties":{},"geometry":{"type":"Point","coordinates":[32.640282,0.301865]}},{"type":"Feature","properties":{},"geometry":{"type":"Point","coordinates":[33.50064,0.896036]}},{"type":"Feature","properties":{},"geometry":{"type":"Point","coordinates":[33.206069,0.435329]}},{"type":"Feature","properties":{},"geometry":{"type":"Point","coordinates":[32.899754,2.25046]}},{"type":"Feature","properties":{},"geometry":{"type":"Point","coordinates":[32.122497,3.260663]}},{"type":"Feature","properties":{},"geometry":{"type":"Point","coordinates":[32.122497,3.260663]}},{"type":"Feature","properties":{},"geometry":{"type":"Point","coordinates":[30.629025,-0.582265]}},{"type":"Feature","properties":{},"geometry":{"type":"Point","coordinates":[30.008297,0.005493]}},{"type":"Feature","properties":{},"geometry":{"type":"Point","coordinates":[33.595333,1.719102]}},{"type":"Feature","properties":{},"geometry":{"type":"Point","coordinates":[32.858391,2.822344]}}]}

    //Start with point features.
    //If the input is a geojson object with mulitple point features, then convert it to a GeometryCollection Fragment
    var outputObject = {};

    switch (Geofragger.prototype._getType(geojson)) {

        case "point":

            if (geojson.features.length > 1) {
                //Create a GeometryCollection fragment
                outputObject.type = "GeometryCollection";
                outputObject.geometries = geojson.features.map(function (feature) { return feature.geometry; });
                outputObject.crs = { type: "name", properties: { "name": _self.SRS } };
            }
            else if (geojson.features.length == 1) {
                //Create a point fragment -{"type":"Point","coordinates":[-48.23456,20.12345]}
                outputObject = geojson.features[0].geometry;
            }
            else {
                //no features
                outputObject = {};
            }

            break;

        case "polygon":

            break;
        case "linestring":

            break;

    }
}


Geofragger.prototype._getType = function (geojson) {
    if (geojson.features > 0) {
        if ('type' in geojson.features[0]) {
            return geojson.features[0].type;
        }
    }
    else {
        //no features.  No type
        throw new Error("Type can't be determined for object with no features.");
    }
}
