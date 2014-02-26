//transformers.js is a library of precooked transformers for common operations.
var transformers = {};

//Add the uganda CICOs source.
//We want to get out the inital loading cicos file for uganda
transformers.LeafletQuickClusterTransform = function (featureSet) {

    //Takes GeoJSON data, replaces properties object with one called attributes.  
    //Moves the x,y out into the root of the object.
    //Meant to work with leaflet quick cluster library

    //the transform
    var outArray = [];
    //Loop features in GeoJSON object
    if (featureSet && featureSet.features) {
        outArray = featureSet.features.map(function (feature) {
            var pointX = parseInt(feature.properties.xcoord);
            var pointY = parseInt(feature.properties.ycoord);

            //feature.properties.ServiceLayerName = countryConfig.NAME;
            //feature.properties['shragt'] = (feature.properties['shragt'] == null) ? 'Not Available' : feature.properties['shragt'];
            feature.properties['prvd'] = (feature.properties['prvd'] == null) ? 'Not Available' : feature.properties['prvd'].replace(',', ', ');

            delete feature.properties.xcoord;
            delete feature.properties.ycoord;

            var att = feature.properties;
            return {
                "x": parseInt(pointX),
                "y": parseInt(pointY),
                "attributes": att
            };
        });
    }

    return outArray;
}


module.exports = transformers;
