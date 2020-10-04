import { Meteor } from 'meteor/meteor';
import { Tracker } from 'meteor/tracker';
import { ReactiveVar } from 'meteor/reactive-var';
import { LaunchScreen } from 'meteor/launch-screen';
import { settings, debugFn, PACKAGE_NAME } from './common';

const RefreshType = {
  INSTANTLY: 'instantly',
  START_AND_RESUME: 'startAndResume',
  START: 'start',
};

const CheckType = {
  EVERY_START: 'everyStart',
  FIRST_START: 'firstStart',
  NEVER: 'never',
};

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
  check: CheckType.EVERY_START,
  checkTimer: 0,
  refresh: RefreshType.START_AND_RESUME,
  idleCutoff: 1000 * 60 * 5, // 5 minutes
  launchScreenDelay: 500,
  alwaysCheckBeforeReload: true,
  automaticInitialization: true,
};

debugFn('starting - DEFAULT_OPTIONS', { DEFAULT_OPTIONS });
debugFn('starting - settings', { settings });
const options = Object.assign({}, DEFAULT_OPTIONS, settings);

debugFn('starting - options', { options });

const defaultRetry = () => console.log(`[${PACKAGE_NAME}] no retry function yet`);

const launchScreen = LaunchScreen.hold();

let initialized = false;

