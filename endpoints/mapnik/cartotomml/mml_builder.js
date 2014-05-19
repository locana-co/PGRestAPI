/* Based On Vizzuality's grainstore - https://github.com/CartoDB/grainstore*/

var _ = require('underscore'),
    carto = require('carto'),
    millstone = require('millstone'),
    fs = require('fs'),
    StyleTrans = require('./style_trans'),
    semver = require('semver'),
    jsdom = require('jsdom'),
    $ = require("jquery")(jsdom.jsdom().createWindow());
;

// MML builder interface
//
// `redis` should be an instance of RedisPool
//
// opts must have:
// `dbname`   - name of database
// 
// opts may have:
// `table`           - name of table with geospatial data
// `sql`             - sql to constrain the map by (can be an array)
// `geom_type`       - [polygon|point] to specify which default style to use
// `style`           - Carto style to override the built in style store (can be an array)
// `style_version`   - Version of the carto style override (can be an array)
// `interactivity`   - Comma separated list of grid fields (can be an array)
// `layer`           - Interactivity layer index, to use with token and grids
// `dbuser`          - Database username
// `dbpassword`      - Database password
// `dbhost`          - Database host
// `dbport`          - Database port
//
// @param optional_args
//     You may pass in a third argument to override grainstore defaults. 
//     `map` specifies the output map projection.
//     `datasource` specifies postgis details from Mapnik postgis plugin:
//                  https://github.com/mapnik/mapnik/wiki 
//     `styles` specifies the default styles
//     `cachedir` is base directory to put localized external resources into
//     `carto_env` carto renderer environment options, see
//                 http://github.com/mapbox/carto/blob/v0.9.5/lib/carto/renderer.js#L71
//     `mapnik_version` is target version of mapnik, defaults to ``2.0.2``
//     `default_style_version` is the default version for CartoCSS styles. Defaults to '2.0.0'
//
//     eg.
//     {
//       map: {srid: 3857},
//       datasource: {
//         type: "postgis",
//         host: "localhost",
//         user: "postgres",
//         geometry_field: "the_geom_webmercator",
//         extent: "-20037508.3,-20037508.3,20037508.3,20037508.3",
//         srid: 3857,
//         max_size: 10
//       },
//       styles: {
//         point: "default point style",
//         polygon: "default polygon style",  
//       }
//     }
//
// @param init_callback
//   init_callback(err, payload) will be invoked on complete initialization
//   see me.init for more info
//
var MMLBuilder = function (opts, optional_args, init_callback) {

    // core variables
    if (!opts.hasOwnProperty('table') && !opts.hasOwnProperty('sql'))
        throw new Error("Options must either include 'table' or 'sql'");
    var geom_type = opts.geom_type || 'point';   // geom type for default styling

    var extra_config = optional_args || {};

    var target_mapnik_version = extra_config.mapnik_version || '2.0.2';
    var default_style_version = extra_config.default_style_version || '2.0.0';

    // configure grainstore from optional args passed + defaults
    var grainstore_defaults = {
        map: {
            srid: 3857
        },
        datasource: {
            type: "postgis",
            host: "localhost",
            user: "",
            geometry_field: "geom",
            extent: "",
            srid: 4326,
            max_size: 10
        },
        styles: {
            db: 0  // redis database to store styles
        }
    };

    if (semver.satisfies(target_mapnik_version, '< 2.1.0')) {
        var def_style_point = " {marker-fill: #FF6600;marker-opacity: 1;marker-width: 8;marker-line-color: white;marker-line-width: 3;marker-line-opacity: 0.9;marker-placement: point;marker-type: ellipse;marker-allow-overlap: true;}";
        var def_style_line = " {line-color:#FF6600; line-width:1; line-opacity: 0.7;}";
        var def_style_poly = " {polygon-fill:#FF6600; polygon-opacity: 0.7; line-opacity:1; line-color: #FFFFFF;}";
        grainstore_defaults.styles.point = '#' + opts.table + def_style_point;
        grainstore_defaults.styles.polygon = '#' + opts.table + def_style_poly;
        grainstore_defaults.styles.multipolygon = grainstore_defaults.styles.polygon;
        grainstore_defaults.styles.multilinestring = '#' + opts.table + def_style_line;
        grainstore_defaults.styles.version = '2.0.0';
    }
    else if (semver.satisfies(target_mapnik_version, '< 2.2.0')) {
        var def_style_point = " {marker-fill: #FF6600;marker-opacity: 1;marker-width: 16;marker-line-color: white;marker-line-width: 3;marker-line-opacity: 0.9;marker-placement: point;marker-type: ellipse;marker-allow-overlap: true;}";
        var def_style_line = " {line-color:#FF6600; line-width:1; line-opacity: 0.7;}";
        var def_style_poly = " {polygon-fill:#FF6600; polygon-opacity: 0.7; line-opacity:1; line-color: #FFFFFF;}";

        grainstore_defaults.styles.point =
            grainstore_defaults.styles.polygon =
                grainstore_defaults.styles.multipolygon =
                    grainstore_defaults.styles.multilinestring =
                        grainstore_defaults.styles.geometry =
                            '#' + opts.table + '[mapnik-geometry-type=1]' + def_style_point +
                            '#' + opts.table + '[mapnik-geometry-type=2]' + def_style_line +
                            '#' + opts.table + '[mapnik-geometry-type=3]' + def_style_poly
        ;
        grainstore_defaults.styles.version = '2.1.0';
    }
    else {
        var def_style_point = " {marker-fill: #FF6600;marker-opacity: 1;marker-width: 16;marker-line-color: white;marker-line-width: 3;marker-line-opacity: 0.9;marker-placement: point;marker-type: ellipse;marker-allow-overlap: true;}";
        var def_style_line = " {line-color:#FF6600; line-width:1; line-opacity: 0.7;}";
        var def_style_poly = " {polygon-fill:#FF6600; polygon-opacity: 0.7; line-opacity:1; line-color: #FFFFFF;}";

        grainstore_defaults.styles.point =
            grainstore_defaults.styles.polygon =
                grainstore_defaults.styles.multipolygon =
                    grainstore_defaults.styles.multilinestring =
                        grainstore_defaults.styles.geometry =
                            '#' + opts.table + '["mapnik::geometry_type"=1]' + def_style_point +
                            '#' + opts.table + '["mapnik::geometry_type"=2]' + def_style_line +
                            '#' + opts.table + '["mapnik::geometry_type"=3]' + def_style_poly
        ;
        grainstore_defaults.styles.version = target_mapnik_version;
    }

    var grainstore_map = extra_config.map || {};
    // NOTE: we clone this to avoid changing default settings with an override
    var grainstore_datasource = extra_config.datasource ? _.clone(extra_config.datasource) : {};
    var grainstore_styles = extra_config.styles || {};

    grainstore_map = _.defaults(grainstore_map, grainstore_defaults.map);
    grainstore_datasource = _.defaults(grainstore_datasource, grainstore_defaults.datasource);
    grainstore_styles = _.defaults(grainstore_styles, grainstore_defaults.styles);

    // Allow overriding db authentication with options
    if (opts.user) grainstore_datasource.user = opts.user;
    if (opts.password) grainstore_datasource.password = opts.password;
    if (opts.host) grainstore_datasource.host = opts.host;
    if (opts.port) grainstore_datasource.port = opts.port;

    //RW Additions
    if (opts.geometry_field) grainstore_datasource.geometry_field = opts.geometry_field;
    if (opts.srid) grainstore_datasource.srid = opts.srid;


    // MML Builder definition
    var me = {
        knownByRedis: false
    };

    // Initialize the MMLBuilder 
    //
    // @param callback(err, style_payload) gets called with the string version
    //        of the style payload, which can be parsed by JSON.parse
    //
    // @param allow_broken_css if set to true prevents callback from being
    //        called with an Error when css cannot be rendered to XML.
    //        An error is still logged in that case
    //
    me.init = function (callback, allow_broken_css) {
        var that = this;
        var style;
        var style_version;

        callback(null, JSON.stringify({}));
    }


    // render CartoCSS to Mapnik XML
    //
    // @param style the CartoCSS
    // @param version the version of the given CartoCSS
    // @param callback function(err, compiled_XML)
    //
    me.render = function (style_in, callback, version) {

        var style;

        try {
            var t;
            if (_.isArray(style_in)) {
                style = [];
                for (var i = 0; i < style_in.length; ++i) {
                    if (style_in[i].replace(/^\s+|\s+$/g, '').length === 0) {
                        callback(new Error("style" + i + ": CartoCSS is empty"));
                        return;
                    }
                    var v = _.isArray(version) ? version[i] : version;
                    if (!v) v = default_style_version;
                    if (!t) t = new StyleTrans();
                    style[i] = t.transform(style_in[i], v, target_mapnik_version);
                }
            } else {
                if (style_in.replace(/^\s+|\s+$/g, '').length === 0) {
                    callback(new Error("CartoCSS is empty"));
                    return;
                }
                if (!version) version = default_style_version;
                if (!t) t = new StyleTrans();
                style = t.transform(style_in, version, target_mapnik_version);
            }
        } catch (err) {
            callback(err, null);
            return;
        }

        var mml;
        try {
            mml = this.toMML(style);
        }
        catch (err) {
            callback(err, null);
            return;
        }

        var millstone_options = _.extend({mml: mml}, millstone_base_options);
        millstone.resolve(millstone_options, function (err, mml) {

            if (err) {
                callback(err, null);
                return;
            }

            // NOTE: we _need_ a new object here because carto writes into it
            var carto_env = {};
            if (extra_config.carto_env) _.defaults(carto_env, extra_config.carto_env);
            var carto_options = { mapnik_version: target_mapnik_version };

            // carto.Renderer may throw during parse time (before nextTick is called)
            // See https://github.com/mapbox/carto/pull/187
            try {
                var r = new carto.Renderer(carto_env, carto_options);
                r.render(mml, function (err, output) {
                    callback(err, output);
                });
            } catch (err) {
                callback(err, null);
            }

        });
    };

    // Re-generate Mapnik XML from current MML.
    me.resetStyle = function (callback, convert) {
        var that = this;
        that.getStyle(function (err, style) {
            return that.setStyle(style.style, callback, style.version, convert);
        });
    };


    // @param callback function(err, xml)
    me.toXML = function (callback) {
        var that = this;
        this.getStyle(function (err, payload) {
            if (err) {
                callback(err);
                return;
            }
            that.render(payload.style, callback, payload.version);
        });
    };

    // Behaves differently if style_in is an array or not
    //
    // When it is an array, a string replacement happens on
    // the layer name part of the cartocss
    //
    me.toMML = function (style_in) {

        var base_mml = this.baseMML();
        base_mml.Stylesheet = [];

        var style = _.isArray(style_in) ? style_in : [ style_in ];
        var t = new StyleTrans();

        for (var i = 0; i < style.length; ++i) {
            var stylesheet = {};
            if (_.isArray(style_in)) {
                stylesheet.id = 'style' + i;
                stylesheet.data = t.setLayerName(style[i], 'layer' + i);
            } else {
                stylesheet.id = 'style.mss';
                stylesheet.data = style[i];
            }
            base_mml.Stylesheet.push(stylesheet);
        }

        return base_mml;
    };

    // Generate base MML for this object
    // opts:
    // `use_sql` - {Boolean} if true, use sql settings in MML, else use table
    me.baseMML = function (args) {
        args = args || {};
        args = _.defaults(args, {use_sql: true});

        var tables;
        if (args.use_sql && opts.sql) {
            tables = _.isArray(opts.sql) ? opts.sql : [ opts.sql ];
        }
        else if (opts.table) {
            tables = [ opts.table ];
        }
        else {
            throw new Error("No table given and sql disabled");
        }

        var mml = {};
        mml.srs = '+init=epsg:' + grainstore_map.srid;
        mml.Layer = [];

        for (var i = 0; i < tables.length; ++i) {
            var table = tables[i];

            var datasource = _.clone(grainstore_datasource);
            datasource.table = table;
            datasource.dbname = opts.dbname;

            var layer = {};
            if (tables.length == 1 && opts.table) {
                layer.id = opts.table;
                layer.class = opts.table; //RW Added
            } else {
                layer.id = 'layer' + i;
                layer.class = layer.id;
            }

            layer.name = opts.layerName || layer.id; //RW
            layer.srs = '+init=epsg:' + grainstore_datasource.srid;
            layer.Datasource = datasource;

            mml.Layer.push(layer);

        }

        if (interactivity) {
            if (interactivity[interactivity_layer]) {
                if (_.isString(interactivity[interactivity_layer])) {
                    mml.interactivity = {
                        layer: mml.Layer[interactivity_layer].id,
                        fields: interactivity[interactivity_layer].split(',')
                    };
                } else {
                    throw new Error("Unexpected interactivity format: " + interactivity[interactivity_layer]);
                }
            }
        }
        ;

        return mml;
    };

    //Added by RW
    //Strip <Layer> and <Datasource> tags out of the mml.  These will be added by Mapnik dynamically.
    me.stripLayer = function(mml, callback){
         if(!mml) callback(null, "");

        //Remove Layer and Datasource tags.
        var layerStart = mml.indexOf("<Layer");
        var layerEnd= -1, outMML = "";
        if(layerStart > -1) {
            layerEnd = mml.indexOf("</Layer>");
            outMML = mml.substring(0, layerStart);
            outMML += mml.substring(layerEnd + 8, mml.length);
        }
        else{
            outMML = mml;
        }

         callback(null, outMML);
    }




    var style_override = opts.style ? opts.style : null;
    var style_version_override = opts.style_version ? opts.style_version : default_style_version;
    var interactivity = opts.interactivity;
    if (_.isString(interactivity)) {
        interactivity = [ interactivity ];
    } else if (interactivity) {
        for (var i = 0; i < interactivity.length; ++i) {
            if (interactivity[i] && !_.isString(interactivity[i])) {
                init_callback(new Error("Invalid interactivity value type for layer " + i + ": " + typeof(interactivity[i])));
                return;
            }
        }
    }
    var interactivity_layer = opts.layer || 0;
    if (parseInt(interactivity_layer) != interactivity_layer) {
        init_callback(new Error("Invalid (non-integer) layer value type: " + interactivity_layer));
        return;
    }

    // Redis storage keys
    var token, base_store_key, extended_store_key;

    // Millstone configuration
    //
    // Resources are shared between all maps, and ensured
    // to be localized on every call to the "toXML" method.
    //
    // Caller should take care of purging unused resources based
    // on its usage of the "toXML" method.
    //
    var millstone_cachedir = extra_config.cachedir;
    var millstone_base_options = {
        base: millstone_cachedir + '/base',
        cache: millstone_cachedir + '/cache'
    };

    // only allow broken css when no overridden style
    // was passed
    var allow_broken_css = style_override ? false : true;

    //trigger constructor
    me.init(init_callback, allow_broken_css);

    return me;

}

module.exports = MMLBuilder;
