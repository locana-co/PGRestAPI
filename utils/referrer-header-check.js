var _ = require('underscore'),
  settings = require('../settings/settings.js'),
  common = require('../common.js');

module.exports = function(req, res, next) {

    var acceptableReferrers = settings.acceptableReferrers || [],
      referrerCheckHints = settings.referrerCheckHints || [],
      referrerHeader = req.headers.referer || 'localhost';

    // Assume we don't want to check if acceptableReferrers array is empty
    if (acceptableReferrers.length === 0) {
        next();
        return;
    }

    var passingReferrer = false;

    // Are we limiting the referrer check to endpoints that contain a certain text-string?
    if (referrerCheckHints.length > 0) {

        // We don't want to look for the hint in the query string, so split the url on '?'
        var splitUrl = req.url.split('?');

        // If the referrerCheckHint text-string is found in the url check the referrer on this endpoint, else skip the check
        if (_.some(referrerCheckHints, function (hint) {
              return splitUrl[0].indexOf(hint) > -1
          }) === true) {


            // if the request's referrer header is found in the array of acceptable header values proceed, else 401 error
            _.each(acceptableReferrers, function (value) {

                if (referrerHeader.indexOf(value) > -1) {
                    passingReferrer = true;
                }

            });

            if (passingReferrer === true) {
                next();
                return;
            } else {
                var args = { errorMessage: "Unauthorized" };
                res.status(401);
                return common.respond(req, res, args, null);
            }

        } else {
            next();
            return;
        }

    }

    // If we have made it this far, we are checking the endpoint regardless of the text it contains
    _.each(acceptableReferrers, function (value) {

        if (referrerHeader.indexOf(value) > -1) {
            passingReferrer = true;
        }

    });

    if (passingReferrer === true) {
        next();
        return;
    } else {
        var args = { errorMessage: "Unauthorized" };
        res.status(401);
        return common.respond(res, req, args, null);
    }

}