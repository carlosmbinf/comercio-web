import Meteor from '@meteorrn/core';
import { METEOR_DDP_URL } from '../config';

const webAsyncStorage = {
  async getItem(key) {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
  },
  async setItem(key, value) {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  },
  async removeItem(key) {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  },
};

let connectionPromise = null;

export function connectToMeteor() {
  if (!METEOR_DDP_URL) {
    return Promise.reject(new Error('Configura VITE_METEOR_DDP_URL en comercio-web/.env.'));
  }

  if (Meteor.status?.()?.connected) return Promise.resolve(true);
  if (connectionPromise) return connectionPromise;

  connectionPromise = Promise.resolve(
    Meteor.connect(METEOR_DDP_URL, { AsyncStorage: webAsyncStorage, NetInfo: null }),
  )
    .then(() => true)
    .finally(() => {
      connectionPromise = null;
    });

  return connectionPromise;
}

export function callMeteor(methodName, ...args) {
  return new Promise((resolve, reject) => {
    Meteor.call(methodName, ...args, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

export function loginWithPassword(identifier, password) {
  return new Promise((resolve, reject) => {
    Meteor.loginWithPassword(identifier, password, (error) => {
      if (error) reject(error);
      else resolve(Meteor.userId());
    });
  });
}

export function getGoogleClientConfig() {
  return callMeteor('auth.googleClientConfig');
}

export function loginWithGoogleIdToken(idToken, nonce) {
  return new Promise((resolve, reject) => {
    Meteor._startLoggingIn?.();
    Meteor.call('login', { googleIdToken: idToken, nonce }, (error, response) => {
      Meteor._handleLoginCallback?.(error, response);

      if (error) {
        reject(error);
        return;
      }

      resolve(response?.id || response?.userId || Meteor.userId());
    });
  });
}

export function logoutFromMeteor() {
  return new Promise((resolve, reject) => {
    Meteor.logout((error) => {
      if (error) reject(error);
      else resolve(true);
    });
  });
}

export { Meteor };
export default Meteor;
