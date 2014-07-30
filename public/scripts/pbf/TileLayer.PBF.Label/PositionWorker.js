/**
 * Created by Nicholas Hallahan <nhallahan@spatialdev.com>
 *       on 7/11/14.
 */

/**
 * Using the JavaScript Topology Suite to detect unions of polygons.
 */
importScripts('../jsts/javascript.util.js', '../jsts/jsts-src.js');

reader = new jsts.io.GeoJSONReader();
parser = new jsts.io.GeoJSONParser();

onmessage = function(evt) {
  var msg = evt.data;
  for (var key in msg) {
    var fn = calcPos[key];
    if (typeof fn === 'function') fn(msg);
  }
};

/**
 * Computes the position for a label depending on
 * the data type...
 */
calcPos = {
  tilePoints: function(msg) { /* TODO */ },
  tileLines: function(msg)  { /* TODO */ },

  tilePolys: function(msg) {
    var tilePolys = msg.tilePolys;
    var tileCls = classifyAndProjectTiles(tilePolys, msg.extent, msg.tileSize);
    var largestPoly = mergeAndFindLargestPolygon(tilePolys, tileCls);
    // if there are no polygons in the tiles, we dont have a center
    if (!largestPoly.tid) {
      postMessage({status: 'NO_POLY_IN_TILES'});
    }
    var center = centroid(tilePolys[largestPoly.tid][largestPoly.idx]);
    if (!center || !center.x || !center.y) {
      center = {
        status: 'ERR',
        description: 'No centroid calculated.'
      }
    } else {
      center.status = 'OK';
    }
    postMessage(center);
  }
};

/**
 * Goes through each tile and and classifies the paths...
 *
 * @param tiles
 * @param extent
 */
function classifyAndProjectTiles(tilePaths, extent, tileSize) {
  var tileCls = {};
  for (var id in tilePaths) {
    var t = tilePaths[id];
    var cls = classifyAndProject(t, extent, tileSize, id);
    tileCls[id] = cls;
  }
  return tileCls;
}

/**
 * Checks through the coordinate arrays and classifies if they
 * leave the bounds of the extent and where.
 *
 * @param coordsArray
 */
function classifyAndProject(coordsArray, extent, tileSize, id) {
  // we need to know the tile address to project the coords
  var zxy = id.split(':');
  var x = parseInt(zxy[1]);
  var y = parseInt(zxy[2]);

  // the classification the the coords (what tile the intersect with)
  var cls = {
    internal: [],
    topLeft: [],
    left: [],
    bottomLeft: [],
    bottom: [],
    bottomRight: [],
    right: [],
    topRight: [],
    top: []
  };

  for (var i = 0, len = coordsArray.length; i < len; i++) {
    var coords = coordsArray[i];
    var overlapNeighbors = {};
    var pathInExtentAtLeastOnce = false;

    for (var j = 0, len2 = coords.length; j < len2; j++) {
      var coord = coords[j];
      var neighbor = checkCoordExtent(coord, extent);

      // project the coord to the pixel space of the world (Spherical Mercator for Zoom Level)
      coords[j] = project(coord, x, y, extent, tileSize);

      // coord is outside tile
      if (neighbor) {
        overlapNeighbors[neighbor] = true;
      }
      // coord is inside tile
      else {
        pathInExtentAtLeastOnce = true;
      }
    }

    // path is entirely inside of tile
    if (Object.keys(overlapNeighbors).length === 0) {
      cls.internal.push(i);
    }
    // path leaves the tile
    else {
      for (var neighbor in overlapNeighbors) {
        // We don't want paths that are never in the extent at all...
        if (pathInExtentAtLeastOnce) {
          cls[neighbor].push(i);
        }
      }
    }
  }
  return cls;
}

/**
 * Checks to see if the path has left the extent of the vector tile.
 * If so, we need to continue creating the polygon with coordinates
 * from a neighboring tile...
 *
 * @param pbfFeature
 * @param ctx
 * @param coords
 */
