import { getSettings } from 'meteor/quave:settings';

export const PACKAGE_NAME = 'quave:reloader';
export const settings = getSettings({ packageName: PACKAGE_NAME });

export const debugFn = (message, context) => {
  if (!settings.debug) {
    return;
  }
  // eslint-disable-next-line no-console
  console.log(`[${PACKAGE_NAME}] ${message}`, JSON.stringify(context));
};
