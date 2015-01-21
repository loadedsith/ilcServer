angular
  .module('ilcServer', ['ngSocket']).config(['$socketProvider',
    function($socketProvider) {
      $socketProvider.setUrl('http://0.0.0.0:5000');
    }
  ]);