const Reloader = {
  _options: {},
  // eslint-disable-next-line no-console
  _retry: defaultRetry,
  updateAvailable: new ReactiveVar(false),
  isChecked: new ReactiveVar(false),

  debug(message, context) {
    debugFn(message, {
      ...context,
      updateAvailable: this.updateAvailable.get(),
      isChecked: this.isChecked.get(),
      _options: this._options,
    });
  },

  initialize(optionsParam = {}) {
    if (initialized) {
      return;
    }
    initialized = true;
    this._options = Object.assign({}, options, optionsParam);
    this._onPageLoad();
  },

  prepareToReload() {
    this.debug('prereload - show splashscreen');
    // Show the splashscreen
    navigator.splashscreen.show();

    const currentDate = Date.now();
    this.debug('prereload - reloaderWasRefreshed', { currentDate });
    // Set the refresh flag
    localStorage.setItem('reloaderWasRefreshed', currentDate);
  },

  reloadNow() {
    this.debug('reloadNow');
    if (this._isCheckBeforeReload() && !this.isChecked.get()) {
      this.debug(
        'not reloading because alwaysCheckBeforeReload is true and it is not checked yet'
      );
      return;
    }
    this.prepareToReload();

    // We'd like to make the browser reload the page using location.replace()
    // instead of location.reload(), because this avoids validating assets
    // with the server if we still have a valid cached copy. This doesn't work
    // when the location contains a hash however, because that wouldn't reload
    // the page and just scroll to the hash location instead.
    if (window.location.hash || window.location.href.endsWith('#')) {
      this.debug('reloadNow - reload');
      window.location.reload();
    } else {
      this.debug('reloadNow - replace');
      window.location.replace(window.location.href);
    }
  },

  // Should check if a cold start and (either everyStart is set OR firstStart
  // is set and it's our first start)
  _shouldCheckForUpdateOnStart() {
    this.debug('_shouldCheckForUpdateOnStart');
    if (!this._options.check || this._options.check === CheckType.NEVER) {
      this.debug('_shouldCheckForUpdateOnStart - check false', {
        check: this._options.check,
      });
      return false;
    }

    const isColdStart = !localStorage.getItem('reloaderWasRefreshed');
    const reloaderLastStart = localStorage.getItem('reloaderLastStart');
    this.debug('_shouldCheckForUpdateOnStart - info', {
      isColdStart,
      check: this._options.check,
      reloaderLastStart,
    });
    const should =
      isColdStart &&
      (this._options.check === CheckType.EVERY_START ||
        (this._options.check === CheckType.FIRST_START && !reloaderLastStart));

    this.debug('_shouldCheckForUpdateOnStart - should', { should });
    return should;
  },

  // Check if the idleCutoff is set AND we exceeded the idleCutOff limit AND the everyStart check is set
  _shouldCheckForUpdateOnResume() {
    this.debug('_shouldCheckForUpdateOnResume');
    if (!this._options.check || this._options.check === CheckType.NEVER) {
      this.debug('_shouldCheckForUpdateOnResume - check false', {
        check: this._options.check,
      });
      return false;
    }

    const reloaderLastPause = localStorage.getItem('reloaderLastPause');
    // In case a pause event was missed, assume it didn't make the cutoff
    if (!reloaderLastPause) {
      this.debug('_shouldCheckForUpdateOnResume no reloaderLastPause');
      return false;
    }

    // Grab the last time we paused
    const lastPause = Number(reloaderLastPause);

    // Calculate the cutoff timestamp
    const idleCutoffAt = Number(Date.now() - this._options.idleCutoff);

    this.debug('_shouldCheckForUpdateOnResume - info', {
      idleCutoff: this._options.idleCutoff,
      check: this._options.check,
      lastPause,
      idleCutoffAt,
    });
    return (
      this._options.idleCutoff &&
      lastPause < idleCutoffAt &&
      this._options.check === CheckType.EVERY_START
    );
  },

  _waitForUpdate(computation) {
    this.debug('_waitForUpdate');
    // Check if we have a HCP after the check timer is up
    Meteor.setTimeout(() => {
      // If there is a new version available
      if (this.updateAvailable.get()) {
        this.debug('_waitForUpdate - reloadNow');
        this.reloadNow();
      } else {
        // Stop waiting for update
        if (computation) {
          computation.stop();
        }

        this.debug('prereload - release launchScreen');
        launchScreen.release();

        if (
          !navigator ||
          !navigator.splashscreen ||
          !navigator.splashscreen.hide
        ) {
          console.warn(
            `[${PACKAGE_NAME}] navigator.splashscreen.hide not available`
          );
          return;
        }
        this.debug('prereload - hide splashscreen');
        navigator.splashscreen.hide();
      }
    }, this._options.checkTimer || 0);
  },

  _checkForUpdate() {
    this.debug('_checkForUpdate');
    if (this.updateAvailable.get()) {
      // Check for an even newer update
      this.debug('_checkForUpdate - check for an even newer update');
      this._waitForUpdate();
    } else {
      // Wait until update is available, or give up on timeout
      Tracker.autorun(c => {
        if (this.updateAvailable.get()) {
          this.debug('_checkForUpdate - reloadNow');
          this.reloadNow();
        }

        this._waitForUpdate(c);
      });
    }
  },

  _onPageLoad() {
    this.debug('_onPageLoad');
    if (this._shouldCheckForUpdateOnStart()) {
      this._checkForUpdate();
    } else {
      Meteor.setTimeout(() => {
        this.debug('_onPageLoad - release launchScreen');
        launchScreen.release();

        // Reset the reloaderWasRefreshed flag
        localStorage.removeItem('reloaderWasRefreshed');
      }, this._options.launchScreenDelay); // Short delay helps with white flash
    }
  },

  _onResume() {
    this.debug('_onResume');
    const shouldCheck = this._shouldCheckForUpdateOnResume();

    localStorage.removeItem('reloaderLastPause');

    if (shouldCheck) {
      this.debug('_onResume - show splashscreen');
      navigator.splashscreen.show();

      this._checkForUpdate();
      return;
    }

    // If we don't need to do an additional check
    // Check if there's a new version available already AND we need to refresh on resume
    if (
      this.updateAvailable.get() &&
      this._options.refresh === RefreshType.START_AND_RESUME
    ) {
      this.reloadNow();
    }
  },

  _isCheckBeforeReload() {
    this.debug('_isCheckBeforeReload');
    return this._options.alwaysCheckBeforeReload && this._options.beforeReload;
  },

  _callBeforeLoad() {
    this.debug('_callBeforeLoad');
    const updateApp = () => {
      this.debug('_callBeforeLoad set isChecked to true');
      this.isChecked.set(true);
      this._retry();
    };
    const holdAppUpdate = () => {
      this.debug('_callBeforeLoad set isChecked to false');
      this.isChecked.set(false);
    };
    this._options.beforeReload(updateApp, holdAppUpdate);
  },

  // https://github.com/meteor/meteor/blob/devel/packages/reload/reload.js#L104-L122
  _onMigrate(retry) {
    this.debug('_onMigrate');
    this._retry = retry || this._retry;
    if (
      this._options.refresh === RefreshType.INSTANTLY &&
      (!this._isCheckBeforeReload() || this.isChecked.get())
    ) {
      // we are calling prepareToReload because as we are returning true the reload
      // will happen in the reload package then we are updating our timestamps
      this.prepareToReload();

      this.isChecked.set(false);
      return [true, {}];
    }

    if (this._isCheckBeforeReload()) {
      this._callBeforeLoad();
    }

    // Set the flag
    this.updateAvailable.set(true);

    // Don't refresh yet
    return [false];
  },
};

if (options.automaticInitialization) {
  Reloader.initialize();
}

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
Reload._onMigrate(`${PACKAGE_NAME}`, retry => Reloader._onMigrate(retry));

export { Reloader };
