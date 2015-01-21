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
  
  $scope.fakedToken = "CAAJnbZAScLU4BAP9duyGz4EC0vGA4HXCRQYv0tH5IfIxZB9OBeOZCubfPph2ImyBq5v2b7oaInYj2TmjNJ2ukhs8OZBBH9o6MMxLoZC7OpXJfCQIdkOpoHKTnbFbVOtKDNB0vrLYMmrZCIQLkyJm0fH04OUlCFovXujckwZBAeTSl3ST1H6a3jk0eFhX7e9hvn8JUAtH5nZABPmkXiIhZCSfzLKyF3ULoGQEZD";
  $scope.fakeUserId = "1396362880657353";
  $scope.testLogin = function() {
    $socket.emit('loginValidator', $scope.fakedToken);
  };
  
  $socket.emit('get profile', {"userId":$scope.fakeUserId,"accessToken":$scope.fakedToken});
  
  $scope.testLogin()
  
  $scope.openRoom = function() {
    $socket.emit('open room', {
      "accessToken": $scope.fakedToken,
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

  $scope.rooms = [];

  $socket.on('rooms update', function(room) {
    console.log('rooms update', room);
    $scope.rooms.push(String(room.remoteId));
  });
  
  $socket.on('rooms set', function(rooms) {
    console.log('rooms Set',rooms);
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