Package.describe({
  name: 'pathable:reloader',
  version: '1.4.0',
  summary: 'More control over hot code push reloading',
  git: 'https://github.com/jamielob/reloader/',
  documentation: 'README.md'
});

Cordova.depends({
  'cordova-plugin-splashscreen': '4.1.0'
});

Package.onUse(function(api) {
  api.versionsFrom('1.3.1');

  api.use(['ecmascript',
           'check',
           'reload',
           'reactive-var',
           'tracker',
           'launch-screen'], 'client');

  api.mainModule('reloader.js', 'web.cordova');
  api.mainModule('browser.js', 'web.browser');
  //  when testing, uncomment this line:
  // api.mainModule('reloader.js', 'client');

  api.export('Reloader', 'client');
});

// No way to make this only happen onTest
Npm.depends({
  sinon: '1.17.3'
});

Package.onTest(function(api) {
  api.use('pathable:reloader', 'client');

  api.use(['ecmascript',
           'practicalmeteor:mocha'], 'client');

  api.mainModule('reloader-tests.js', 'client');
});
