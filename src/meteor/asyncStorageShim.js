const browserStorage = {
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

export default browserStorage;
