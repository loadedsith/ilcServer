angular.module('ilcServer').controller('MainController', ['$scope', '$socket', function($scope, $socket) {
  console.log('Main Controller Reporting in Captin');
  
  $socket.on('loggedIn', function(data) {
    $scope.data = data;
  });

   // Raising an event
  $scope.raise = function(message) {
    $socket.emit('otherEvent', message);
  };

  //test user "open_fnvwvuk_user@tfbnw.net"'s access id, created using https://developers.facebook.com/apps/[APP API KEY]/roles/test-users/
  
  $scope.fakedToken = "CAAJnbZAScLU4BAFFKr39tZB3bZCW4xsOsRDcm03UssseHKK6fZAOcoyhSyCl2tZBaGW8t0b6rO7ZBmGVfC6ffr6XblUEZAAxyxSq4K6rAOH8JYkd1uH2GgmDonVoRuK153X42IpMt0QmSJR4u8krm4kUbvX9SYYghJpG1VLJHIdBttW8FWRZCA2jiBXY9v0st28eoZBc1nNv28aRNdqJCWfBr27ZA2FPCjaBUZD";
  $scope.fakeUserId = "1396362880657353";
  $scope.testLogin = function() {
    $socket.emit('loginValidator', $scope.fakedToken);
  };
  
  $scope.testLogin()
  
  $scope.openRoom = function() {
    $socket.emit('open room', {
      "localId":$scope.fakeUserId,
      "remoteId":11111
    });
  };
  $scope.openRandomRoom = function() {
    var fakeSecondUser = Math.floor( Math.random() * 10000 );//lookin for a 5 didgit random number, kk?
    var fakeUserIds = {
      "localId":$scope.fakeUserId,
      "remoteId":fakeSecondUser
    };
    $socket.emit('open room', fakeUserIds);
  };

  $scope.rooms = {};

  $socket.on('rooms update', function(room) {
    console.log('rooms update', room);
    $scope.rooms[String('r'+room)] = String(room);
  });
  
  $socket.on('rooms set', function(rooms) {
    $scope.rooms = rooms;
  });
  
  $scope.messages = {};
  
  $socket.on('room update', function(room) {
    console.log('room update', room);
    $scope.messages[room.room] = room;
  });
  
  $socket.on('room set', function(room) {
    console.log('room set', room);
    $scope.messages = {};
    $scope.messages[room.room] = room;
  });
  
}]);