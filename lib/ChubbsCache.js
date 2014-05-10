/**
 * Created by ryanwhitley on 5/8/14.
 */
//https://github.com/addisonj/node-cacher

var units = {}
units.second = 1
units.minute = units.second * 60
units.hour = units.minute * 60
units.day = units.hour * 24
units.week = units.day * 7
units.month = units.day * 30
units.year = units.day * 365

// add plural units
Object.keys(units).forEach(function (unit) {
    units[unit + "s"] = units[unit]
})

var STALE_CREATED = 1
var STALE_REFRESH = 2
var GEN_TIME = 30

var HEADER_KEY = 'Cache-Control'
var NO_CACHE_KEY = 'no-cache'
var MAX_AGE_KEY = 'max-age'
var MUST_REVALIDATE_KEY = 'must-revalidate'

var EventEmitter = require('events').EventEmitter
var MemoryClient = require('./MemoryClient')
var util = require('util');

function Cacher(client) {
    // check to make sure they pass in a valid client
    if (client && !client.set && !client.get && !client.invalidate) {
        throw new Error("invalid client")
    } else if (!client) {
        client = new MemoryClient()
    }

    this.client = client
}

util.inherits(Cacher, EventEmitter)

Cacher.prototype.invalidate = function(key, cb) {
    this.client.invalidate(key, cb)
}

Cacher.prototype.cacheDays = function(days) {
    return this.cache('days', days)
}

Cacher.prototype.cacheDaily = function() {
    return this.cache('day')
}

Cacher.prototype.cacheHours = function(hours) {
    return this.cache('hours', hours)
}

Cacher.prototype.cacheHourly = function() {
    return this.cache('hour')
}

Cacher.prototype.cacheMinutes = function(minutes) {
    return this.cache('minutes', minutes)
}

Cacher.prototype.cacheOneMinute = function() {
    return this.cache('minute')
}

Cacher.prototype.noCache = function() {
    return this.cache(false)
}

Cacher.prototype.genCacheKey = function(req) {
    var args = getArgs(req);

    //validate
    if (this.isEmpty(args) == true) {
        //We won't cache responses for routes with no args.
        return "";
    }
    var key = req.url;

    if (req.method.toLowerCase() == "post") {
        //If a post
        key = req.url + JSON.stringify(args);
    };
    return key;
}


Cacher.prototype.isEmpty = function (args) {
    //Add Validation here
    if (JSON.stringify(args) == '{}') {
        return true;
    }
    return false;
}

Cacher.prototype.noCaching = false
Cacher.prototype.cacheHeader = 'X-Cacher-Hit'

Cacher.prototype.calcTtl = function(unit, value) {
    if (unit === 0 || value === 0 || unit === false) return 0
    var unitValue = units[unit]
    if (!unitValue) {
        throw new Error("Unknown unit " + unit)
    }

    if (!value) value = 1
    return unitValue * value
}


function checkNoCache(toCheck) {
    if (!toCheck) return false
    return toCheck.indexOf(NO_CACHE_KEY) > -1
}

Cacher.prototype.cache = function(unit, value) {
    var self = this;

    // set noCaching to true in dev mode to get around stale data when you don't want it
    var ttl = self.calcTtl(unit, value)
    if (this.noCaching) {
        return function(req, res, next) {
            res.header(HEADER_KEY, NO_CACHE_KEY)
            next()
        }
    }


    return function(req, res, next) {
        // only cache on get and head
        if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'POST') {
            return next()
        }

        // obey cache-control control headers
        if (checkNoCache(req.header("cache-control")) || checkNoCache(req.header("pragma"))) {
            res.header(self.cacheHeader, false)
            self.emit('miss', self.genCacheKey(req))
            return next();
        }

        var key = self.genCacheKey(req);
        if(key == ""){
            //No key.  break
            res.header(self.cacheHeader, false)
            self.emit('miss', self.genCacheKey(req))
            return next();
        }
        var staleKey = key + ".stale"
        var realTtl = ttl + GEN_TIME * 2

        self.client.get(key, function(err, cacheObject) {
            if (err) {
                self.emit("error", err)
                return next()
            }
            // if the stale key expires, we let one request through to refresh the cache
            // this helps us avoid dog piles and herds
            self.client.get(staleKey, function(err, stale) {
                if (err) {
                    self.emit("error", err)
                    return next()
                }

                setHeaders(res, ttl)

                if (!stale) {
                    self.client.set(staleKey, STALE_REFRESH, GEN_TIME)
                    cacheObject = null
                }

                if (cacheObject) {
                    self.emit("hit", key)
                    return self.sendCached(res, cacheObject)
                }

                res._responseBody = ""

                self.buildEnd(res, key, staleKey, realTtl, ttl)
                self.buildWrite(res)

                res.header(self.cacheHeader, false)
                next()
                self.emit("miss", key)
            })
        })
    }
}

function setHeaders(res, ttl) {
    res.header(HEADER_KEY, MAX_AGE_KEY + "=" + ttl + ", " + MUST_REVALIDATE_KEY)
}

Cacher.prototype.buildEnd = function(res, key, staleKey, realTtl, ttl) {
    var origEnd = res.end
    var self = this

    res.end = function (data) {
        res._responseBody += data
        var cacheObject = {statusCode: res.statusCode, content: res._responseBody, headers: res._headers}
        self.client.set(key, cacheObject, realTtl, function(err) {
            if (err) {
                self.emit("error", err)
            }
            self.client.set(staleKey, STALE_CREATED, ttl, function(err) {
                if (err) {
                    self.emit("error", err)
                }
                self.emit("cache", cacheObject)
            })
        })
        return origEnd.apply(res, arguments)
    }
}

Cacher.prototype.buildWrite = function(res) {
    var origWrite = res.write
    res.write = function (data) {
        res._responseBody += data
        return origWrite.apply(res, arguments)
    }
}

Cacher.prototype.sendCached = function(res, cacheObject) {
    res.statusCode = cacheObject.statusCode
    for (var header in cacheObject.headers) {
        res.header(header, cacheObject.headers[header])
    }

    res.header(this.cacheHeader, true)

    res.end(cacheObject.content)
}

function getArgs(req){
    var args= {};
    //Grab POST or QueryString args depending on type
    if (req.method.toLowerCase() == "post") {
        //If a post, then arguments will be members of the this.req.body property
        args = req.body;
    } else if (req.method.toLowerCase() == "get") {
        //If request is a get, then args will be members of the this.req.query property
        args = req.query;
    }
    return args;
}

module.exports = Cacher;