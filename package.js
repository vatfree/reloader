Package.describe({
  name: 'pathable:reloader',
  version: '1.5.0',
  summary: 'More control over hot code push reloading',
  git: 'https://github.com/pathable/reloader/',
  documentation: 'README.md',
});

Cordova.depends({
  'cordova-plugin-splashscreen': '4.1.0',
});

Package.onUse(function(api) {
  api.versionsFrom('1.8');

  api.use(
    ['ecmascript', 'reload', 'reactive-var', 'tracker', 'launch-screen'],
    'client'
  );

  api.mainModule('reloader.js', 'web.cordova');
  api.export('Reloader', 'client');
});
