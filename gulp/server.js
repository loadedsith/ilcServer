var gulp = require('gulp')
  , nodemon = require('gulp-nodemon')
  , jshint = require('gulp-jshint')

gulp.task('server', function() {
  nodemon({
    script: 'index.js',
    ext: 'html js',
    env: { 'NODE_ENV': 'development' },
    ignore: ['gulp/*.js'],
    nodeArgs: ['--debug']
  })
   .on('change', ['jshint'])//, 'jscs'
   .on('restart', function () {
     console.log('restarted!')
   });
 });
