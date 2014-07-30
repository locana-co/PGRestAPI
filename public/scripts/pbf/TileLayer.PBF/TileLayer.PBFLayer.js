/**
 * Created by Ryan Whitley on 5/17/14.
 */
/** Forked from https://gist.github.com/DGuidi/1716010 **/

L.TileLayer.PBFLayer = L.TileLayer.Canvas.extend({

  options: {
    debug: false,
    isHiddenLayer: false,
    getIDForLayerFeature: function() {},
    tileSize: 256
  },

  _featureIsClicked: {},

  _isPointInPoly: function(pt, poly) {

	if(poly && poly.length) {
   for (var c = false, i = -1, l = poly.length, j = l - 1; ++i < l; j = i)
      ((poly[i].y <= pt.y && pt.y < poly[j].y) || (poly[j].y <= pt.y && pt.y < poly[i].y))
      && (pt.x < (poly[j].x - poly[i].x) * (pt.y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x)
      && (c = !c);
    return c;
	}
  },

  initialize: function(pbfSource, options) {
    var self = this;
    self.pbfSource = pbfSource;
    L.Util.setOptions(this, options);

    this._canvasIDToFeaturesForZoom = {};
    this.visible = true;
    this.features = { zoom: {}};
    this.featuresWithLabels = [];
  },

  drawTile: function(canvas, tilePoint, zoom) {

    var ctx = {
      canvas: canvas,
      tile: tilePoint,
      zoom: zoom,
      tileSize: this.options.tileSize
    };

    ctx.id = getContextID(ctx);

    if (!this._canvasIDToFeaturesForZoom[ctx.id]) {
      this._canvasIDToFeaturesForZoom[ctx.id] = {};
      this._canvasIDToFeaturesForZoom[ctx.id]['features'] = [];
      this._canvasIDToFeaturesForZoom[ctx.id]['canvas'] = canvas;
    }
    if (!this.features) {
      this.features = {};
    }



    //this._resetCanvasIDToFeaturesForZoomState(ctx.id, canvas, zoom);
  },

  _draw: function(ctx) {
    //Draw is handled by the parent PBFSource object
  },

  parseVectorTileLayer: function(vtl, ctx) {
    var self = this;
    var tilePoint = ctx.tile;
    ctx.canvas = self._tiles[tilePoint.x + ":" + tilePoint.y];

    //Clear tile -- TODO: Add flag so this only happens when a layer is being turned back on after being hidden
    if(ctx.canvas) ctx.canvas.width = ctx.canvas.width;

    var features = vtl.parsedFeatures;
    for (var i = 0, len = features.length; i < len; i++) {
      var vtf = features[i] //vector tile feature
      vtf.layer = vtl;

      /**
       * Apply filter on feature if there is one. Defined in the options object
       * of TileLayer.PBFSource.js
       */
      var filter = self.options.filter;
      if (typeof filter === 'function') {
        if ( filter(vtf, ctx) === false ) return;
      }

      var uniqueID = self.options.getIDForLayerFeature(vtf);
      var pbffeature = self.features[uniqueID];

      //Create a new PBFFeature if one doesn't already exist for this feature.
      if (!pbffeature) {
        //Get a style for the feature - set it just once for each new PBFFeature
        var style = self.styleFor(vtf);

        //create a new feature
        self.features[uniqueID] = pbffeature = new PBFFeature(self, vtf, ctx, uniqueID, style, this._map);
        if (typeof style.label === 'function') {
          self.featuresWithLabels.push(pbffeature);
        }
      } else {
        //Add the new part to the existing feature
        pbffeature.addTileFeature(vtf, ctx);
      }

      //Associate & Save this feature with this tile for later
      self._canvasIDToFeaturesForZoom[ctx.id]['features'].push(pbffeature);

      //Subscribe to style changes for feature
      pbffeature.on("styleChanged", function(parts) {
        //Redraw the whole tile, not just this vtf
        var zoom = self._map._zoom;

        for (var id in parts[zoom]) {
          var part = parts[zoom][id];
          //Clear the tile
          self.clearTile(part.ctx);

          //Redraw the tile
          self.redrawTile(id, part.ctx.zoom);
        }

      });

      //Tell it to draw
      pbffeature.draw(vtf, ctx);
    }

    for (var j = 0, len = self.featuresWithLabels.length; j < len; j++) {
      var feat = self.featuresWithLabels[j];
      debug.feat = feat;

    }

  },

  // NOTE: a placeholder for a function that, given a feature, returns a style object used to render the feature itself
  styleFor: function(feature) {
    // override with your code
  },

  //This is the old way.  It works, but is slow for mouseover events.  Fine for click events.
  handleClickEvent: function(evt, cb) {
    //Click happened on the GroupLayer (Manager) and passed it here
    var tileID = evt.tileID.split(":").slice(1, 3).join(":");
    var canvas = this._tiles[tileID];
    if(!canvas) (cb(evt)); //break out
    var x = evt.layerPoint.x - canvas._leaflet_pos.x;
    var y = evt.layerPoint.y - canvas._leaflet_pos.y;

    var tilePoint = {x: x, y: y};
    var features = this._canvasIDToFeaturesForZoom[evt.tileID].features;
    for (var i = 0; i < features.length; i++) {
      var feature = features[i];
      var paths = feature.getPathsForTile(evt.tileID, this._map.getZoom());
      for (var j = 0; j < paths.length; j++) {
        if (this._isPointInPoly(tilePoint, paths[j])) {
          evt.feature = feature;
          cb(evt);
          return;
        }
      }
    }
    //no match
    //return evt with empty feature
    evt.feature = null;
    cb(evt);
  },

  clearTile: function(ctx) {
    ctx.canvas.width = ctx.canvas.width;
  },

  redrawTile: function(canvasID, zoom) {
    //Get the features for this tile, and redraw them.
    var features = this._canvasIDToFeaturesForZoom[canvasID]['features'];
    for (var i = 0; i < features.length; i++) {
      var feature = features[i];
      var tileInfo = feature.getTileInfo(canvasID, zoom);
      feature.draw(tileInfo.vtf, tileInfo.ctx);
    }
  },

  _resetCanvasIDToFeaturesForZoomState: function(canvasID, canvas, zoom) {

    this._canvasIDToFeaturesForZoom[canvasID] = {};
    this._canvasIDToFeaturesForZoom[canvasID]['features'] = [];
    this._canvasIDToFeaturesForZoom[canvasID]['canvas'] = canvas;

  }
});

function getContextID(ctx) {
  return [ctx.zoom, ctx.tile.x, ctx.tile.y].join(":");
}
