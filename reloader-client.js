import { debugFn } from './common';

const Reloader = {
  initialize() {
    debugFn('no reloader on client, only on Cordova');
  },
};

export { Reloader };
