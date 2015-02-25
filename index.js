var originalConsole = console;

console = require('better-console');
console.time('loaded in: ');
var fb = require('fb');

var httpPort = process.env.HTTPPORT || 9999;
var socketPort =  process.env.PORT || 5000;
var restify = require('restify');
var socketio = require('socket.io')(socketPort);

var server = restify.createServer({
  name: 'ilcServer'
});

var io = socketio.listen(server);

var tokensByUserId = {};

var firebase = require('firebase');

var matchMaker = require('./matchMaker');

server.get(/.*/, restify.serveStatic({
  'directory': __dirname,
  'default': './app/index.html',
  'maxAge': 0
}));

var users = [];

var fs = require('fs');
var herokuOrFileEnv = function(name) {
  var anEnvVar;
  var fromFile = false;
  try{
    var anEnvVarFile = fs.readFileSync(__dirname + '/' + name).toString().split('\n');
    anEnvVar = anEnvVarFile[0];
    fromFile = true;
  }catch(e){
    anEnvVar = process.env[name];
  }
  var whereFrom = fromFile ? 'fromFile' : 'fromHeroku';
  if (anEnvVar === undefined) {
    console.error(name + ' was undefined, something is wrong with the environment.');
    process.exit(1);
  }
  console.log(name + ": ", anEnvVar, whereFrom);
  return anEnvVar;
};

var firebaseUrl = herokuOrFileEnv('firebaseUrl');
var appSecret = herokuOrFileEnv('fbAppSecret');
var appId = herokuOrFileEnv('fbAppId');


var roomsRef = new firebase(firebaseUrl + '/rooms/');

var usersRef = new firebase(firebaseUrl + '/users/');

var createRoomEmitsForUserOnSocket = function(roomName, userId, socket) {
  console.info('subscribe user to : ', 'rooms/' + roomName);
  var updateRef = new firebase(firebaseUrl + '/rooms/' + encodeURIComponent(roomName));
  updateRef.orderByChild('date').once('value', function(rooms) {
    socket.emit('room set', {'room': roomName, 'snapshot': rooms.val()});
    var first = true;
    updateRef.endAt().limitToLast(1).on('child_added', function(child) {
      if (first) {
        first = false;
      } else {
        socket.emit('room update', {'room': roomName, 'snapshot': child.val()});
      }
    });
  });
};

var pipeFirebaseToSocket = function(user, socket) {
  var userId = user.userId;
  if (user.rooms !== undefined) {
    for (var i = user.rooms.length - 1; i >= 0; i--) {
      var room = user.rooms[i];
      var roomName = makeRoomPairName(userId,room);
      createRoomEmitsForUserOnSocket(roomName, userId, socket);
    }
  } else {
    user.rooms = [];
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
        console.warn('error pushing room', error);
      }
    });

    roomsRef.child(sharedRoomKey).on('child_added', function(snapshot) {
      socket.emit('room update', {
        'room':sharedRoomKey,
        'snapshot':snapshot.val()
      });
    });

  } else {
    console.warn('couldnt create room, please provide a object with properties localId and remoteId, got: ', users);
  }
};

