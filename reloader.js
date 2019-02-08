import { Meteor } from 'meteor/meteor';
import { Tracker } from 'meteor/tracker';
import { ReactiveVar } from 'meteor/reactive-var';
import { LaunchScreen } from 'meteor/launch-screen';

/**
 *  check: Match.Optional(Match.OneOf('everyStart', 'firstStart', false)),
 *  checkTimer: Match.Optional(Match.Integer),
 *  refresh: Match.Optional(
 *    Match.OneOf('startAndResume', 'start', 'instantly')
 *  ),
 *  idleCutoff: Match.Optional(Match.Integer),
 *  launchScreenDelay: Match.Optional(Match.Integer),
 *  debug: Boolean
 */
const DEFAULT_OPTIONS = {
  check: 'everyStart',
  checkTimer: 0,
  refresh: 'startAndResume',
  idleCutoff: 1000 * 60 * 5, // 5 minutes
  launchScreenDelay: 100,
};

const options =
  (Meteor.settings &&
    Meteor.settings.public &&
    Meteor.settings.public.reloader) ||
  {};

const debug = (message, context) => {
  if (!options.debug) {
    return;
  }
  // eslint-disable-next-line no-console
  console.log(`[pathable:reloader] ${message}`, JSON.stringify(context));
};

const launchScreen = LaunchScreen.hold();

const Reloader = {
  _options: {},
  updateAvailable: new ReactiveVar(false),

  initialize() {
    debug('initialize - DEFAULT_OPTIONS', { DEFAULT_OPTIONS });
    const optionsWithDefaults = Object.assign({}, DEFAULT_OPTIONS, options);

    Object.assign(this._options, optionsWithDefaults);
    debug('initialize - options', { _options: this._options });
  },

  prereload() {
    debug('prereload - show splashscreen');
    // Show the splashscreen
    navigator.splashscreen.show();

    const currentDate = Date.now();
    debug('prereload - reloaderWasRefreshed', { currentDate });
    // Set the refresh flag
    localStorage.setItem('reloaderWasRefreshed', currentDate);
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
      debug('reload - reload');
      window.location.reload();
    } else {
      debug('reload - replace');
      window.location.replace(window.location.href);
    }
  },

  // Should check if a cold start and (either everyStart is set OR firstStart
  // is set and it's our first start)
  _shouldCheckForUpdateOnStart() {
    debug('_shouldCheckForUpdateOnStart');
    if (!this._options.check) {
      debug('_shouldCheckForUpdateOnStart - check false', {
        check: this._options.check,
      });
      return false;
    }

    const isColdStart = !localStorage.getItem('reloaderWasRefreshed');
    const reloaderLastStart = localStorage.getItem('reloaderLastStart');
    debug('_shouldCheckForUpdateOnStart - info', {
      isColdStart,
      check: this._options.check,
      reloaderLastStart,
    });
    const should =
      isColdStart &&
      (this._options.check === 'everyStart' ||
        (this._options.check === 'firstStart' && !reloaderLastStart));

    debug('_shouldCheckForUpdateOnStart - should', { should });
    return should;
  },

  // Check if the idleCutoff is set AND we exceeded the idleCutOff limit AND the everyStart check is set
  _shouldCheckForUpdateOnResume() {
    debug('_shouldCheckForUpdateOnResume');
    if (!this._options.check) {
      debug('_shouldCheckForUpdateOnResume - check false', {
        check: this._options.check,
      });
      return false;
    }

    const reloaderLastPause = localStorage.getItem('reloaderLastPause');
    // In case a pause event was missed, assume it didn't make the cutoff
    if (!reloaderLastPause) {
      debug('_shouldCheckForUpdateOnResume no reloaderLastPause');
      return false;
    }

    // Grab the last time we paused
    const lastPause = Number(reloaderLastPause);

    // Calculate the cutoff timestamp
    const idleCutoffAt = Number(Date.now() - this._options.idleCutoff);

    debug('_shouldCheckForUpdateOnResume - info', {
      idleCutoff: this._options.idleCutoff,
      check: this._options.check,
      lastPause,
      idleCutoffAt,
    });
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
        debug('_waitForUpdate - reload');
        this.reload();
      } else {
        // Stop waiting for update
        if (computation) {
          computation.stop();
        }

        debug('prereload - release launchScreen');
        launchScreen.release();

        debug('prereload - hide splashscreen');
        navigator.splashscreen.hide();
      }
    }, this._options.checkTimer || 0);
  },

  _checkForUpdate() {
    debug('_checkForUpdate');
    if (this.updateAvailable.get()) {
      // Check for an even newer update
      debug('_checkForUpdate - check for an even newer update');
      this._waitForUpdate();
    } else {
      // Wait until update is available, or give up on timeout
      Tracker.autorun(c => {
        if (this.updateAvailable.get()) {
          debug('_checkForUpdate - reload');
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
        debug('_onPageLoad - release launchScreen');
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
      debug('_onResume - show splashscreen');
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

Reloader.initialize();
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
