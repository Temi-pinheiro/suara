// Expo inlines EXPO_PUBLIC_* at build time; declare them so the client typechecks
// without pulling in Node's full `process` typings.
declare const process: {
  env: {
    EXPO_PUBLIC_SUARA_API?: string;
    EXPO_PUBLIC_SUARA_USER?: string;
  };
};
