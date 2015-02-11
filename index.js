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
    updateRef.endAt().limitToLast(1).on('child_added', function(child) {
      if (first) {
        first = false;
      } else {
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
  if (accessToken === undefined) {
    console.error('---------abort access token is missing');
    console.log('callback', callback);
    return;
  }

  var appId = '676670295780686';
  var appAccessToken = appId + '|' + appSecret;
  //https://graph.facebook.com/debug_token?input_token={id}&access_token={appAccessToken}
  var resource = 'debug_token?input_token=' + accessToken + '&access_token=' + appAccessToken;

  var foundCachedToken = false;
  var cachedUserResponse = tokensByUserId[accessToken];
  if (cachedUserResponse !== undefined) {
    var now = new Date().getTime();
    now = now / 1000;
    if (cachedUserResponse.data['expires_at'] > now) {
      if (typeof callback === 'function') {
        console.log('using cached facebook authority');
        callback(cachedUserResponse);
        foundCachedToken = true;
      }
    }
  }
  if (foundCachedToken === false) {
    console.log('new facebook request must be made');
    console.log('resource', resource);
    fb.api(resource, function(response) {
      console.log('-----response', response);
      if (response.data !== undefined) {
        if (response.data['is_valid'] === true) {
          console.log('granted authority by facebook');
          response.data.setTime = new Date().getTime();
          tokensByUserId[accessToken] = response;
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
  }
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
    if (value.profile.rooms !== undefined) {
      for (var room in value.profile.rooms) {
        u.rooms.push(value.profile.rooms[room]);
      }
    }
    pipeFirebaseToSocket(u, socket);
  });
};

var getUserProfile = function(request, socket) {
  var user;
  // console.log('get user profile: request', request);
  if (request.data !== undefined) {
    user = request.data['user_id'];
  }else{
    user = request.user;
  }

  console.log('looking for ' + user + ' profile');
  usersRef.child(user).once('value', function(snapshot) {

    var value = snapshot.val();
    // console.log('> found' , value);

    if (value === null || value === undefined) {
      console.log('emit null user profile');
      socket.emit('user profile', {});
    }else{
      if(value.profile === undefined){
        value.profile = {
          'aboutMe' : '',
          'blacklist' : [ ],
          'email' : '',
          'id' : user,
          'interests' : [ ],
          'name' : '',
          'test1:':Math.floor(Math.random()*1000)
        };
      }
      // socket.emit('user profile', (value.profile || {}));//send back the whole user.
      console.log('emit user profile',value);
      socket.emit('user profile', (value || {}));
    }
  });
};

var setUserProfile = function(user, socket) {
  var profile = user.user.profile;
  if((profile||{}).name !== undefined){
    usersRef.child(user.user.data['user_id']).child('profile').set(profile, function(error) {
      console.log('updated profile', profile || error);
      socket.emit('user profile update', profile || error);
    });
  }else{
    console.log('couldnt update user profile, as profile was unset');
  }
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
    var matchList = matchMaker.getMatchList(user, usersSnapshot);
    socket.emit('got user matchList', matchList);
  });
};

io.sockets.on('connection', function(socket) {
  var socketId = socket.id;


  socket.on('disconnect', function () {
    console.log('disconnected user socketId' + socketId);
    socket.disconnect();
  });

  socket.on('ping', function(data) {
    if(data){
      data.signed = 'gph';
    }else{
      data = {signed:'gph'};
    }

    console.log('recieved ping', data);
    socket.emit('pong', data);
  });

  socket.on('set profile', function(user) {
    console.log('set profile user', user);
    facebookTokenValid(user.accessToken, function(fbUser) {
      setUserProfile(user, socket);
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
    console.log('received login validator access token: ',accessToken);
    facebookTokenValid(accessToken, function(user) {
      console.log('This guy is logged in:', user);
      socket.emit('user valid', user);
      getUserProfile(user, socket);
      getUserMatches(user, socket);
      updateUser(user, socket);
    });
  });

});

server.listen(httpPort, function() {
  console.log('socket.io server listening at %s', server.url);
});
