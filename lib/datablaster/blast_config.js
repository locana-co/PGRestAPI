//blast_config.js is the config file for datablaster.  List here the datasources and transforms to perform on data.
var transformers = require('./transformers');


var config = {};
config.sources = [];

//Add the uganda CICOs source.
//We want to get out the inital loading cicos file for uganda
config.sources.push({
    options: {
        name: "Uganda_Cicos", //identifying name
        tablename: "uganda_cicos",
        postArgs: {
            format: 'geojson',
            returnfields: 'featuretype,xcoord,ycoord',
            limit: 50000
        },
        break_columns: "", //If you're slicing and dicing your dataset, these are the columns to break by.  Comma separated list
        primary_load: true, //The output will be used immediately when the client page is initialized.
        transformer: transformers.LeafletQuickClusterTransform, //Use a precooked one
        callback: function (err, result) {
            //What to do when the request is done.

            //if err, then handle it
            if (err) {
                //move on
            }

            //write out result
            console.log("Done with transform.");

        }
    }
});

//Add the nigeria CICOs source.
//We want to get out the inital loading cicos file for nigeria
config.sources.push({
    options: {
        name: "Nigeria_Cicos", //identifying name
        tablename: "nigeria_cicos",
        postArgs: {
            format: 'geojson',
            returnfields: 'featuretype,xcoord,ycoord',
            limit: 50000
        },
        break_columns: "", //If you're slicing and dicing your dataset, these are the columns to break by.  Comma separated list
        primary_load: true, //The output will be used immediately when the client page is initialized.
        transformer: transformers.LeafletQuickClusterTransform, //Use a precooked one
        callback: function (err, result) {
            //What to do when the request is done.

            //if err, then handle it
            if (err) {
                //move on
            }

            //write out result
            console.log("Done with transform.");

        }
    }
});

//config.indexFileFormat = {  };

module.exports = config;
