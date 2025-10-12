declare module "firebase/auth/react-native" {
  import { FirebaseApp } from "firebase/app";
  import {
    Auth,
    InitializeAuthSettings,
    Persistence,
  } from "firebase/auth";

  export function initializeAuth(
    app: FirebaseApp,
    deps?: InitializeAuthSettings
  ): Auth;

  export function getReactNativePersistence(storage: unknown): Persistence;
}
