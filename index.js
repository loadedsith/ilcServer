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

var fbAppSecretFile = fs.readFileSync(__dirname+"/fbAppSecret").toString().split("\n");
appSecret = fbAppSecretFile[0];

var roomsRef = new firebase(firebaseUrl + "/rooms/");

var usersRef = new firebase(firebaseUrl + "/users/");

var pipeFirebaseToSocket = function(user, socket) {
  var userId = user.userId;
  if (user.rooms !== undefined) {
    for (var r in user.rooms) {
      // var room = user.rooms[i];
      var room = user.rooms[r];

      var roomName;
      if(parseInt(userId) > parseInt(room)){
        roomName = String(room + "+" + userId);
      }else{
        roomName = String(userId + "+" + room);
      }
      
      roomsRef.orderByKey().startAt(roomName).endAt(roomName).on('child_added', function(child) {
        console.log('child', child.val());
        socket.emit('room update', {"room":roomName,"snapshot":child.val()});
      });
      roomsRef.orderByKey().startAt(roomName).endAt(roomName).on('value',function(rooms) {
        console.log('roomName', roomName);
        console.log('rooms for String(userId)', rooms.val(), String(userId));
        console.log('----------------------', rooms.key());
        socket.emit('room set', {"room":roomName,"snapshot":rooms.val()});
      });
    }
  }else{
    user.rooms = {};
  }
  
  
  socket.emit('rooms set', user.rooms);
  
  // roomsRef.orderByKey().startAt(String(userId)).endAt(userId+"_").on('child_added', function(child) {
  //   console.log('child', child.val());
  //   socket.emit('rooms update', child.val());
  // });
  // 
  // roomsRef.orderByKey().startAt(String(userId)).endAt(userId+"_").on('value',function(rooms) {
  //   console.log('rooms for String(userId)', rooms.val(), String(userId));
  //   socket.emit('rooms set', rooms.val());
  // });

};

var openFirebaseRoomForUsers = function(users, socket) {
  if (users.localId !== undefined && users.remoteId !== undefined){
    var key;
    
    if(users.localId > users.remoteId){
      key = users.remoteId + "+" + users.localId
    }else{
      key = users.localId + "+" + users.remoteId
    }
    
    emptyRoom = [
      {
        "type": "timeStamp",
        "time": new Date().getTime()
      }
    ];
    
    roomsRef.child(key).set(emptyRoom);
    
    userRef = usersRef.child(users.localId);
    
    userRef.child("rooms").push(String(users.remoteId), function(error) {
      if(error !== null){
        console.log('error pushing room', error);
      }
    });
    roomsRef.child(key).on('value',function(snapshot) {
      console.log('roomRef key:', key);
      console.log('roomRef snapshot:', snapshot.val());
      socket.emit('rooms update', {
        "remoteId":users.remoteId,
        "snapshot":snapshot.val()
      });
      
    })
    
  }else{
    console.log('couldnt create room, please provide a object with properties localId and remoteId, got: ',users);
  }
};

var facebookTokenValid = function(accessToken, callback) {
  var appId = "676670295780686";
  var appAccessToken = appId + "|" + appSecret;
  
  //https://graph.facebook.com/debug_token?input_token={id}&access_token={appAccessToken}
  var resource = 'debug_token?input_token=' + accessToken + '&access_token=' + appAccessToken;
  
  fb.api(resource, function (response) {
    if (response.data !== undefined) {
      if (response.data['is_valid'] === true) {
        if (typeof callback === 'function'){
          callback(response);
        }
      }else{
        console.log('response.is_valid is not true', response);
      }
    }else{
      console.log('response.data is missing', response);
    }
  })
};

var updateUser = function(user, socket) {
  userRef = usersRef.child(user.data["user_id"]);
  userRef.once('value',function(snapshot) {
    var value = snapshot.val();
    var u = {
      userId: user.data["user_id"],
      ref: userRef,
      rooms:[]
    }
    console.log('-----value.rooms', value.rooms);
    if(value.rooms !== undefined){
      for(var room in value.rooms){
        u.rooms.push(value.rooms[room]);
      }
    }
    
    pipeFirebaseToSocket(u, socket);
    
  })
}

io.sockets.on('connection', function(socket) {
  var socketId = socket.id;
  socket.on('open room',function(users) {
    console.log('recieved open request: Users: ', users);
    openFirebaseRoomForUsers(users, socket);
  })
  socket.on('loginValidator', function(accessToken) {
    facebookTokenValid(accessToken, function(user) {
      console.log('This guy\s logged in');
      updateUser(user, socket);

    })
  });
});

server.listen(httpPort, function() {
  console.log('socket.io server listening at %s', server.url);
});
