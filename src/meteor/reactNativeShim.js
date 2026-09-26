const runAfterInteractions = (callback) => {
  const timer = window.setTimeout(callback, 0);
  return { cancel: () => window.clearTimeout(timer) };
};

export const unstable_batchedUpdates = (callback, ...args) => callback(...args);
export const InteractionManager = { runAfterInteractions };

export default { InteractionManager, unstable_batchedUpdates };