var facebookTokenValid = function(accessToken, callback) {
  if (accessToken === undefined) {
    console.warn('abort access token is missing. would have called this function:');
    originalConsole.log(callback);
    return;
  }

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
        callback(cachedUserResponse);
        foundCachedToken = true;
      }
    }
  }
  if (foundCachedToken === false) {
    fb.api(resource, function(response) {
      if (response.data !== undefined) {
        if (response.data['is_valid'] === true) {
          response.data.setTime = new Date().getTime();
          tokensByUserId[accessToken] = response;
          if (typeof callback === 'function') {
            callback(response);
          }
        } else {
          console.warn('response.is_valid is not true');
          console.dir([response, resource]);
          console.warn('abort access token is missing. would have called this function:');
          originalConsole.log(callback);
        }
      } else {
        console.warn('response.data is missing', response);
        console.log('resource', resource);
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
        console.info('created user'+user.data['user_id']);
        if(err !== null){
          console.warn('Failed creating user [' + user.data['user_id'] + ']. err status:', err);
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
  if (request.data !== undefined) {
    user = request.data['user_id'];
  }else{
    user = request.user;
  }
  usersRef.child(user).once('value', function(snapshot) {

    var value = snapshot.val();
    // console.log('> found' , value);

    if (value === null || value === undefined) {
      console.warn(' user not found, emit null user profile');
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
      socket.emit('user profile', (value || {}));
    }
  });
};

var setUserProfile = function(user, socket) {
  var profile = user.user.profile;
  if((profile||{}).name !== undefined){
    usersRef.child(user.user.data['user_id']).child('profile').set(profile, function(error) {
      socket.emit('user profile update', profile || error);
    });
  }else{
    console.warn('couldnt update user profile, as profile was unset');
  }
};

var makeRoomPairName = function(userA, userB) {
  var roomName;
  if (parseInt(userA) > parseInt(userB)) {
    roomName = String(userB + '+' + userA);
  } else {
    roomName = String(userA + '+' + userB);
  }
  return roomName;
};

var sendMessage = function(user, room, message, socket) {
  console.info('Send Message: room, message', room, message);
  console.dir([room, message]);
  var roomName = makeRoomPairName(user.data['user_id'], room);
  if(message!==undefined){
    var messageObject = {
      date: new Date().getTime(),
      user:user,
      message:message
    };

    roomsRef.child(roomName).push(messageObject, function() {
      // console.log('successfully posted message');
      messageObject.room = room;
      socket.emit('message sent', messageObject);
    });
  } else {
    console.warn('not sending message, as it was empty');
  }
};
var getUserMatches = function(user, socket) {
  usersRef.on('value',function(usersSnapshot) {
    var matchList = matchMaker.getMatchList(user, usersSnapshot);
    socket.emit('got user matchList', matchList);
  });
};

var closeRoom = function(config, user, socket){
  console.info('closing room',config);
  usersRef.child(user.data['user_id']).child('profile').child('rooms').once('value', function(snap) {
    var rooms = snap.val();
    var removeThisOne;
    if (rooms !== undefined && rooms !== null) {
      for (var i = rooms.length - 1; i >= 0; i--) {
        if (rooms[i]===config.room){
          removeThisOne = i;
        }
      }
      rooms.splice(removeThisOne, 1);
      usersRef.child(user.data['user_id']).child('profile').child('rooms').set(rooms,function(results) {
        console.info('room removed', config.room);
        socket.emit('room removed', config.room);
      });
    }
  });
};

var setCurrentInterest = function(user, interest, socket) {
  console.info('set currentInterest, interest-in:', interest);
  console.info('set currentInterest, user-in:', user);
  if(interest !== undefined){
    usersRef.child(user.data['user_id']).child('profile').child('currentInterest').set(interest, function(error) {
      console.info('updated currentInterest', interest || error);
      socket.emit('user current interest update', interest || error);
    });
  }else{
    console.warn('couldnt set currentInterest, as it was unset: ', interest);
  }
};

io.sockets.on('connection', function(socket) {
  var socketId = socket.id;
  console.warn('new connection, id: ',socketId);

  socket.on('disconnectMe', function () {
    console.info('disconnected user socketId' + socketId);
    socket.disconnect();
  });

  socket.on('set current interest', function(config) {
    var interest = (((config||{}).user || {}).profile||{}).currentInterest;
    if (interest !== undefined){
      facebookTokenValid(config.accessToken, function(user) {
        setCurrentInterest(user, interest, socket);
      });
    }else{
      console.warn('interest was undefined');
    }
  });
  socket.on('ping', function(data) {
    if(data){
      data.signed = 'gph';
    }else{
      data = {signed:'gph'};
    }
    console.log('ping', data);
    console.info('received ping', data);
    socket.emit('pong', data);
  });

  socket.on('set profile', function(user) {
    console.info('set profile user', user.user.data['user_id']);
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
    console.info('socket on: send message: ', config);
    var accessToken = config.accessToken;
    var message = config.message;
    var room = config.room;
    facebookTokenValid(accessToken, function(user) {
      sendMessage(user, room, message, socket);
    });
  });

  socket.on('get profile', function(requestedUser) {
    console.info('get user profile: ', requestedUser.user);
    facebookTokenValid(requestedUser.accessToken, function(facebookUser) {
      //TODO: this allows any user to request any other user's profile
      // it should be secured to only get matches' profiles, but that would be
      // very difficult at this point
      getUserProfile(requestedUser, socket);
    });
  });

  socket.on('close room', function(config) {
    console.info('close room request received');
    facebookTokenValid(config.accessToken, function(user) {
      closeRoom(config, user, socket);
    });
  });

  socket.on('open room', function(users) {
    console.info('received open request: Users: ', users);
    facebookTokenValid(users.accessToken, function(user) {
      console.info('opening room');
      openFirebaseRoomForUsers(users, socket);
    });
  });

  socket.on('login validator', function(accessToken) {
    facebookTokenValid(accessToken, function(user) {
      user.includeNoMatches = false;
      socket.emit('user valid', user);
      getUserProfile(user, socket);
      getUserMatches(user, socket);
      updateUser(user, socket);
    });
  });

});

server.listen(httpPort, function() {
  console.log('socket.io server listening at %s, socket: %s', server.url, socketPort);
  console.timeEnd('loaded in: ');
});
