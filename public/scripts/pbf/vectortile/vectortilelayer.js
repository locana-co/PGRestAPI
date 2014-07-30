//'use strict';

var VectorTileFeature;


function VectorTileLayer(buffer, end) {
  // Public
  this.version = 1;
  this.name = null;
  this.extent = 4096;
  this.length = 0;

  // Private
  this._buffer = buffer;
  this._keys = [];
  this._values = [];
  this._features = [];

  var val, tag;

  end = end || buffer.length;

  while (buffer.pos < end) {
    val = buffer.readVarint();
    tag = val >> 3;

    if (tag === 15) {
      this.version = buffer.readVarint();
    } else if (tag === 1) {
      this.name = buffer.readString();
    } else if (tag === 5) {
      this.extent = buffer.readVarint();
    } else if (tag === 2) {
      this.length++;
      this._features.push(buffer.pos);
      buffer.skip(val);

    } else if (tag === 3) {
      this._keys.push(buffer.readString());
    } else if (tag === 4) {
      this._values.push(this.readFeatureValue());
    } else {
      buffer.skip(val);
    }
  }
}

VectorTileLayer.prototype.readFeatureValue = function() {
  var buffer = this._buffer,
    value = null,
    bytes = buffer.readVarint(),
    end = buffer.pos + bytes,
    val, tag;

  while (buffer.pos < end) {
    val = buffer.readVarint();
    tag = val >> 3;

    if (tag == 1) {
      value = buffer.readString();
    } else if (tag == 2) {
      throw new Error('read float');
    } else if (tag == 3) {
      value = buffer.readDouble();
    } else if (tag == 4) {
      value = buffer.readVarint();
    } else if (tag == 5) {
      throw new Error('read uint');
    } else if (tag == 6) {
      value = buffer.readSVarint();
    } else if (tag == 7) {
      value = Boolean(buffer.readVarint());
    } else {
      buffer.skip(val);
    }
  }

  return value;
};

/*
 * Return feature `i` from this layer as a `VectorTileFeature`
 *
 * @param {number} i
 * @returns {VectorTileFeature}
 */
VectorTileLayer.prototype.feature = function(i) {
  if (i < 0 || i >= this._features.length) throw new Error('feature index out of bounds');

  this._buffer.pos = this._features[i];
  var end = this._buffer.readVarint() + this._buffer.pos;

  return new VectorTileFeature(this._buffer, end, this.extent, this._keys, this._values);
};
