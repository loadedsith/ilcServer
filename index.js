var restify = require('restify');
var socketio = require('socket.io')(5000);
var fs = require('fs');

var ip_addr = '127.0.0.1';
var port = '8080';

var server = restify.createServer({
  name: "ilcServer"
});
var io = socketio.listen(server);

server.get(/\/app\/?.*/, restify.serveStatic({
  directory: __dirname + '/app'
}))




server.get(/.*/, restify.serveStatic({
  'directory': __dirname,
  'default': './app/index.html',
  'maxAge': 0
}));
 

io.sockets.on('connection', function(socket) {
  socket.emit('news', {
    hello: 'world'
  });
  socket.on('my other event', function(data) {
    console.log(data);
  });
});

server.listen(8080, function() {
  console.log('socket.io server listening at %s', server.url);
});
