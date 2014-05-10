/**
 * Created by ryanwhitley on 5/9/14.
 */
//https://github.com/apollolm/node-cacher/tree/master/lib

// memory cache is global, ideally it wouldn't be...
var LRU = require("lru-cache")
    , options = { max: 500
        //, length: function (n) { return n * 2 }
        //, dispose: function (key, n) { n.close() }
        , maxAge: 1000 * 60 * 60 * 24 * 3 } // 3 days
    , cache = LRU(options);

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


module.exports = MemoryCache;