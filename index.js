var httpPort = 9999;
var socketPort = 5000;

var restify = require('restify');
var socketio = require('socket.io')(socketPort);
var fs = require('fs');
var fb = require('fb');

var firebase = require('firebase');

var matchMaker = require('./matchMaker');

var firebaseUrl;
var firebaseUrlFile = fs.readFileSync(__dirname + '/firebaseUrl').toString().split('\n');
firebaseUrl = firebaseUrlFile[0];

var tokensByUserId = {};

var server = restify.createServer({
  name: 'ilcServer'
});

var io = socketio.listen(server);

server.get(/.*/, restify.serveStatic({
  'directory': __dirname,
  'default': './app/index.html',
  'maxAge': 0
}));

var users = [];

var appSecret;

var fbAppSecretFile = fs.readFileSync(__dirname + '/fbAppSecret').toString().split('\n');
appSecret = fbAppSecretFile[0];

var roomsRef = new firebase(firebaseUrl + '/rooms/');

var usersRef = new firebase(firebaseUrl + '/users/');

var createRoomEmitsForUserOnSocket = function(roomName, userId, socket) {
  roomsRef.orderByKey().startAt(roomName).endAt(roomName).on('value', function(rooms) {
    socket.emit('room set', {'room':roomName, 'snapshot':rooms.val()});
    roomsRef.orderByKey().startAt(roomName).endAt(roomName).on('child_added', function(child) {
      socket.emit('room update', {'room':roomName, 'snapshot':child.val()});
    });
  });
};

var pipeFirebaseToSocket = function(user, socket) {
  var userId = user.userId;
  roomsRef = new firebase(firebaseUrl + '/rooms/');
  if (user.rooms !== undefined) {
    for (var roomKey in user.rooms) {
      var room = user.rooms[roomKey];

      var roomName;
      if (parseInt(userId) > parseInt(room)) {
        roomName = String(room + '+' + userId);
      } else {
        roomName = String(userId + '+' + room);
      }

      createRoomEmitsForUserOnSocket(roomName, userId, socket);

    }
  } else {
    user.rooms = {};
  }
  socket.emit('rooms set', user.rooms);
};

var openFirebaseRoomForUsers = function(users, socket) {
  if (users.localId !== undefined && users.remoteId !== undefined) {
    var sharedRoomKey;

    if (users.localId > users.remoteId) {
      sharedRoomKey = users.remoteId + '+' + users.localId;
    } else {
      sharedRoomKey = users.localId + '+' + users.remoteId;
    }

    emptyRoom = [
      {
        'type': 'timeStamp',
        'time': new Date().getTime()
      }
    ];
    
    roomsRef.child(sharedRoomKey).set(emptyRoom);

    userRef = usersRef.child(users.localId);

    userRef.child('rooms').push(String(users.remoteId), function(error) {
      if (error !== null) {
        console.log('error pushing room', error);
      }
    });

    roomsRef.child(sharedRoomKey).on('child_added', function(snapshot) {
      socket.emit('room update', {
        'room':sharedRoomKey,
        'snapshot':snapshot.val()
      });
    });

  } else {
    console.log('couldnt create room, please provide a object with properties localId and remoteId, got: ', users);
  }
};

var facebookTokenValid = function(accessToken, callback) {
  var appId = '676670295780686';
  var appAccessToken = appId + '|' + appSecret;

  //https://graph.facebook.com/debug_token?input_token={id}&access_token={appAccessToken}
  var resource = 'debug_token?input_token=' + accessToken + '&access_token=' + appAccessToken;
  for (var cachedUserResponseKey in tokensByUserId) {
    var cachedUserResponse = tokensByUserId[cachedUserResponseKey];
    var now = new Date().getTime();
    now = now / 1000;
    if (cachedUserResponse.data['expires_at'] > now) {
      if (typeof callback === 'function') {
        callback(cachedUserResponse);
      }
      console.log('Access key was still valid according to Facebook, using cached authority.');
      return;
    }
  }
  fb.api(resource, function(response) {
    if (response.data !== undefined) {
      if (response.data['is_valid'] === true) {
        response.data.setTime = new Date().getTime();
        tokensByUserId[response.data['user_id']] = response;
        if (typeof callback === 'function') {
          callback(response);
        }
      } else {
        console.log('response.is_valid is not true', response);
      }
    } else {
      console.log('response.data is missing', response);
    }
  });
};

var updateUser = function(user, socket) {
  userRef = usersRef.child(user.data['user_id']);
  userRef.on('value', function(snapshot) {
    var value = snapshot.val();
    var u = {
      userId: user.data['user_id'],
      ref: userRef,
      rooms:[]
    };
    if (value.rooms !== undefined) {
      for (var room in value.rooms) {
        u.rooms.push(value.rooms[room]);
      }
    }
    pipeFirebaseToSocket(u, socket);
  });
};

var getUserProfile = function(user, socket) {
  console.log('looking for ' + user.data['user_id'] + ' profile');
  usersRef.child(user.data['user_id']).once('value', function(snapshot) {
    socket.emit('user profile', snapshot.val().profile || {});
  });
};

var setUserProfile = function(user, profile, socket) {
  console.log('user, profile', user, profile);
  usersRef.child(user.data['user_id']).child('profile').set(profile, function(error) {
    socket.emit('user profile', profile || error);
  });
};

var getUserMatches = function(user, socket) {
  usersRef.on('value',function(usersSnapshot) {
    console.log('usersSnapshot', usersSnapshot.val());
      socket.emit('got user matchList', matchMaker.getMatchList(user, usersSnapshot))
  });

};

io.sockets.on('connection', function(socket) {
  var socketId = socket.id;

  socket.on('ping', function(data) {
    data.signed = "gph";
    console.log('recieved ping', data);
    socket.emit('pong', data);
  });
  
  socket.on('set profile', function(user) {
    var profile = user.profile;
    console.log('user.profile', user.profile);
    facebookTokenValid(user.accessToken, function(user) {
      setUserProfile(user, profile, socket);
    });
  });

  socket.on('get user matches', function(user) {
    // facebookTokenValid(user.accessToken, function(user) {
      getUserMatches(user, socket);
    // });
  });

  socket.on('get profile', function(user) {
    facebookTokenValid(user.accessToken, function(user) {
      getUserProfile(user, socket);
    });
  });
  
  socket.on('open room', function(users) {
    console.log('received open request: Users: ', users);
    facebookTokenValid(users.accessToken, function(user) {
      console.log('opening room');
      openFirebaseRoomForUsers(users, socket);
    });
  });

  socket.on('loginValidator', function(accessToken) {
    console.log('received loginValidator Request: ', accessToken);
    facebookTokenValid(accessToken, function(user) {
      console.log('This guy|s logged in');
      socket.emit('user valid', user);
      getUserProfile(user, socket);
      updateUser(user, socket);
    });
  });

});

server.listen(httpPort, function() {
  console.log('socket.io server listening at %s', server.url);
});
