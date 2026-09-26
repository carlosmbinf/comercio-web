const noSubscription = () => () => {};

const netInfoForBrowser = {
  addEventListener: noSubscription,
  configure: () => {},
  fetch: async () => ({ isConnected: true, isInternetReachable: true, type: 'unknown' }),
};

export default netInfoForBrowser;
