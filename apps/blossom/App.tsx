/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, {useState} from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import AppProviders from '../../packages/ui/context/providers';
import {NativeRouteProvider} from '../../packages/ui/platform/navigation';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const [navState, setNavState] = useState<any>();

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
  console.log(`🚀 ~ App ~ textStyle:`, isDarkMode);

  return (
    <View style={backgroundStyle as any}>
      <NavigationContainer onStateChange={setNavState}>
        <NativeRouteProvider state={navState}>
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
        </NativeRouteProvider>
      </NavigationContainer>
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
