/**
 * @format
 */

// Import polyfills for web-only APIs
import 'react-native-get-random-values';
import 'react-native-gesture-handler';
// Import react-native-svg to register native components early
import 'react-native-svg';
import './polyfills';

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

// Global error handler to catch module loading errors
global.ErrorUtils.setGlobalHandler((error, isFatal) => {
  console.error('GLOBAL ERROR CAUGHT:');
  console.error('Error:', error);
  console.error('Message:', error.message);
  console.error('Stack:', error.stack);
  console.error('Is Fatal:', isFatal);

  // Try to extract more info
  if (error.stack) {
    const stackLines = error.stack.split('\n');
    console.error('Stack trace lines:');
    stackLines.forEach((line, i) => {
      console.error(`  ${i}: ${line}`);
    });
  }
});

AppRegistry.registerComponent(appName, () => App);