function checkCoordExtent(coord, extent) {
  var x = coord.x;
  var y = coord.y;

  // outside left side
  if (x < 0) {
    // in top left tile
    if (y < 0) {
      return 'topLeft';
    }
    // in bottom left tile
    if (y > extent) {
      return 'bottomLeft';
    }
    // in left tile
    return 'left';
  }

  // outside right side
  if (x > extent) {
    // in top right tile
    if (y < 0) {
      return 'topRight';
    }
    // in bottom right tile
    if (y > extent) {
      return 'bottomRight';
    }
    // in right tile
    return 'right';
  }

  // outside top side
  if (y < 0) {
    return 'top';
  }

  // outside bottom side
  if (y > extent) {
    return 'bottom';
  }

  return null;
}

var neighborFns = {
  top: function(id) {
    var zxy = id.split(':');
    return zxy[0] + ':' + zxy[1] + ':' + (parseInt(zxy[2]) - 1);
  },
  topLeft: function(id) {
    var zxy = id.split(':');
    return zxy[0] + ':' + (parseInt(zxy[1]) - 1) + ':' + (parseInt(zxy[2]) - 1);
  },
  left: function(id) {
    var zxy = id.split(':');
    return zxy[0] + ':' + (parseInt(zxy[1]) - 1) + ':' + zxy[2];
  },
  bottomLeft: function(id) {
    var zxy = id.split(':');
    return zxy[0] + ':' + (parseInt(zxy[1]) - 1) + ':' + (parseInt(zxy[2]) + 1);
  },
  bottom: function(id) {
    var zxy = id.split(':');
    return zxy[0] + ':' + zxy[1] + ':' + (parseInt(zxy[2]) + 1);
  },
  bottomRight: function(id) {
    var zxy = id.split(':');
    return zxy[0] + ':' + (parseInt(zxy[1]) + 1) + ':' + (parseInt(zxy[2]) + 1);
  },
  right: function(id) {
    var zxy = id.split(':');
    return zxy[0] + ':' + (parseInt(zxy[1]) + 1) + ':' + zxy[2];
  },
  topRight: function(id) {
    var zxy = id.split(':');
    return zxy[0] + ':' + (parseInt(zxy[1]) + 1) + ':' + (parseInt(zxy[2]) - 1);
  }
};

/**
 * Projects a vector tile point to the Spherical Mercator pixel space for a given zoom level.
 *
 * @param vecPt
 * @param tileX
 * @param tileY
 * @param extent
 * @param tileSize
 */
function project(vecPt, tileX, tileY, extent, tileSize) {
  var div = extent / tileSize;
  var xOffset = tileX * tileSize;
  var yOffset = tileY * tileSize;
  return {
    x: Math.floor(vecPt.x / div + xOffset),
    y: Math.floor(vecPt.y / div + yOffset)
  };
}

var inverseSides = {
  top: 'bottom',
  topLeft: 'bottomRight',
  left: 'right',
  bottomLeft: 'topRight',
  bottom: 'top',
  bottomRight: 'topLeft',
  right: 'left',
  topRight: 'bottomLeft'
};

