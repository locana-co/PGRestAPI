//blast_config.js is the config file for datablaster.  List here the datasources and transforms to perform on data.
var transformers = require('./transformers');

var config = {};
config.sources = [];


//Define the jobs to blast here.
//In general, we're just posting to our own REST endpoint.
//So specify what endpoint to
config.sources.push({
    options: {
        name: "Uganda_Cicos", //identifying name, used to write out a .js file after processing is complete
        tablename: "vw_uganda_cicos", //which table or view are we querying from the REST endpoint?
        postArgs: {
            format: 'geojson', //Which format do you want?
            returnfields: 'featuretype,prvd,gid,photos', //Which return fields do you want?
            returnGeometry: 'yes', //Do you want geometry back?
            returnGeometryEnvelopes: 'no', //Do you want envelopes back?
            limit: -1 //How many features to return?  -1 means NO LIMIT
        },
        break_columns: "", // NOT USED YET - If you're slicing and dicing your dataset, these are the columns to break by.  Comma separated list
        primary_load: true, //NOT USED YET - The output will be used immediately when the client page is initialized.
        transformer: "", //Define a function that can be used to postprocess the data after it comes back from the endpoint.  Optionally define methods in the transformers.js class that you can use as a library of transform functions.
        fileType: "geojson", //What output type do you want?  Use geojson or json here.
        callback: function (err, result) { //What do do when we've finished postprocessing?  Add a hook somewhere if you want.
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


config.sources.push({
    options: {
        name: "Bangladesh_Cico_Count", //identifying name
        tablename: "vw_bangladesh_cicos",
        postArgs: {
            format: 'geojson',
            groupby: 'featuretype',
            statsdef: 'count:featuretype'
        },
        break_columns: "", //If you're slicing and dicing your dataset, these are the columns to break by.  Comma separated list
        primary_load: true, //The output will be used immediately when the client page is initialized.
        transformer: null, //No transform needed
        fileType: "json",
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
