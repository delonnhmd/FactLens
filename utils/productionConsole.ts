declare const __DEV__: boolean | undefined;

const isDevRuntime =
  typeof __DEV__ === "boolean" ? __DEV__ : process.env.NODE_ENV !== "production";

const suppressProductionLogs =
  process.env.EXPO_PUBLIC_SUPPRESS_PRODUCTION_LOGS === "1";

if (!isDevRuntime && suppressProductionLogs) {
  console.log = () => undefined;
  console.debug = () => undefined;
  console.info = () => undefined;
  console.warn = () => undefined;
}
