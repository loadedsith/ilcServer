var httpPort = 8080;
var socketPort = 5000;

var restify = require('restify');
var socketio = require('socket.io')(socketPort);
var fs = require('fs');
var fb = require('fb');

var firebase = require('firebase');

var firebaseUrl = 'https://resplendent-fire-9421.firebaseIO.com';

var tokensByUserId = {};

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
  roomsRef = new firebase(firebaseUrl + "/rooms/");
  if (user.rooms !== undefined) {
    for (var roomKey in user.rooms) {
      var room = user.rooms[roomKey];

      var roomName;
      if(parseInt(userId) > parseInt(room)){
        roomName = String(room + "+" + userId);
      }else{
        roomName = String(userId + "+" + room);
      }
      
      (function(roomName, userId) {
        roomsRef.orderByKey().startAt(roomName).endAt(roomName).on('value', function(rooms) {
          socket.emit('room set', {"room":roomName,"snapshot":rooms.val()});
          roomsRef.orderByKey().startAt(roomName).endAt(roomName).on('child_added', function(child) {
            socket.emit('room update', {"room":roomName,"snapshot":child.val()});
          });
        });
      })(roomName, userId);
      
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
  for(var cachedUserResponseKey in tokensByUserId){
    var cachedUserResponse = tokensByUserId[cachedUserResponseKey];
    var now = new Date().getTime();
    now = now / 1000;
    if (cachedUserResponse.data.expires_at > now){
      if (typeof callback === 'function'){
        callback(cachedUserResponse);
      }
      console.log('Access key was still valid according to Facebook, using cached authority.');
      return;
    }
  }
  fb.api(resource, function (response) {
    if (response.data !== undefined) {
      if (response.data['is_valid'] === true) {
        response.data.setTime = new Date().getTime();
        console.log('response', response);
        tokensByUserId[response.data["user_id"]]=response;
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
  userRef.on('value',function(snapshot) {
    var value = snapshot.val();
    var u = {
      userId: user.data["user_id"],
      ref: userRef,
      rooms:[]
    }
    if(value.rooms !== undefined){
      for(var room in value.rooms){
        u.rooms.push(value.rooms[room]);
      }
    }
    pipeFirebaseToSocket(u, socket);
  })
}
var getUserProfile = function(user, callback) {
  console.log('user', user);
  usersRef.startAt(user.data["userId"]).endAt(user.data["userId"]).once('value',function(a) {
    console.log('!0101010101',a.val());
  })
  
}
io.sockets.on('connection', function(socket) {
  var socketId = socket.id;
  
  socket.on('get profile',function(users) {
    facebookTokenValid(users.accessToken, function(user) {
      socket.emit('user valid',true);
      getUserProfile(user, function(profile, err) {
        if (err !== undefined){
          socket.emit('user error', err);
          return;
        }
      });
    });
  });
  socket.on('open room',function(users) {
    console.log('received open request: Users: ', users);
    facebookTokenValid(users.accessToken, function(user) {
      console.log('opening room');
      openFirebaseRoomForUsers(users, socket);
    });
  })
  
  socket.on('loginValidator', function(accessToken) {
    console.log('received loginValidator Request: ', accessToken);
    facebookTokenValid(accessToken, function(user) {
      console.log('This guy\s logged in');
      updateUser(user, socket);
    })
  });
  
});

server.listen(httpPort, function() {
  console.log('socket.io server listening at %s', server.url);
});
