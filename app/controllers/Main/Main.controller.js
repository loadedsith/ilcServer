angular.module('ilcServer').controller('MainController', ['$scope', '$socket', function($scope, $socket) {
  console.log('Main Controller Reporting in Captin');

  $socket.on('loggedIn', function(data) {
    $scope.data = data;
  });

  //test user open_fnvwvuk_user@tfbnw.net's access id,
  //created using https://developers.facebook.com/apps/[APP API KEY]/roles/test-users/
  $scope.fakedToken = 'CAAJnbZAScLU4BAAteGZBCbX97E4VZArn60kZA1IenaK99plLa4' +
      'Y0vLGH4VzbP88w4eO56OsDpulBRyt7bzXj9sTdpQjcqmJ6WBkucfP57ihSwVtxbKg4ctIoM' +
      'OlafqhlTWZClYBOZAGeSt4OtuUZAmbUxsW70ZBZAgykE3HNpk3lRhSFdDBZAeYMJX18eYfK' +
      'bC2DkWZCqltgWWKCwcvsh3etZAGsN6TZAetWresIZD';

  $scope.fakeUserId = '1396362880657353';

  $scope.testLogin = function() {
    $socket.emit('loginValidator', $scope.fakedToken);

  };
  $scope.loginStatus = 'Original';

  $scope.setProfile = function() {
    var config = {
      'userId': $scope.fakeUserId,
      'accessToken': $scope.fakedToken,
      'profile':'Goober Bean Boo: ' + Math.floor(Math.random() * 100)
    };
    $socket.emit('set profile', config);
  };

  $socket.on('user valid', function(user) {

    $scope.loginStatus = 'Login Success! Getting Local Profile...';
    var config = {
      'userId': $scope.fakeUserId,
      'accessToken': $scope.fakedToken
    };
    $socket.emit('get profile', config);
  });

  $socket.on('user error', function(profile) {
    console.log('user error');
  });

  $socket.on('user profile', function(profile) {
    $scope.loginStatus = 'Got Profile!';
    $scope.profile = profile;
  });

  $scope.openRandomRoom = function() {
    var fakeSecondUser = 10000 + Math.floor(Math.random() * 100000);//lookin for a 5 didgit-ish random number, kk?
    var fakeUserIds = {
      'localId':$scope.fakeUserId,
      'remoteId':fakeSecondUser
    };
    $socket.emit('open room', fakeUserIds);
  };

  $scope.rooms = [];

  $socket.on('rooms update', function(room) {
    console.log('rooms update', room);
    $scope.rooms.push(String(room.remoteId));
  });

  $socket.on('rooms set', function(rooms) {
    console.log('rooms Set', rooms);
    $scope.rooms = rooms;
  });

  $scope.messages = {};

  $socket.on('room update', function(room) {
    console.log('room update', room);
    $scope.messages[room.room] = room;
  });

  $socket.on('room set', function(room) {
    console.log('room set', room);
    $scope.messages[room.room] = {};
    $scope.messages[room.room] = room.snapshot;
  });

}]);
