/**
 * Created by Nicholas Hallahan <nhallahan@spatialdev.com>
 *       on 7/11/14.
 */

// constants
var POS_WKR_LOC = './scripts/lib/TileLayer.PBF.Label/PositionWorker.js';

// if using browserify
if (typeof require === 'function') {
  var Feature = require('./Feature.js');
}

/**
 * There should be one instance of Label per PBFSource.
 *
 * @param map
 * @param options
 * @constructor
 */
function Label(map, pbfSource, options) {
  this.map = map;
  this.pbfSource = pbfSource;

  // default options
  this.options = {
    numPosWorkers: 8
  };

  // apply options
  for (var key in options) {
    this.options[key] = options[key];
  }

  this.positionWorkerPool = [];
  this.positionWorkerQueue = [];

  for (var wkr = 0; wkr < this.options.numPosWorkers; wkr++) {
    this.positionWorkerPool.push( new Worker(POS_WKR_LOC) );
  }

  /**
   * A hash containing keys to all of the tiles
   * currently in the view port.
   */
  this.activeTiles = {};

  this._determineActiveTiles();
  var self = this;
  this.map.on('move', function() {
    self._determineActiveTiles();
  });

}


/**
 * FACTORY METHODS
 */

Label.prototype.createFeature = function(pbfFeature, options) {
  return new Feature(this, pbfFeature, options);
};



/**
 * PRIVATE METHODS
 * @private
 */

Label.prototype._determineActiveTiles = function() {
  var activeTiles = this.activeTiles = {};
  var bounds = this.map.getPixelBounds();
  var tileSize = this.pbfSource.options.tileSize;
  var z = this.map.getZoom();

  var minX = Math.floor(bounds.min.x / tileSize);
  var minY = Math.floor(bounds.min.y / tileSize);
  var maxX = Math.floor(bounds.max.x / tileSize);
  var maxY = Math.floor(bounds.max.y / tileSize);

  for (var x = minX; x <= maxX; x++) {
    for (var y = minY; y <= maxY; y++) {
      activeTiles[z+':'+x+':'+y] = true;
    }
  }
};

Label.prototype.submitPositionJob = function(job, onmessage) {
  var worker = this.positionWorkerPool.pop();
  if (!worker) {
    console.log('Enqueuing job for position worker...');
    this.positionWorkerQueue.push({job:job, onmessage:onmessage});
  } else {
    worker.onmessage = onmessage;
    worker.postMessage(job);
  }
};

Label.prototype.freePositionWorker = function(worker) {
  if (this.positionWorkerQueue.length > 0) {
    var job = this.positionWorkerQueue.shift();
    worker.onmessage = job.onmessage;
    worker.postMessage(job.job);
  } else {
    this.positionWorkerPool.push(worker);
  }
};

/**
 * Exports this as a module if using Browserify.
 */
if (typeof module !== 'undefined') {
  module.exports = Label;
}
