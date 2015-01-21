'use strict';

var gulp = require('gulp');

require('require-dir')('./gulp');

gulp.task('default',['jshint','jscs'], function() {
    gulp.start('server');
});