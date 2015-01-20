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
  
  $scope.fakedToken = "CAAJnbZAScLU4BAEPd8V0gs8yLS9phoiTA9KllAnT4O8sDCxFwZBFZAZCTTZAOragVZBlvkYZCzuLmZBrwlUSKgseTUNHB" + 
                      "bYvaIh7RPCnZAiv21mOoHPl8Qvi3VmcZCM04cIYe0na9Vd3ESpCuYHV4JmOyPTib831H1JTmhwajaqp0mtLaR9XJvZBRK5" + 
                      "rzj7D6CVEO06bdfr9gYg0WIZCprfgndJ5InWZCBTuBWfUZD";

  $scope.testLogin = function() {
    $socket.emit('loginValidator', $scope.fakedToken);
  };

  $scope.rooms = [];

  $socket.on('rooms update', function(room) {
    $scope.rooms.push(room);
  });
  $socket.on('rooms set', function(rooms) {
    $scope.rooms = rooms;
  });
  
}]);