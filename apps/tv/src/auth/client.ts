import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from "../config";

// For React Native, we need to use the API URL directly
const baseURL = config.apiUrl;

console.log('[TV Auth Client] Using baseURL:', baseURL);

// Create a storage adapter for AsyncStorage
const storageAdapter = {
  getItem: AsyncStorage.getItem,
  setItem: AsyncStorage.setItem,
  removeItem: AsyncStorage.removeItem,
};

export const authClient = createAuthClient({
  baseURL,
  plugins: [
    expoClient({
      scheme: "tv-app",
      storagePrefix: "tv-auth",
      storage: storageAdapter,
    }),
  ],
});

// Export typed auth methods for convenience
export const signIn = authClient.signIn.email;
export const signOut = authClient.signOut;
export const getSession = authClient.getSession;