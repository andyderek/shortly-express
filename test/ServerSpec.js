var expect = require('chai').expect;
var request = require('request');

var db = require('../app/config');
var Users = require('../app/collections/users');
var User = require('../app/models/user');
var Links = require('../app/collections/links');
var Link = require('../app/models/link');

/************************************************************/
// Mocha doesn't have a way to designate pending beforero blocks.
// Mimic the behavior of xit and xdescribe with xbeforeEach.
// Remove the 'x' from beforeEach block when working on
// authentication tests.
// xbeforeEach is defined to be an empty function that doesn't
// do anything. When we invoke it inside of a describe block,
// it won't do anything! What we need to do, then, is change
// xbeforeEach to simply be beforeEach when we want that
// block of tests to run. Otherwise, it will continue to run
// the function we've defined below, which does nothing!
// NOTE: Do not change xbeforeEach to be beforeEach in the
// rows of asterisks below. If you do, you will be overwriting
// the actual beforeEach, which we want to work!
/************************************************************/
var xbeforeEach = function(){};
/************************************************************/


describe('', function() {

  beforeEach(function() {
    // log out currently signed in user
    request('http://127.0.0.1:4568/logout', function(error, res, body) {});

    // delete link for github from db so it can be created later for the test
    db.knex('urls')
      .where('url', '=', 'http://www.github.com/')
      .del()
      .catch(function(error) {
        throw {
          type: 'DatabaseError',
          message: 'Failed to create test setup data'
        };
      });

    // delete user Svnh from db so it can be created later for the test
    db.knex('users')
      .where('username', '=', 'Svnh')
      .del()
      .catch(function(error) {
        // uncomment when writing authentication tests
        // throw {
        //   type: 'DatabaseError',
        //   message: 'Failed to create test setup data'
        // };
      });

    // delete user Phillip from db so it can be created later for the test
    db.knex('users')
      .where('username', '=', 'Phillip')
      .del()
      .catch(function(error) {
        // uncomment when writing authentication tests
        // throw {
        //   type: 'DatabaseError',
        //   message: 'Failed to create test setup data'
        // };
      });
  });

  describe('Link creation:', function(){

    var requestWithSession = request.defaults({jar: true});
    xbeforeEach(function(done){      // create a user that we can then log-in with
      console.log('HELLO FROM INSIDE');
      new User({
          'username': 'Phillip',
          'password': 'Phillip'
      }).save().then(function(){
        var options = {
          'method': 'POST',
          'followAllRedirects': true,
          'uri': 'http://127.0.0.1:4568/login',
          'json': {
            'username': 'Phillip',
            'password': 'Phillip'
          }
        };
        // login via form and save session info
        requestWithSession(options, function(error, res, body) {
          done();
        });
      });
    });

    it('Only shortens valid urls, returning a 404 - Not found for invalid urls', function(done) {
      var options = {
        'method': 'POST',
        'uri': 'http://127.0.0.1:4568/links',
        'json': {
          'url': 'definitely not a valid url'
        }
      };

      requestWithSession(options, function(error, res, body) {
        // res comes from the request module, and may not follow express conventions
        expect(res.statusCode).to.equal(404);
        done();
      });
    });

    describe('Shortening links:', function(){

      var options = {
        'method': 'POST',
        'followAllRedirects': true,
        'uri': 'http://127.0.0.1:4568/links',
        'json': {
          'url': 'http://www.github.com/'
        }
      };

      it('Responds with the short code', function(done) {
        requestWithSession(options, function(error, res, body) {
          console.log('this is being executed');
          expect(res.body.url).to.equal('http://www.github.com/');
          expect(res.body.code).to.not.be.null;
          done();
        });
      });

      it('New links create a database entry', function(done) {
        console.log('this is also being executed!');
        requestWithSession(options, function(error, res, body) {
          db.knex('urls')
            .where('url', '=', 'http://www.github.com/')
            .then(function(urls) {
              if (urls['0'] && urls['0']['url']) {
                console.log('this statement is true!');
                var foundUrl = urls['0']['url'];
              }
              expect(foundUrl).to.equal('http://www.github.com/');
              console.log('this is found url:', foundUrl);
              done();
            });
        });
      });

      it('Fetches the link url title', function (done) {
        requestWithSession(options, function(error, res, body) {
          db.knex('urls')
            .where('title', '=', 'GitHub · Where software is built')
            .then(function(urls) {
              if (urls['0'] && urls['0']['title']) {
                var foundTitle = urls['0']['title'];
              }
              expect(foundTitle).to.equal('GitHub · Where software is built');
              done();
            });
        });
      });

    }); // 'Shortening links'

    describe('With previously saved urls:', function(){

      var link;

      beforeEach(function(done){
        // save a link to the database
        link = new Link({
          url: 'http://www.github.com/',
          title: 'GitHub · Where software is built',
          base_url: 'http://127.0.0.1:4568'
        });
        link.save().then(function(){
          done();
        });
      });

      it('Returns the same shortened code', function(done) {
        var options = {
          'method': 'POST',
          'followAllRedirects': true,
          'uri': 'http://127.0.0.1:4568/links',
          'json': {
            'url': 'http://www.github.com/'
          }
        };

        requestWithSession(options, function(error, res, body) {
          var code = res.body.code;
          expect(code).to.equal(link.get('code'));
          done();
        });
      });

      it('Shortcode redirects to correct url', function(done) {
        var options = {
          'method': 'GET',
          'uri': 'http://127.0.0.1:4568/' + link.get('code')
        };

        requestWithSession(options, function(error, res, body) {
          var currentLocation = res.request.href;
          expect(currentLocation).to.equal('https://github.com/');
          done();
        });
      });

      it('Returns all of the links to display on the links page', function(done) {
        var options = {
          'method': 'GET',
          'uri': 'http://127.0.0.1:4568/links'
        };

        requestWithSession(options, function(error, res, body) {
          expect(body).to.include('"title":"GitHub · Where software is built"');
          expect(body).to.include('"code":"' + link.get('code') + '"');
          done();
        });
      });

    }); // 'With previously saved urls'

  }); // 'Link creation'

    xbeforeEach(function(done){('Privileged Access:', function(){

    it('Redirects to login page if a user tries to access the main page and is not signed in', function(done) {
      request('http://127.0.0.1:4568/', function(error, res, body) {
        expect(res.req.path).to.equal('/login');
        done();
      });
    });

    it('Redirects to login page if a user tries to create a link and is not signed in', function(done) {
      request('http://127.0.0.1:4568/create', function(error, res, body) {
        expect(res.req.path).to.equal('/login');
        done();
      });
    });

    it('Redirects to login page if a user tries to see all of the links and is not signed in', function(done) {
      request('http://127.0.0.1:4568/links', function(error, res, body) {
        expect(res.req.path).to.equal('/login');
        done();
      });
    });

  }); // 'Priviledged Access'

  xdescribe('Account Creation:', function(){

    it('Signup creates a user record', function(done) {
      var options = {
        'method': 'POST',
        'uri': 'http://127.0.0.1:4568/signup',
        'json': {
          'username': 'Svnh',
          'password': 'Svnh'
        }
      };

      request(options, function(error, res, body) {
        db.knex('users')
          .where('username', '=', 'Svnh')
          .then(function(res) {
            if (res[0] && res[0]['username']) {
              var user = res[0]['username'];
            }
            expect(user).to.equal('Svnh');
            done();
          }).catch(function(err) {
            throw {
              type: 'DatabaseError',
              message: 'Failed to create test setup data'
            };
          });
      });
    });

    it('Signup logs in a new user', function(done) {
      var options = {
        'method': 'POST',
        'uri': 'http://127.0.0.1:4568/signup',
        'json': {
          'username': 'Phillip',
          'password': 'Phillip'
        }
      };

      request(options, function(error, res, body) {
        expect(res.headers.location).to.equal('/');
        done();
      });
    });

  }); // 'Account Creation'

  xdescribe('Account Login:', function(){

    var requestWithSession = request.defaults({jar: true});

    beforeEach(function(done){
      new User({
          'username': 'Phillip',
          'password': 'Phillip'
      }).save().then(function(){
        done()
      });
    })

    it('Logs in existing users', function(done) {
      var options = {
        'method': 'POST',
        'uri': 'http://127.0.0.1:4568/login',
        'json': {
          'username': 'Phillip',
          'password': 'Phillip'
        }
      };

      requestWithSession(options, function(error, res, body) {
        expect(res.headers.location).to.equal('/');
        done();
      });
    });

    it('Users that do not exist are kept on login page', function(done) {
      var options = {
        'method': 'POST',
        'uri': 'http://127.0.0.1:4568/login',
        'json': {
          'username': 'Fred',
          'password': 'Fred'
        }
      };

      requestWithSession(options, function(error, res, body) {
        expect(res.headers.location).to.equal('/login');
        done();
      });
    });

  }); // 'Account Login'

});
});
