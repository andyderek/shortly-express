var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');

var User = db.Model.extend({
  tableName: 'user',
  hasTimestamps: true,
  // link: function() {
  //   return this.belongsTo(Link, 'link_id');
  // }
});

module.exports = User;