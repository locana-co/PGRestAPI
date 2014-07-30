/**
 * Created by Nicholas Hallahan <nhallahan@spatialdev.com>
 *       on 7/11/14.
 */

function Feature(label, pbfFeature, options) {
  this.label = label;
  this.pbfFeature = pbfFeature;
  this.pbfLayer = pbfFeature.pbfLayer;
  this.pbfSource = pbfFeature.pbfLayer.pbfSource;
  this.map = label.map;
  this.activeTiles = label.activeTiles;
  this.marker = null;

  this.tilePoints = {};
  this.tileLines = {};
  this.tilePolys = {};

  // default options
  this.options = {};

  // apply options
  for (var key in options) {
    this.options[key] = options[key];
  }

  // override the style function if specified
  if (pbfFeature.style.label) {
    this._styleFn = pbfFeature.style.label;
  }

  this.html = this._styleFn();
  this.icon = L.divIcon({
    className: 'label-icon-text',
    html: this.html
  });
}

Feature.prototype.addTilePolys = function(ctx, polys) {
  this.tilePolys[ctx.id] = polys;
  this.computeLabelPosition();
};

Feature.prototype.computeLabelPosition = function() {
  var activeTiles = this.activeTiles;
  var tilePolys = {};
  // only passing over tiles currently on the screen
  for (var id in activeTiles) {
    var t = this.tilePolys[id];
    if (t) tilePolys[id] = t;
  }
  var label = this.label;
  var job = {
    extent: this.pbfFeature.extent,
    tileSize: this.pbfFeature.tileSize,
    tilePolys: tilePolys
  };
  var feature = this;
  this.label.submitPositionJob(job, function(evt) {
    console.log(['posWkrMsg', evt]);
    var data = evt.data;
    if (data.status !== 'WARN') {
      // returns worker to the pool
      label.freePositionWorker(this);
    }

    if (data.status === 'OK') {
      var pt = L.point(evt.data.x, evt.data.y);
      positionMarker(feature, pt);
    }
  });
};

function positionMarker(feature, pt) {
  var map = feature.map;
  var latLng = map.unproject(pt);
  if (!feature.marker) {
    feature.marker = L.marker(latLng, {icon: feature.icon});
    feature.marker.addTo(map);
  } else {
    feature.marker.setLatLng(latLng);
  }
}

/**
 * This is the default style function. This is overridden
 * if there is a style.label function in PBFFeature.
 */
Feature.prototype._styleFn = function() {

};

function unprojectArr(arr) {
  var unproj = [];
  for (var i = 0, len = arr.length; i < len; i++) {
    var obj = arr[i];
    unproj.push(map.unproject(L.point([obj.x,obj.y])));
  }
  return unproj;
}

function drawLine(latlngs, color, weight) {
  L.polyline(latlngs, {
    color: color || 'red',
    weight: weight || 1
  }).addTo(map);
}

/**
 * Exports this as a module if using Browserify.
 */
if (typeof module !== 'undefined') {
  module.exports = Feature;
}
