var semver = require('semver');
var _ = require('underscore');

module.exports = function() {}

function convert_20_to_21(style, from, to)
{
  // strip comments from styles
  // NOTE: these regexp will make a mess when comment-looking strings are put
  //       in quoted strings. We take the risk, assuming it'd be very uncommon
  //       to find literal in styles anyway...
//console.log("X: " + style);
  style = style.replace(RegExp('(/\\*[^\*]*\\*/)|(//.*\n)', 'g'), '');
//console.log("Y: " + style);

  var global_marker_directives = [];
  var global_has_marker_directives = false;
  var re = RegExp('([^{]*){([^}]*)}', 'g');
  var newstyle = style.replace(re, function(mtc, cond, stl) {
    // trim blank spaces (but not newlines) on both sides
    stl = stl.replace(/^[ \t]*/, '').replace(/[\t ]*$/, '');
    // add ending newline, if missing
    if ( /[^\s]/.exec(stl) && ! /;\s*$/.exec(stl) ) stl += ';';
    var append = '';

    var is_global_block = ! /]\s*$/.exec(cond);
    var has_marker_directives = global_has_marker_directives;
    var re = RegExp('(marker-[^\s:]*):\s*([^;}]*)', "ig");
    var marker_directives = is_global_block ? global_marker_directives : _.defaults([], global_marker_directives);
    var stl = stl.replace(re, function(m, l, v) {
      l = l.toLowerCase();
      if ( ! marker_directives.hasOwnProperty(l) ) {
        marker_directives[l] = v;
      }
      has_marker_directives = true;
      if ( is_global_block ) global_has_marker_directives = true;

      // In mapnik-2.0.x, marker-opacity only set opacity of the marker
      // fill (but not stroke). This is equivalent to the mapnik-2.1.x
      // directive ``marker-fill-opacity``. We want to translate the
      // directive name beause ``marker-opacity`` also sets stroke
      // opacity with mapnik-2.1.x.
      //
      // See https://github.com/Vizzuality/grainstore/issues/40
      //
      m = m.replace(RegExp('marker-opacity', 'i'), 'marker-fill-opacity');

      return m;
    });

    // We want to match "line-anything" but not "-line-anything"
    // See https://github.com/Vizzuality/grainstore/issues/37
    var has_line_directives = /[\s{;]line-[^\s:]*\s*:/.exec(' '+stl);
    var has_poly_directives = /[\s{;]polygon-[^\s:]*\s*/.exec(' '+stl);

    // Double marker-width and marker-height but not if source is '2.0.1'
    // TODO: put within has_marker_directives
    if ( from != '2.0.1' ) {
      var re = RegExp('marker-(width|height)[\t\n ]*:[\t\n ]*(["\']?)([^\'";}]*)["\']?\\b', 'g');
      stl = stl.replace(re, function(m, l, q, v) {
        return 'marker-' + l + ':' + q + (v*2);
      });
    }

    //console.log("Has marker directives: " + has_marker_directives );

    // Set marker-related defaults but only if any
    // "marker-xxx" directive is given
    if ( has_marker_directives ) {

      // For points, set:
      //  marker-placement:point (in 2.1.0 marker-placement:line doesn't work with points)
      //  marker-type:ellipse (in 2.0.0 marker-type:arrow didn't work with points)
      append += ' ["mapnik::geometry_type"=1] { marker-placement:point; marker-type:ellipse; }';

      var line_poly_override = ' ["mapnik::geometry_type">1] { ';

      // Set marker-placement:line for lines and polys
      // but only if a marker-placement isn't already present
      if ( ! marker_directives['marker-placement'] ) {
        line_poly_override += 'marker-placement:line; ';
      }

      var has_arrow_marker = ( marker_directives['marker_type'] == 'arrow' );

      // Set to marker-type:arrow for lines and polys
      // but only if a marker-type isn't already present and
      // the marker-placement directive requests a point (didn't work in 2.0)
      if ( ! marker_directives['marker-type'] && marker_directives['marker-placement'] != 'point' ) {
        line_poly_override += 'marker-type:arrow; ';
        has_arrow_marker = true;
      }

      // See https://github.com/mapnik/mapnik/issues/1591#issuecomment-10740221
      if ( has_arrow_marker ) {
        line_poly_override += 'marker-transform:scale(.5, .5); ';
      }

      // If the marker-placement directive requested a point we'll use ellipse marker-type
      // as 2.0 didn't work with arrows and points..
      if ( marker_directives['marker-placement'] == 'point' ) {
        line_poly_override += 'marker-type:ellipse; ';
      }

      // 2.0.0 did not clip geometries before sending 
      // to style renderer
      line_poly_override += 'marker-clip:false; ';

      line_poly_override += '}';

      append += line_poly_override;

      if ( semver.satisfies(to, "~2.1.1") ) {
        // See https://github.com/Vizzuality/grainstore/issues/36
        append += ' marker-multi-policy:whole;';
      }
    }

//console.log("STYLE: [" + style + "]");
//console.log("  STL: [" + stl + "]");

    var newblock = cond + '{ ' + stl + append + ' }';

    return newblock;
  });

  //console.log("PRE:"); console.log(style);
  style = newstyle;
  //console.log("POS:"); console.log(style);

  return style
};

var re_MapnikGeometryType = RegExp(/\bmapnik-geometry-type\b/g);
function convert_MapnikGeometryType(style) {
  return style.replace(re_MapnikGeometryType, '"mapnik::geometry_type"');
}

function noop(style) { return style; }

var tp = {};
tp['2.0.0'] = {
 // NOTE: 2.0.1 intentionally left blank, no path to go there
 '2.0.2': noop,
 '2.0.3': noop,
 '2.0.4': noop,
 '2.1.0': convert_20_to_21,
 '2.1.1': convert_20_to_21,
};
tp['2.0.2'] = tp['2.0.3'] = tp['2.0.4'] = tp['2.0.0'];

tp['2.0.1'] = {
  // NOTE: not allowing path from 2.0.1 to ~2.0.2 as it would
  //       require to half marker-width and marker-height
  '2.1.0': convert_20_to_21
}

tp['2.1.0'] = {
 '2.1.1': noop,
 '2.2.0': noop
};
tp['2.1.1'] = tp['2.1.0'];

var o = module.exports.prototype;

o.setLayerName = function(css, layername) {
  var ret = css.replace(/#[^\s[{;:]+\s*([:\[{])/g, '#' + layername + ' $1');
  //console.log("PRE:"); console.log(css);
  //console.log("POS:"); console.log(ret);
  return ret;
};

// @param style CartoCSS 
// @param from source CartoCSS/Mapnik version
// @param to target CartoCSS/Mapnik version
o.transform = function(style, from, to) {

  //console.log("From " + from + " to " + to);

  // For backward compatibility
  if ( semver.satisfies(from, '<2.2.0') ) {
    style = convert_MapnikGeometryType(style);
  }

  while ( from != to ) {
    var converter = null;
    var nextTarget = null;
    // 1. Find entry for 'from'
    if ( tp.hasOwnProperty(from) ) {
      var ct = _.keys(tp[from]).sort(semver.compare);
      for (var i = ct.length; i; i--) {
        var t = ct[i-1];
        //console.log("Testing " + t);
        if ( semver.satisfies(t, '>'+to) ) {
          //console.log(t + " is bigger than " + to);
          continue;
        }
        //console.log(t + " is ok with " + to);
        converter = tp[from][t];
        nextTarget = t;
        break;
      }
    }
    if ( ! converter ) {
      throw new Error('No CartoCSS transform path from '
                         + from + ' to ' + to);
    }

    //console.log("Converting from " + from + " to " + nextTarget + " (should reach " + to + ")");

    style = converter(style, from, nextTarget);
    from = nextTarget;
  }

  //console.log("From " + from + " to " + to + " COMPLETED");

  return style;
};

delete o;

