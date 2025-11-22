/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import AppProviders from '../../packages/ui/context/providers';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  const backgroundStyle = {
    backgroundColor: isDarkMode ? '#333' : '#FFF',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  };

  const textStyle = {
    color: isDarkMode ? '#FFF' : '#000',
    fontSize: 24,
    fontWeight: '600',
  };

  return (
    <View>
      <AppProviders>
        <Text
          style={{
            color: isDarkMode ? '#FFF' : '#000',
            fontSize: 24,
            fontWeight: '600',
          }}>
          App
        </Text>
      </AppProviders>
      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;
