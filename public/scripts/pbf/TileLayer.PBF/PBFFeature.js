/**
 * Created by Ryan Whitley, Daniel Duarte, and Nicholas Hallahan
 *    on 6/03/14.
 */

function PBFFeature(pbfLayer, vtf, ctx, id, style) {
  if (!vtf) return null;

  for (var key in vtf) {
    this[key] = vtf[key];
  }

  this.pbfLayer = pbfLayer;
  this.pbfSource = pbfLayer.pbfSource;
  this.map = pbfLayer.pbfSource._map;

  this.id = id;

  // how much we divide the coordinate from the vector tile
  this.divisor = vtf.extent / ctx.tileSize;
  this.extent = vtf.extent;
  this.tileSize = ctx.tileSize;

  this.isSelected = false;

  //An object to store the paths and contexts for this feature
  this.tiles = {};

  if (!this.tiles[ctx.zoom]) this.tiles[ctx.zoom] = {};

  this.style = style;

  this._canvasIDToFeaturesForZoom = {};
  this._eventHandlers = {};

  //Add to the collection
  this.addTileFeature(vtf, ctx);

  if (typeof style.label === 'function') {
    this.featureLabel = this.pbfSource.label.createFeature(this);
  }
}

PBFFeature.prototype.draw = function(vtf, ctx) {
  //vtf.coordinates = vtf.loadGeometry();

  switch (vtf.type) {
    case 1: //Point
      this._drawPoint(ctx, vtf.coordinates, this.style);
      break;

    case 2: //LineString
      this._drawLineString(ctx, vtf.coordinates, this.style);
      break;

    case 3: //Polygon
      this._drawPolygon(ctx, vtf.coordinates, this.style);
      break;

    default:
      throw new Error('Unmanaged type: ' + vtf.type);
  }

};

PBFFeature.prototype.getPathsForTile = function(canvasID, zoom) {
  //Get the info from the parts list
  return this.tiles[zoom][canvasID].paths;
};

//Given a specific tile's geometry array, see if there is both a geometry that covers the entire tile, and also other geometry.
//if this is the case, then the geom that covers the entire tile probably shouldn't be shown.
//This does the wrong thing.  This makes the map only render the portion of the tile that is the donut.  The rest of the paths for that tile are empty.
//Fix it.
function removeDonutsFromGeomArray(geomArray) {
  if (geomArray.length <= 1) {
    return geomArray;
  }
  else {
    //More than one geom for this tile.  See if any are full coverage
    //var extremeX, extremeY, bufferSize, magicNumber = 16;
    var coords = [];

    for (var gidx in geomArray) {
      var geom = geomArray[gidx];

      //Assumption: Full coverage geometries aren't more than 6 vertices
      //if more than 6, ignore
      if (geom.length <= 6 && geom.length > 3) {
        for (var pidx in geom) {
          var point = geom[pidx];

          //The tiles i've seen that are completely covered, but also have holes have a geometry part that contains 6 vertices (some are duplicated for some reason)
          //They look like { x: -128, y: 4224 }, { x: -128, y: -128 }, {x: -128, y: -128 }, {x: 4224, y: -128 }, { x: 4224, y: 4224 }, { x: -128, y: 4224}
          //This will probably change based on the 'buffer' specified when the vector tile cache was created.  In this case the buffer is 8px (Mapnik grabs 8 px of geometry past the tile boundaries).
          //Combined with the magic number of 16 used to inflate all of the tile coordinates, this results in 8 * 16 (128) of extra margin around the outside of the tile, which is why we have coordinates of -128 and 4224 (4224 = 256 * 16).
          //We don't know the value of the buffer (I don't think) since it is a property set when the tiles are created.
          //So, just look for sets of values outside of 4096 (which is 256 * 16).  However, this will need to be updated as the magic 16 number can also be changed

//          if (pidx == 0) {
//            extremeX = point.x;
//            extremeY = point.y;
//
//          }
//          else {
//            //In a full-coverage array, all of the values should be the tile size * magicNumber (16) + the buffer size * 16.  So they should all equal all of the max possible values for that buffer size.
//            if(point.x)
//          }

          //Just keep track of the ABS of the coords. at the end, there should only be 2 if this is a full coverage tile
          if (coords.indexOf(point.x) == -1) coords.push(point.x);
          if (coords.indexOf(point.y) == -1) coords.push(point.y);
        }

        //Now, if the coords array is of length 2, AND there are other geometries defined, then remove this from the geom array
        if (coords.length == 2)  geomArray.splice(gidx, 1);
      }
    }

    return geomArray;
  }
}

