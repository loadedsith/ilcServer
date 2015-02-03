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
  console.log('subscribe user to : ',firebaseUrl + '/rooms/'+encodeURIComponent(roomName));
  var updateRef = new firebase(firebaseUrl + '/rooms/'+encodeURIComponent(roomName));
  updateRef.orderByChild('date').once('value', function(rooms) {
    socket.emit('room set', {'room':roomName, 'snapshot':rooms.val()});
    var first = true;
    updateRef.endAt().limitToLast(1).on("child_added", function(child) {
      if( first ) {
          first = false; 
      } 
      else {
        socket.emit('room update', {'room':roomName, 'snapshot':child.val()});
      }
    });
  });
};

var pipeFirebaseToSocket = function(user, socket) {
  var userId = user.userId;
  if (user.rooms !== undefined) {
    for (var roomKey in user.rooms) {
      var room = user.rooms[roomKey];

      var roomName = makeRoomPairName(userId,room);

      createRoomEmitsForUserOnSocket(roomName, userId, socket);

    }
  } else {
    user.rooms = {};
  }
  socket.emit('rooms set', user.rooms);
};

var openFirebaseRoomForUsers = function(users, socket) {
  if (users.localId !== undefined && users.remoteId !== undefined) {
    var sharedRoomKey = makeRoomPairName(users.localId, users.remoteId);

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
    if (value === null) {

      user.profile = {
        // blacklist:[],//commented cuz firebase deletes empty objects automagically
        // email:'',
        'id': user.data['user_id']//,
        // name:'',
        // topics:[]
      };

      usersRef.child(user.data['user_id']).set(user,function(err) {
        console.log('created user'+user.data['user_id']);
        if(err === null){
          
        } else {
          
          console.log('Failed creating user [' + user.data['user_id'] + ']. err status:', err);
        }
        updateUser(user,socket);
      });
      //function re-called after user is successfully created
      return;
    }
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
  var userId; 
  
  if (user.user === undefined) {
    userId = user.data['user_id'];
    //TODO: Dont pass fb objects around, pass ilcUsers, which dont exist yet so...
  }else{
    userId = user.user;
  }
  console.log('looking for ' + userId + ' profile');
  usersRef.child(userId).once('value', function(snapshot) {
    var value = snapshot.val();
    if (value === null || value === undefined) {
      socket.emit('user profile', {});
    }else{
      // socket.emit('user profile', (value.profile || {}));//send back the whole user.
      socket.emit('user profile', (value || {}));
    }

  });
};

var setUserProfile = function(user, profile, socket) {
  usersRef.child(user.data['user_id']).child('profile').set(profile, function(error) {
    socket.emit('user profile', profile || error);
  });
};

var makeRoomPairName = function(userA, userB) {
  var roomName;
  if ( parseInt(userA) > parseInt(userB)) {
    roomName = String(userB + '+' + userA);
  } else {
    roomName = String(userA + '+' + userB);
  }
  
  return roomName;
}

var sendMessage = function(user, room, message, socket) {
  console.log('Send Message: room, message', room, message);
  var roomName = makeRoomPairName(user.data['user_id'], room);
  var messageObject = {
    date: new Date().getTime(),
    user:user,
    message:message
  };
  roomsRef.child(roomName).push(messageObject, function() {
    // console.log('successfully posted message');
    messageObject.room = room;
    socket.emit('message sent', messageObject);
  })
  // usersRef.child(user.data['user_id']).child('profile').set(profile, function(error) {
//      socket.emit('user profile', profile || error);
//    });
};

var getUserMatches = function(user, socket) {
  usersRef.on('value',function(usersSnapshot) {
    // console.log('usersSnapshot', usersSnapshot.val());
    socket.emit('got user matchList', matchMaker.getMatchList(user, usersSnapshot));
  });

};

io.sockets.on('connection', function(socket) {
  var socketId = socket.id;

  socket.on('disconnect', function () {
    console.log('disconnected');
    socket.emit('user disconnected',true);
  });

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
    facebookTokenValid(user.accessToken, function(user) {
      getUserMatches(user, socket);
    });
  });

  socket.on('send message', function(config) {
    console.log('socket on: send message: ', config);
    var accessToken = config.accessToken;
    var message = config.message;
    var room = config.room;
    facebookTokenValid(accessToken, function(user) {
      sendMessage(user, room, message, socket);
    });
  });

  socket.on('get profile', function(requestedUser) {
    console.log('get user profile: ', requestedUser.user);
    facebookTokenValid(requestedUser.accessToken, function(facebookUser) {
      //TODO: this allows any user to request any other user's profile
      // it should be secured to only get matches' profiles, but that would be
      // very difficult at this point
      getUserProfile(requestedUser, socket);
    });
  });
  
  socket.on('open room', function(users) {
    console.log('received open request: Users: ', users);
    facebookTokenValid(users.accessToken, function(user) {
      console.log('opening room');
      openFirebaseRoomForUsers(users, socket);
    });
  });

  socket.on('login validator', function(accessToken) {
    console.log('received login validator Request: ');
    facebookTokenValid(accessToken, function(user) {
      console.log('This guy is logged in:', user);
      socket.emit('user valid', user);
      getUserProfile(user, socket);
      updateUser(user, socket);
    });
  });

});

server.listen(httpPort, function() {
  console.log('socket.io server listening at %s', server.url);
});
