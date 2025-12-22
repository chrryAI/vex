// Mock for react-hot-toast on React Native
// React Native should use native toast/alert instead

const toast = message => {
  if (typeof message === 'string') {
    console.log('[Toast]', message);
  }
  return null;
};

toast.success = message => {
  console.log('[Toast Success]', message);
  return null;
};

toast.error = message => {
  console.error('[Toast Error]', message);
  return null;
};

toast.loading = message => {
  console.log('[Toast Loading]', message);
  return null;
};

toast.dismiss = () => {
  // No-op
};

toast.promise = (promise, msgs) => {
  return promise;
};

export default toast;
export {toast};
