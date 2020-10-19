# Reloader

## 2.0 introduced the ability for the app to control the reload. Readme will be updated soon.

More control over hot code push reloading for your mobile apps. A replacement
for [`mdg:reload-on-resume`](https://github.com/meteor/mobile-packages/blob/master/packages/mdg:reload-on-resume/README.md)
with more options and better UX.

We provide two ways:

- Always reload
- Reload when the app allows (recommended)

### Always reload

You don't need to configure anything, your app is going to reload as soon as the
HCP is available.

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


### idleCutoff

Default: `1000 * 60 * 5 // 5 minutes`

How long (in ms) can an app be idle before we consider it a start and not a
resume. Applies only when `check: 'everyStart'`. Set to `0` to never check on
resume.

### launchScreenDelay

**Planned option for future version. Currently not configurable.**

Default: `0`

### automaticInitialization

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
