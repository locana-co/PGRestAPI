/**
 * Created by ryanwhitley on 5/9/14.
 */
//https://github.com/apollolm/node-cacher/tree/master/lib

// memory cache is global, ideally it wouldn't be...
var LRU = require("lru-cache")
//    , options = { max: 500
//        , length: function (n) { return n; }
//        , dispose: function (key, n) { }
//        , maxAge: 1000 * 60 * 60 * 24 * 3 } // 3 days
    , cache = LRU(5000); //Keep 5000 Items only

// A minimal in memory implemenation of the interface needed for cacher
function MemoryCache() {

}

MemoryCache.prototype.get = function(key, cb) {
    cb(null, cache.get(key))
}

//In this implementation, ttl is ignored because it's handled already.
MemoryCache.prototype.set = function(key, cacheObj, ttl, cb) {
    // this expects milliseconds
    cache.set(key, cacheObj)
    if (cb) return cb()
}

MemoryCache.prototype.invalidate = function(key, cb) {
    cache.del(key)
    if (cb) return cb()
}


//RW Added
MemoryCache.prototype.keys = function() {
    return cache.keys();
}

MemoryCache.prototype.values = function() {
    return cache.values();
}


module.exports = MemoryCache;