PBFFeature.prototype.addTileFeature = function(vtf, ctx) {

  //Store the parts of the feature for a particular zoom level
  var zoom = ctx.zoom;
  if (!this.tiles[ctx.zoom]) this.tiles[ctx.zoom] = {};

  //Store the important items in the parts list
  this.tiles[zoom][ctx.id] = {
    ctx: ctx,
    vtf: vtf,
    paths: []
  };
};


PBFFeature.prototype.getTileInfo = function(canvasID, zoom) {
  //Get the info from the parts list
  return this.tiles[zoom][canvasID];
};

PBFFeature.prototype.getContextID = function(ctx) {
  return [ctx.zoom, ctx.tile.x, ctx.tile.y].join(":");
};

PBFFeature.prototype.setStyle = function(style) {
  //Set this feature's style and redraw all canvases that this thing is a part of
  this.style = style;
  this._eventHandlers["styleChanged"](this.tiles);
};

PBFFeature.prototype.on = function(eventType, callback) {
  this._eventHandlers[eventType] = callback;
};

PBFFeature.prototype._drawPoint = function(ctx, coordsArray, style) {
  if (!style) return;

  var part = this.tiles[ctx.zoom][ctx.id];

  var p = this._tilePoint(coordsArray[0][0]);
  var c = ctx.canvas;
  var g = c.getContext('2d');
  g.beginPath();
  g.fillStyle = style.color;
  g.arc(p.x, p.y, style.radius, 0, Math.PI * 2);
  g.closePath();
  g.fill();
  g.restore();
  part.paths.push([p]);
};

PBFFeature.prototype._drawLineString = function(ctx, coordsArray, style) {
  if (!style) return;

  var g = ctx.canvas.getContext('2d');
  g.strokeStyle = style.color;
  g.lineWidth = style.size;
  g.beginPath();

  var projCoords = [];
  var part = this.tiles[ctx.zoom][ctx.id];

  for (var gidx in coordsArray) {
    var coords = coordsArray[gidx];

    for (i = 0; i < coords.length; i++) {
      var method = (i === 0 ? 'move' : 'line') + 'To';
      var proj = this._tilePoint(coords[i]);
      projCoords.push(proj);
      g[method](proj.x, proj.y);
    }
  }

  g.stroke();
  g.restore();

  part.paths.push(projCoords);
};

PBFFeature.prototype._drawPolygon = function(ctx, coordsArray, style) {
  if (!style) return;
  if (!ctx.canvas) return;

  var g = ctx.canvas.getContext('2d');
  var outline = style.outline;
  g.fillStyle = style.color;
  if (outline) {
    g.strokeStyle = outline.color;
    g.lineWidth = outline.size;
  }
  g.beginPath();

  var projCoords = [];
  var part = this.tiles[ctx.zoom][ctx.id];

  var featureLabel = this.featureLabel;
  if (featureLabel) {
    featureLabel.addTilePolys(ctx, coordsArray);
  }

  for (var gidx = 0, len = coordsArray.length; gidx < len; gidx++) {
    var coords = coordsArray[gidx];

    for (var i = 0; i < coords.length; i++) {
      var coord = coords[i];
      var method = (i === 0 ? 'move' : 'line') + 'To';
      var proj = this._tilePoint(coords[i]);
      projCoords.push(proj);
      g[method](proj.x, proj.y);
    }
  }

  g.closePath();
  g.fill();
  if (outline) {
    g.stroke();
  }

  part.paths.push(projCoords);

};

/**
 * Takes a coordinate from a vector tile and turns it into a Leaflet Point.
 *
 * @param ctx
 * @param coords
 * @returns {eGeomType.Point}
 * @private
 */
PBFFeature.prototype._tilePoint = function(coords) {
  return new L.Point(coords.x / this.divisor, coords.y / this.divisor);
};


function isClockwise(p){
  var sum = 0;
  for (var i = 1; i < p.length; i++) {
    sum += (p[i].x - p[i - 1].x) * (p[i].y + p[i - 1].y);
  }
  return (sum > 0);
}



