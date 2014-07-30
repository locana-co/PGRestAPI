//'use strict';

var VectorTileLayer;
var Protobuf;


function VectorTile(buffer, end) {

  if (!(buffer instanceof Protobuf)) {
    buffer = new Protobuf(buffer);
  }

  this.layers = {};
  this._buffer = buffer;

  end = end || buffer.length;

  while (buffer.pos < end) {
    var val = buffer.readVarint(),
      tag = val >> 3;

    if (tag == 3) {
      var layer = this.readLayer();
      if (layer.length) this.layers[layer.name] = layer;
    } else {
      buffer.skip(val);
    }
  }

}

VectorTile.prototype.readLayer = function() {
  var buffer = this._buffer,
    bytes = buffer.readVarint(),
    end = buffer.pos + bytes,
    layer = new VectorTileLayer(buffer, end);

  buffer.pos = end;

  return layer;
};
