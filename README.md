# Reloader

More control over hot code push reloading for your mobile apps. A replacement
for [`mdg:reload-on-resume`](https://github.com/meteor/mobile-packages/blob/master/packages/mdg:reload-on-resume/README.md)
with more options and better UX.

Before using this package we recommend that you understand what Hot Code Push is, you can learn all about it [here](https://guide.meteor.com/hot-code-push.html)

We provide two ways for you to handle your app code updates:

- Always reload
- Reload when the app allows (recommended)

### Always reload

You don't need to configure anything, your app is going to reload as soon as the
code is received.

If you want you can inform `launchScreenDelay` (0 by default) in milliseconds to
hold your splashscreen longer, avoiding a flash when the app is starting and
reloading.

```json
"public": {
  "packages": {
    "quave:reloader": {
      "launchScreenDelay": 200
    }
  }
}
```

### Reload when the app allows

We recommend this method as with it you can control when you are app is going to
reload. You can even delegate this decision to the final user.

In this case you must use `automaticInitialization` as `false` in your settings.

```json
"public": {
  "packages": {
    "quave:reloader": {
      "automaticInitialization": false
    }
  }
}
```

You also need to call 
`Reloader.initialize` in the render or initialization of your app providing a function (can be async) in the property `beforeReload`.

## Installing

```sh
meteor add quave:reloader
meteor remove mdg:reload-on-resume
```

## Configuration Options

### idleCutoff

Default: `1000 * 60 * 5 // 5 minutes`

How long (in ms) can an app be idle before we consider it a start and not a
resume. Applies only when `check: 'everyStart'`. Set to `0` to never check on
resume.

### launchScreenDelay

Default: `0`

How long the splash screen will be visible, it's useful to avoid your app being rendered just for a few milliseconds and then refreshing.

### automaticInitialization

Default: `true`

If you want to initialize the `reloader` yourself you need to turn
off `automaticInitialization`, this is useful when you want to provide code to
some callback as this is not possible using JSON initialization.

You can provide your callbacks calling Reloader.initialize(), for example:

```js
ReloaderCordova.initialize({
  beforeReload(ok, nok) {
    const isOkToReload = confirm('Your app will load now, ok?');
    if (isOkToReload) {
      ok();
      return;
    }
    nok();
  },
});
```
