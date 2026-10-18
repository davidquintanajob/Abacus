package com.agust9999;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.os.Build;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

public class WifiNetworkModule extends ReactContextBaseJavaModule {
    private ReactApplicationContext reactContext;
    private Network boundNetwork;

    public WifiNetworkModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "WifiNetworkModule";
    }

    @ReactMethod
    public void bindToWifiNetwork(final Promise promise) {
        try {
            ConnectivityManager connectivityManager = 
                (ConnectivityManager) reactContext.getSystemService(Context.CONNECTIVITY_SERVICE);

            if (connectivityManager == null) {
                promise.reject("NO_CONNECTIVITY_MANAGER", "ConnectivityManager not available");
                return;
            }

            // Crear NetworkRequest para WiFi
            NetworkRequest.Builder builder = new NetworkRequest.Builder();
            builder.addCapability(NetworkCapabilities.NET_CAPABILITY_NOT_RESTRICTED);
            builder.addCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED);
            builder.addTransportType(NetworkCapabilities.TRANSPORT_WIFI);

            NetworkRequest networkRequest = builder.build();

            // Registrar callback para encontrar la red WiFi
            ConnectivityManager.NetworkCallback networkCallback = 
                new ConnectivityManager.NetworkCallback() {
                    @Override
                    public void onAvailable(Network network) {
                        super.onAvailable(network);
                        
                        // Vincular el proceso a esta red WiFi
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            boolean success = connectivityManager.bindProcessToNetwork(network);
                            if (success) {
                                boundNetwork = network;
                                promise.resolve(true);
                            } else {
                                promise.reject("BIND_FAILED", "Failed to bind to network");
                            }
                        } else {
                            promise.reject("API_LEVEL_TOO_LOW", "Requires Android 6.0+");
                        }
                        
                        // Desregistrar el callback después de vincular
                        connectivityManager.unregisterNetworkCallback(this);
                    }

                    @Override
                    public void onUnavailable() {
                        super.onUnavailable();
                        promise.reject("NETWORK_UNAVAILABLE", "No WiFi network available");
                    }
                };

            // Solicitar la red
            connectivityManager.requestNetwork(networkRequest, networkCallback);

        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void unbindFromNetwork(final Promise promise) {
        try {
            ConnectivityManager connectivityManager = 
                (ConnectivityManager) reactContext.getSystemService(Context.CONNECTIVITY_SERVICE);

            if (connectivityManager == null) {
                promise.reject("NO_CONNECTIVITY_MANAGER", "ConnectivityManager not available");
                return;
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                connectivityManager.bindProcessToNetwork(null);
                boundNetwork = null;
                promise.resolve(true);
            } else {
                promise.reject("API_LEVEL_TOO_LOW", "Requires Android 6.0+");
            }
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void isWifiConnected(final Promise promise) {
        try {
            ConnectivityManager connectivityManager = 
                (ConnectivityManager) reactContext.getSystemService(Context.CONNECTIVITY_SERVICE);

            if (connectivityManager == null) {
                promise.reject("NO_CONNECTIVITY_MANAGER", "ConnectivityManager not available");
                return;
            }

            Network activeNetwork = connectivityManager.getActiveNetwork();
            if (activeNetwork == null) {
                promise.resolve(false);
                return;
            }

            NetworkCapabilities capabilities = 
                connectivityManager.getNetworkCapabilities(activeNetwork);

            if (capabilities == null) {
                promise.resolve(false);
                return;
            }

            boolean isWifi = capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI);
            promise.resolve(isWifi);

        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }
}
