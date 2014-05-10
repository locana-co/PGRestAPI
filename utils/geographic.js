var mapnik = require('mapnik');

var proj4 = '+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs';

/**
 * Geographic constructor: precaches calculations
 * for fast tile lookups
 */
function Geographic() {
    var size = 256;
    this.Bc = [];
    this.Cc = [];
    this.zc = [];
    this.Ac = [];
    this.DEG_TO_RAD = Math.PI / 180;
    this.RAD_TO_DEG = 180 / Math.PI;
    this.size = 256;
    this.levels = 18;
    this.proj4 = proj4;
    for (var d = 0; d < this.levels; d++) {
        this.Bc.push(size / 360);
        this.Cc.push(size / (2 * Math.PI));
        this.zc.push(size / 2);
        this.Ac.push(size);
        size *= 2;
    }
}


module.exports = new Geographic();

