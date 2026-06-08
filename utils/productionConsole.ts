declare const __DEV__: boolean | undefined;

const isDevRuntime =
  typeof __DEV__ === "boolean" ? __DEV__ : process.env.NODE_ENV !== "production";

if (!isDevRuntime) {
  console.log = () => undefined;
  console.debug = () => undefined;
  console.info = () => undefined;
  console.warn = () => undefined;
}
