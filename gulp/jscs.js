var gulp = require('gulp');

var jscs = require('gulp-jscs');

gulp.task('jscs', function() {
  return gulp.src(['index.js', 'app/**/*.js'])
    .pipe(jscs({
        'preset': 'google',
        'fileExtensions': [ '.js', 'jscs' ],

        'requireParenthesesAroundIIFE': true,
        'maximumLineLength': 120,
        'validateLineBreaks': null,
        'validateIndentation': 2,

        'disallowKeywords': ['with'],
        'disallowSpacesInsideObjectBrackets': null,
        'disallowImplicitTypeConversion': ['string'],

        'safeContextKeyword': '_this',

        'excludeFiles': [
            'test/data/**'
        ]
    }
  )).on('error', function(e) {
    this.end();
  })
})
// [ \t]+$ finds trailing whitespaces
// (?!\s+)((\b|'|")(===|else|,|=,\){)(\b|'|"))(?!\s) finds some sticky stuff