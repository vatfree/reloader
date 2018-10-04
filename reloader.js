import { Tracker } from 'meteor/tracker';
import { ReactiveVar } from 'meteor/reactive-var';
import { check, Match } from 'meteor/check';
import { LaunchScreen } from 'meteor/launch-screen';

const DEBUG = true;

const debug = (...args) => {
  // eslint-disable-next-line no-console
  if (DEBUG) console.debug(...['[pathable:reloader]', ...args]);
};

const launchScreen = LaunchScreen.hold();

const Reloader = {
  _options: {},
  updateAvailable: new ReactiveVar(false),

  configure(optionsParam) {
    debug('configure');
    check(optionsParam, {
      check: Match.Optional(Match.OneOf('everyStart', 'firstStart', false)),
      checkTimer: Match.Optional(Match.Integer),
      refresh: Match.Optional(
        Match.OneOf('startAndResume', 'start', 'instantly')
      ),
      idleCutoff: Match.Optional(Match.Integer),
      launchScreenDelay: Match.Optional(Match.Integer),
    });

    const options = {
      ...optionsParam,
      checkTimer: optionsParam.checkTimer || 3000,
    };

    Object.assign(this._options, options);
    debug('configure._options', this._options);
  },

  prereload() {
    debug('prereload');
    // Show the splashscreen
    navigator.splashscreen.show();

    // Set the refresh flag
    localStorage.setItem('reloaderWasRefreshed', Date.now());
  },

  reload() {
    debug('reload');
    this.prereload();

    // We'd like to make the browser reload the page using location.replace()
    // instead of location.reload(), because this avoids validating assets
    // with the server if we still have a valid cached copy. This doesn't work
    // when the location contains a hash however, because that wouldn't reload
    // the page and just scroll to the hash location instead.
    if (window.location.hash || window.location.href.endsWith('#')) {
      window.location.reload();
    } else {
      window.location.replace(window.location.href);
    }
  },

  // Should check if a cold start and (either everyStart is set OR firstStart
  // is set and it's our first start)
  _shouldCheckForUpdateOnStart() {
    debug('_shouldCheckForUpdateOnStart');
    if (!this._options.check) {
      return false;
    }

    const isColdStart = !localStorage.getItem('reloaderWasRefreshed');
    return (
      isColdStart &&
      (this._options.check === 'everyStart' ||
        (this._options.check === 'firstStart' &&
          !localStorage.getItem('reloaderLastStart')))
    );
  },

  // Check if the idleCutoff is set AND we exceeded the idleCutOff limit AND the everyStart check is set
  _shouldCheckForUpdateOnResume() {
    debug('_shouldCheckForUpdateOnResume');
    if (!this._options.check) {
      return false;
    }

    // In case a pause event was missed, assume it didn't make the cutoff
    if (!localStorage.getItem('reloaderLastPause')) {
      return false;
    }

    // Grab the last time we paused
    const lastPause = Number(localStorage.getItem('reloaderLastPause'));

    // Calculate the cutoff timestamp
    const idleCutoffAt = Number(Date.now() - this._options.idleCutoff);

    return (
      this._options.idleCutoff &&
      lastPause < idleCutoffAt &&
      this._options.check === 'everyStart'
    );
  },

  _waitForUpdate(computation) {
    debug('_waitForUpdate');
    // Check if we have a HCP after the check timer is up
    Meteor.setTimeout(() => {
      // If there is a new version available
      if (this.updateAvailable.get()) {
        this.reload();
      } else {
        // Stop waiting for update
        if (computation) {
          computation.stop();
        }

        launchScreen.release();
        navigator.splashscreen.hide();
      }
    }, this._options.checkTimer);
  },

  _checkForUpdate() {
    debug('_checkForUpdate');
    if (this.updateAvailable.get()) {
      // Check for an even newer update
      this._waitForUpdate();
    } else {
      // Wait until update is available, or give up on timeout
      Tracker.autorun(c => {
        if (this.updateAvailable.get()) {
          this.reload();
        }

        this._waitForUpdate(c);
      });
    }
  },

  _onPageLoad() {
    debug('_onPageLoad');
    if (this._shouldCheckForUpdateOnStart()) {
      this._checkForUpdate();
    } else {
      Meteor.setTimeout(() => {
        launchScreen.release();

        // Reset the reloaderWasRefreshed flag
        localStorage.removeItem('reloaderWasRefreshed');
      }, this._options.launchScreenDelay); // Short delay helps with white flash
    }
  },

  _onResume() {
    debug('_onResume');
    const shouldCheck = this._shouldCheckForUpdateOnResume();

    localStorage.removeItem('reloaderLastPause');

    if (shouldCheck) {
      navigator.splashscreen.show();

      this._checkForUpdate();
      return;
    }

    // If we don't need to do an additional check
    // Check if there's a new version available already AND we need to refresh on resume
    if (
      this.updateAvailable.get() &&
      this._options.refresh === 'startAndResume'
    ) {
      this.reload();
    }
  },

  // https://github.com/meteor/meteor/blob/devel/packages/reload/reload.js#L104-L122
  _onMigrate() {
    debug('_onMigrate');
    if (this._options.refresh === 'instantly') {
      this.prereload();

      return [true, {}];
    }

    // Set the flag
    this.updateAvailable.set(true);

    // Don't refresh yet
    return [false];
  },
};

// Set the defaults
Reloader.configure({
  check: false,
  refresh: 'startAndResume',
  idleCutoff: 1000 * 60 * 10, // 10 minutes
  launchScreenDelay: 100,
});

Reloader._onPageLoad();

// Set the last start flag
localStorage.setItem('reloaderLastStart', Date.now());

// Watch for the app resuming
document.addEventListener(
  'resume',
  () => {
    Reloader._onResume();
  },
  false
);

localStorage.removeItem('reloaderLastPause');

// Watch for the device pausing
document.addEventListener(
  'pause',
  () => {
    // Save to localStorage
    localStorage.setItem('reloaderLastPause', Date.now());
  },
  false
);

// Capture the reload
// import { Reload } from 'meteor/reload' is not working
// eslint-disable-next-line no-undef
Reload._onMigrate('pathable:reloader', retry => Reloader._onMigrate(retry));

export { Reloader };