function mergeAndFindLargestPolygon(tilePolys, tileCls) {
  var largestPoly = {
    tid: null, // tile id to get the tile in tilePolys
    idx: null, // index of array of polys in tile
    area: null // area of the poly
  };
  for (var id in tileCls) {
    var cCls = tileCls[id];     // center tile classifications
    var cPolys = tilePolys[id]; // center tile polygons
    for (var edge in neighborFns) {
      var cClsEdgeArr = cCls[edge]; // poly idxs for center edge classification
      // continue if there are no overlapping polys on a given edge...
      if (cClsEdgeArr.length === 0) {
        continue;
      }
      // polygons internal to a tile do not need to be merged
      if (edge === 'internal') {
        for (var i = 0, len = cClsEdgeArr.length; i < len; i++) {
          findLargestPoly(largestPoly, tilePolys, id, cClsEdgeArr[i]);
        }
      }
      var nId = neighborFns[edge](id); // neighboring tile id
      var nCls = tileCls[nId];         // neighboring tile classifications
      var nPolys = tilePolys[nId];     // neighboring tile polygons
      // If we have a neighboring tile, we get the overlapping polygons that correspond with the center tile.
      if (nCls) {
        var inv = inverseSides[edge];

        // union the overlapping polygons
        for (var j = 0, len2 = cClsEdgeArr.length; j < len2; j++) {
          var cPolyIdx = cClsEdgeArr[j]; // a given center poly idx that overlaps the edge we are examining
          // We are just going to do 1 poly from center tile at a time so we can keep track of the one we are actually doing the merge on...
          var cEdgePolys = polygonSetToGeoJson(cPolys, [cPolyIdx]); // 1 poly
          var nEdgePolys = polygonSetToGeoJson(nPolys, nCls[inv]);  // 1 or more polys

          var ctrJsts = reader.read(cEdgePolys);
          var nbrJsts = reader.read(nEdgePolys);

          try {
            // https://www.youtube.com/watch?v=RdSmokR0Enk
            var union = ctrJsts.union(nbrJsts);

            // the new merged polygon
            var unionPoly = union.shell.points;

            // Neighboring tile's inverse edge should be empty,
            // because the corresponding shape has been merged.
            nCls[inv] = [];

            // Replace the polygon in the center tile with the new merged polygon
            // so other tiles can merge this if needed.
            cPolys[cPolyIdx] = unionPoly;

          } catch (e) {
            //NH TODO: WHY?
            postMessage({
              status: 'WARN',
              details: 'union failed',
              ctrJsts:ctrJsts,
              nbrJsts:nbrJsts,
              cEdgePolys:cEdgePolys,
              nEdgePolys:nEdgePolys,
              e:e
            });
          }

          // Regardless of whether we unioned or not, we want to check to see if this polygon is the largest...
          findLargestPoly(largestPoly, tilePolys, id, cPolyIdx);
        }
      }
    }
  }
  return largestPoly;
}

/**
 * Converts the array of arrays of {x,y} points to GeoJSON.
 *
 * Note that the GeoJSON we are using is in the projected pixel
 * space. Normally GeoJSON is WGS84, but we don't care, because
 * we are just doing a union topology check.
 *
 * @param polys
 * @returns {{type: string, coordinates: Array}}
 */
function polygonSetToGeoJson(polys, idxArr) {
  var coordinates = [];
  var geojson = {
    type: 'MultiPolygon',
    coordinates: coordinates
  };
  for (var i = 0, len = idxArr.length; i < len; i++) {
    var idx = idxArr[i];
    var poly = polys[idx];
    var geoPoly = [];
    for (var j = 0, len2 = poly.length; j < len2; j++) {
      var pt = poly[j];
      var geoPt = [pt.x, pt.y];
      geoPoly.push(geoPt);
    }
    geoPoly = [geoPoly]; // its an array in array, other items in the array would be rings
    coordinates.push(geoPoly);
  }
  return geojson;
}


//  http://en.wikipedia.org/wiki/Centroid#Centroid_of_polygon

function area(poly) {
  var area = 0;
  var len = poly.length;
  for (var i = 0, j = len - 1; i < len; j=i, i++) {
    var p1 = poly[j];
    var p2 = poly[i];

    area += p1.x * p2.y - p2.x * p1.y;
  }

  return Math.abs(area / 2);
}

/*
 NH TODO: We are indeed getting the centroid, but ideally we
 want to check if the centroid is actually within the polygon
 for the polygons that bend like a boomarang. If it is outside,
 we need to nudge it over until it is inside...
 */
function centroid(poly) {
  var len = poly.length;
  var x = 0;
  var y = 0;
  for (var i = 0, j = len - 1; i < len; j=i, i++) {
    var p1 = poly[j];
    var p2 = poly[i];
    var f = p1.x * p2.y - p2.x * p1.y;
    x += (p1.x + p2.x) * f;
    y += (p1.y + p2.y) * f;
  }
  f = area(poly) * 6;

  return {
    x: Math.abs(x/f),
    y: Math.abs(y/f)
  };
}

function findLargestPoly(largestPoly, tilePolys, tid, idx) {
  if (!largestPoly.tid) {
    largestPoly.tid = tid;
    largestPoly.idx = idx;
    largestPoly.area = area(tilePolys[tid][idx]);
    return largestPoly;
  }
  var largestArea = largestPoly.area;
  var polyArea = area(tilePolys[tid][idx]);

  if (polyArea > largestArea) {
    largestPoly.tid = tid;
    largestPoly.idx = idx;
    largestPoly.area = polyArea;
  }

  return largestPoly;
}
