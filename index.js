var httpPort = 8080;
var socketPort = 5000;

var restify = require('restify');
var socketio = require('socket.io')(socketPort);
var fs = require('fs');
var fb = require('fb');

var firebase = require('firebase');

var firebaseUrl = 'https://resplendent-fire-9421.firebaseIO.com';

var server = restify.createServer({
  name: "ilcServer"
});

var io = socketio.listen(server);

server.get(/.*/, restify.serveStatic({
  'directory': __dirname,
  'default': './app/index.html',
  'maxAge': 0
}));

var users = [];

var appSecret;

var array = fs.readFileSync(__dirname+"/fbAppSecret").toString().split("\n");

appSecret = array[0];

var pipeFirebaseToSocket = function(user, socket) {
  var testRef = new firebase(firebaseUrl + "/rooms/")
  testRef.on('child_added', function(child) {
    console.log('child', child);
    socket.emit('rooms update', child.val());
  });
  testRef.on('value',function(rooms) {
    console.log('rooms', rooms);
    socket.emit('rooms set', rooms.val());
  });
};

io.sockets.on('connection', function(socket) {
  var socketId = socket.id;
  socket.on('loginValidator', function(id) {
    var appId = "676670295780686";
    var appAccessToken = appId + "|" + appSecret;
    
    //https://graph.facebook.com/debug_token?input_token={id}&access_token={appAccessToken}
    var resource = 'debug_token?input_token=' + id + '&access_token=' + appAccessToken;
    
    fb.api(resource, function (response) {
      console.log('response:', response);
      if (response.data !== undefined) {
        console.log('1');
        if (response.data['is_valid'] === true) {
          console.log('This guy\s logged in');
          var user = {
            id:id,
            token:response
          };
          users.push(user);
          pipeFirebaseToSocket(user, socket);
        }else{
          console.log('response.is_valid', response['is_valid']);
        }
      }
    })
  });
});

server.listen(httpPort, function() {
  console.log('socket.io server listening at %s', server.url);
});
