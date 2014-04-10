//4.3.2014 - Ryan Whitley
//Starting a Plug and Play Custom Endpoint Workflow

//names is an array of operation names.  Used to list possible operations
//Use the name as a key to look up the full operation module from the operations object.
//Example: Custom.operations["Buffer"]

var Custom = { operations: {}, names: [] };

//Dynamically load Query or Custom Options from the plugin folder.
require("fs").readdirSync(__dirname).forEach(function (file) {
    if (file != "index.js" && file != "CustomOperation.js.example") {
        var operation = require(__dirname + "/" + file);
        var name = operation.name.toLowerCase(); //Lower name
      Custom.names.push(name);
      Custom.operations[name] = operation;
    }
});


module.exports = Custom;