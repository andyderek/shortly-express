var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');
var bookshelf = require('bookshelf');

var session = require('express-session');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

app.get('/', util.checkUser, function(req, res) {
  console.log('login added to bottom');
  res.render('index');
});

app.get('/create', util.checkUser, function(req, res) {
  res.render('index');
});

app.get('/links', util.checkUser, function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links', util.checkUser, function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url shortly.js: ');
    //create a new database entry?
    db.knex(uri)
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);

    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: shortly.js', err);
          return res.send(404);
        }


        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });
        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});


/************************************************************/
// Write your dedicated authentication routes here
// e.g. login, logout, etc.
/************************************************************/

app.get('/login', function(req, res) {
  res.render('login');
});

//here is where the authentication really begins - at the login screen
app.post('/login', 
function(req, res) {
  //we use req.body.username and req.body.password and assign them accordingly (these are input from user)
  var username = req.body.username;
  var password = req.body.password;

  //check to see if the username exists in our table
  new User({username: username})
  .fetch()
  .then(function(user) {
    //if there is no matching user in the database (user table), then redirect the user to the login page
    if (!user) {
      res.redirect('/login');
    } else {
      //if the user name matches with what we have in our database (user table), proceed to compare the password entered by the user
      user.comparePassword(password, function(match) {
        //check to see if there is a match with our password with that user
        if (match) {
          //if there is a match, create a new session id (server side) for the user upon logging in
          util.createSession(req, res, user);
          //else if the password does not match, redirect the user back to the login page
        } else {
          res.redirect('/login');
        }
      })
    }
  })

  console.log('index originally on top', req.body.url);
  res.render('index');
});


/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
