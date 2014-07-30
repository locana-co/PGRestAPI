/**
 * Created by ryanwhitley on 5/17/14.
 */
/** Forked from https://gist.github.com/DGuidi/1716010 **/

L.TileLayer.PBFSource = L.TileLayer.Canvas.extend({

  options: {
    debug: false,
    url: "", //URL TO Vector Tile Source,
    clickableLayers: [], //which layers inside the vector tile should have click events?
    getIDForLayerFeature: function() {},
    tileSize: 256
  },
  layers: {}, //Keep a list of the layers contained in the PBFs
  processedTiles: {}, //Keep a list of tiles that have been processed already
  _eventHandlers: {},
  styleFor: function() {},


  initialize: function(options) {
    L.Util.setOptions(this, options);

    //a list of the layers contained in the PBFs
    this.layers = {};

    // tiles currently in the viewport
    this.activeTiles = {};

    // thats that have been loaded and drawn
    this.loadedTiles = {};
  },

  onAdd: function(map) {
    var self = this;
    L.TileLayer.Canvas.prototype.onAdd.call(this, map);

//    determineActiveTiles(self, map);
//    map.on('moveend', function(evt) {
//      determineActiveTiles(self, map);
//    });

    this.label = new Label(map, this, {});
  },

  drawTile: function(canvas, tilePoint, zoom) {
    var ctx = {
      id: [zoom, tilePoint.x, tilePoint.y].join(":"),
      canvas: canvas,
      tile: tilePoint,
      zoom: zoom,
      tileSize: this.options.tileSize
    };

    var id = ctx.id = getContextID(ctx);
    this.activeTiles[id] = ctx;

    if(!this.processedTiles[ctx.zoom]) this.processedTiles[ctx.zoom] = {};

    if (this.options.debug) {
      this._drawDebugInfo(ctx);
    }
    this._draw(ctx);
  },

  setOpacity:function(opacity) {
	  this._setVisibleLayersStyle('opacity',opacity);
  },
  
  setZIndex:function(zIndex) {
	  this._setVisibleLayersStyle('zIndex',zIndex);
  },
  
  _setVisibleLayersStyle:function(style, value) {
	  for(var key in this.layers) {
		  this.layers[key]._tileContainer.style[style] = value;
	  }
  },

  _drawDebugInfo: function(ctx) {
    var max = this.options.tileSize;
    var g = ctx.canvas.getContext('2d');
    g.strokeStyle = '#000000';
    g.fillStyle = '#FFFF00';
    g.strokeRect(0, 0, max, max);
    g.font = "12px Arial";
    g.fillRect(0, 0, 5, 5);
    g.fillRect(0, max - 5, 5, 5);
    g.fillRect(max - 5, 0, 5, 5);
    g.fillRect(max - 5, max - 5, 5, 5);
    g.fillRect(max / 2 - 5, max / 2 - 5, 10, 10);
    g.strokeText(ctx.zoom + ' ' + ctx.tile.x + ' ' + ctx.tile.y, max / 2 - 30, max / 2 - 10);
  },

  _draw: function(ctx) {
    var self = this;

    //This works to skip fetching and processing tiles if they've already been processed.
    //But is causes unintended consequences - it seems the processing functions following this are called before ctx.canvas has been created, so there are lots of "canavs doesn't exist errors".
    //For this to work, it needs to be in synch with the creation of the actual canvii.
//    var vectorTile = this.processedTiles[ctx.zoom][ctx.id];
//    //if we've already parsed it, don't get it again.
//    if(vectorTile){
//      console.log("Skipping fetching " + ctx.id);
//      self.parseVectorTile(parseVT(vectorTile), ctx);
//      return;
//    }

    if (!this.options.url) return;
    var url = self.options.url.replace("{z}", ctx.zoom).replace("{x}", ctx.tile.x).replace("{y}", ctx.tile.y);

    var xhr = new XMLHttpRequest();
    xhr.onload = function() {
      if (xhr.status == "200") {
        var arrayBuffer = new Uint8Array(xhr.response);
        var vt = new VectorTile(arrayBuffer);
        self.parseVectorTile(parseVT(vt), ctx);
        tileLoaded(self, ctx);
      }
      else {
        console.log("xhr.status = " + xhr.status);
      }
    };

    xhr.onerror = function() {
      console.log("xhr error: " + xhr.errorCode)
    }

    xhr.open('GET', url, true); //async is true
    xhr.responseType = 'arraybuffer';
    xhr.send();
  },


  parseVectorTile: function(vt, ctx) {
    var self = this;

    for (var key in vt.layers) {
      var lyr = vt.layers[key];
      if (!self.layers[key]) {
        //Create PBFLayer for user
        self.layers[key] = self.createPBFLayer(key);
      }

      //If layer is marked as visible, examine the contents.
      if (self.layers[key].visible === true) {
        self.layers[key].parseVectorTileLayer(lyr, ctx);
      }
    }

    //Make sure manager layer is always in front
    this.bringToFront();

    this.processedTiles[ctx.zoom][ctx.id] = vt;

  },

  createPBFLayer: function(key) {
    var self = this;

    //Take the layer and create a new PBFLayer if one doesn't exist.
    var layer = new L.TileLayer.PBFLayer(self, {
      getIDForLayerFeature: self.options.getIDForLayerFeature,
      filter: self.options.filter
    }).addTo(self._map);

    layer.styleFor = self.styleFor;
    layer.name = key;

    return layer;
  },

  getLayers: function() {
    return this.layers;
  },

  hideLayer: function(id) {
    if (this.layers[id]) {
      this._map.removeLayer(this.layers[id]);
      this.layers[id].visible = false;
    }
  },

  showLayer: function(id) {
    if (this.layers[id]) {
      this.layers[id].visible = true;
      this._map.addLayer(this.layers[id]);
    }
    //Make sure manager layer is always in front
    this.bringToFront();
  },

  removeChildLayers: function(map){
    //Remove child layers of this group layer
    for (var key in this.layers) {
      var layer = this.layers[key];
      map.removeLayer(layer);
    }
  },

  on: function(eventType, callback) {
    this._eventHandlers[eventType] = callback;
  },

  onClick: function(evt, cb) {
    //Here, pass the event on to the child PBFLayer and have it do the hit test and handle the result.
    var self = this;

    evt.tileID =  getTileURL(evt.latlng.lat, evt.latlng.lng, this._map.getZoom());

    //If no layer is specified as clickable, just use the 1st one.
    if(this.options.clickableLayers.length == 0) {
      var names = Object.keys(self.layers);
      self.layers[names[0]].handleClickEvent(evt, function (evt) {
        cb(evt);
      });
    }
    else{
      for (var key in this.layers) {
        var layer = this.layers[key];
        if(self.options.clickableLayers.indexOf(key) > -1){
          layer.handleClickEvent(evt, function(evt) {
            cb(evt);
          });
        }
      }
    }
  }
});


if (typeof(Number.prototype.toRad) === "undefined") {
  Number.prototype.toRad = function() {
    return this * Math.PI / 180;
  }
}

function getTileURL(lat, lon, zoom) {
  var xtile = parseInt(Math.floor( (lon + 180) / 360 * (1<<zoom) ));
  var ytile = parseInt(Math.floor( (1 - Math.log(Math.tan(lat.toRad()) + 1 / Math.cos(lat.toRad())) / Math.PI) / 2 * (1<<zoom) ));
  return "" + zoom + ":" + xtile + ":" + ytile;
}

function tileLoaded(pbfSource, ctx) {
  pbfSource.loadedTiles[ctx.id] = ctx;
}

function parseVT(vt){
  for (var key in vt.layers) {
    var lyr = vt.layers[key];
    parseVTFeatures(lyr);
  }
  return vt;
}

function parseVTFeatures(vtl){
  vtl.parsedFeatures = [];
  var features = vtl._features;
  for (var i = 0, len = features.length; i < len; i++) {
    var vtf = vtl.feature(i);
    vtf.coordinates = vtf.loadGeometry();
    vtl.parsedFeatures.push(vtf);
  }
  return vtl;
}