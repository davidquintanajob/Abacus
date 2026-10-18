import { NativeModules } from 'react-native';

const { WifiNetworkModule } = NativeModules;

export const bindToWifiNetwork = async () => {
  if (!WifiNetworkModule) {
    console.warn('WifiNetworkModule not available');
    return false;
  }
  try {
    return await WifiNetworkModule.bindToWifiNetwork();
  } catch (error) {
    console.error('Error binding to WiFi network:', error);
    return false;
  }
};

export const unbindFromNetwork = async () => {
  if (!WifiNetworkModule) {
    console.warn('WifiNetworkModule not available');
    return false;
  }
  try {
    return await WifiNetworkModule.unbindFromNetwork();
  } catch (error) {
    console.error('Error unbinding from network:', error);
    return false;
  }
};

export const isWifiConnected = async () => {
  if (!WifiNetworkModule) {
    console.warn('WifiNetworkModule not available');
    return false;
  }
  try {
    return await WifiNetworkModule.isWifiConnected();
  } catch (error) {
    console.error('Error checking WiFi connection:', error);
    return false;
  }
};
