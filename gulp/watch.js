'use strict';

var gulp = require('gulp');

gulp.task('watch' , function() {
  gulp.watch('index.js', ['jshint', 'jscs']);
  gulp.watch(['app/**/*.js'], ['jshint', 'jscs']);//
});
