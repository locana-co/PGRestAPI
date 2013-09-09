var should = require('chai').should(),
    supertest = require('supertest'),
    api = supertest('http://localhost:3000');

describe('/services', function () {

    it('returns list of tables posts as HTML', function (done) {
        api.get('/services')
        .expect(200)
        .expect('Content-Type', "text/html; charset=utf-8")
        .end(function (err, res) {
            console.log("Here: " + JSON.stringify(res.body, null, 4));

            if (err) return done(err);
            res.body.should.have.property('list').and.be.instanceof(Array);
            done();
        });
    });

});