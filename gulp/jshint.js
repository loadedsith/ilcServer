'use strict';

var gulp = require('gulp');

var notify = require('gulp-notify');
var jshint = require('gulp-jshint-cached');

function execute(command, callback) {
  var exec = require('child_process').exec;
  exec(command, function(error, stdout, stderr) { callback(stdout); });
};

notify.on('click', function(options) {
  var message = options.message;
  var lines = message.split('\n');
  var txmtUrl = lines[lines.length-2];//-2 because there's an extra '\n' on the messages so we dont actually want the last line
  execute("open "+ txmtUrl, function() {
    // console.log('opening in TextMate');
  });
});

var jshintConfig = {
    "sub": true,
};

gulp.task('jshint', function() {//add ['test'] here to auto test w/ server
  gulp.src(['index.js', 'app/**/*.js'])
    .pipe(jshint(jshintConfig))
    // Use gulp-notify as jshint reporter
    .pipe(notify({
      title: 'JSHint',
      message:function(file) {
      if (file.jshint.success) {
        // Don't show something if success
        return false;
      }
      var errors = file.jshint.results.map(function(data) {
        if (data.error) {
          return '(' + data.error.line + ':' + data.error.character + ') ' + data.error.reason+'\n'+
             'txmt://open?url=file://' + file.path + '&line='+data.error.line + '&column=' + data.error.character+'\n';
        }
      }).join('\n');
      return file.relative + ' (' + file.jshint.results.length + ' errors)\n' + errors;
    }, wait:true}));
});