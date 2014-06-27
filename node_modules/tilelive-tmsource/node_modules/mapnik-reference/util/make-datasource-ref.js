var fs = require('fs');
var path = require('path');
var util = require('util');
var assert = require('assert');
var existsSync = require('fs').existsSync || require('path').existsSync

var args = process.argv.slice(1);

var cmd = path.basename(process.argv.slice(1,2));

var options = {};

args = args.filter(function (arg) {
    var match;

    if (match = arg.match(/^--?([a-z][0-9a-z-]*)$/i)) { arg = match[1] }
    else { return arg }

    switch (arg) {
        case 'd':
        case 'debug':
            options.debug = true;
            break;
        default:
            console.log("Usage: "+cmd+" <source file>");
            console.log("Options:");
            console.log("  -d   --debug");
            process.exit(0);
            break;
    }
});

var input = args[1];
if (input && input[0] != '/') {
    input = path.join(process.cwd(), input);
}

if (!input) {
    console.log(cmd+": no input file");
    process.exit(1);
}

var ext = path.extname(input);

if (!ext) {
    console.log(cmd+": please pass a layers.json file");
    process.exit(1);
}

if (!existsSync(input)) {
    console.log(cmd+": file does not exist: '" + input + "'");
    process.exit(1);
}

var data = JSON.parse(fs.readFileSync(input));

// TODO - add support for includes?

js_numbers = {
  'float':'number',
  'unsigned':'number',
  'string':'string',
  'boolean':'boolean',
}

function validate_prop(types,prop_name,prop_value) {
    Object.keys(types).forEach(function(key) {
        var type_def = types[key];
        if (type_def.required) {
            assert.ok(key in prop_value,key+' not defined for '+ prop_name);
        }
        if (type_def.values) {
            assert.ok(type_def.values.indexOf(prop_value.type) > -1,prop_value.type+' not found in '+ type_def.values);
        }
        if (prop_value['default-value']) {
           assert.ok(typeof(prop_value['default-value']) === js_numbers[prop_value.type],typeof(prop_value['default-value'])+' not === '+prop_value.type+ ' for '+prop_name)
        }
    });
}

// expand gyp-like variables to build out entire file
Object.keys(data.datasources).forEach(function(key) {
    var ds = data.datasources[key];
    // handle commented sections
    if (key[0] == '#') {
        delete data.datasources[key];
    } else {
        if (options.debug) console.warn('Handling '+key)
        Object.keys(ds).forEach(function(prop) {
            var match = ds[prop].match && ds[prop].match(/<@\((.+)\)/);
            if (match && match[1]) {
                ds[prop] = data.variables[prop];
                if (options.debug) {
                    console.warn('  handling variable for "'+prop+'"');
                }
            } else {
                if (options.debug) {
                    console.warn('  handling raw object for "'+prop+'"');
                }
            }
            validate_prop(data.types,prop,ds[prop]);
        });
    }
});

if (!options.debug) {
  delete data.types;
  delete data.variables;
  console.log(JSON.stringify(data,null,"    "));
}