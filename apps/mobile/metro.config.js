const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const config = getDefaultConfig(projectRoot);
const mobileNodeModules = path.resolve(projectRoot, "node_modules");
const workspaceNodeModules = path.resolve(workspaceRoot, "node_modules");
const mobileReact = path.resolve(mobileNodeModules, "react");
const mobileReactDom = path.resolve(mobileNodeModules, "react-dom");
const mobileReactNative = path.resolve(mobileNodeModules, "react-native");
const pinnedMobileModules = ["react", "react-dom", "react-native"];
const firebaseCommonJsModules = {
  "@firebase/app": path.resolve(mobileNodeModules, "@firebase/app/dist/index.cjs.js"),
  "@firebase/component": path.resolve(mobileNodeModules, "@firebase/component/dist/index.cjs.js"),
  "@firebase/logger": path.resolve(mobileNodeModules, "@firebase/logger/dist/index.cjs.js"),
  "@firebase/util": path.resolve(mobileNodeModules, "@firebase/util/dist/index.cjs.js")
};

config.watchFolders = [path.resolve(workspaceRoot, "packages")];
config.resolver.disableHierarchicalLookup = false;
config.resolver.nodeModulesPaths = [mobileNodeModules, workspaceNodeModules];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  react: mobileReact,
  "react-dom": mobileReactDom,
  "react-native": mobileReactNative
};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const shouldUseMobileCopy = pinnedMobileModules.some(
    (name) => moduleName === name || moduleName.startsWith(`${name}/`)
  );

  if (shouldUseMobileCopy) {
    return {
      type: "sourceFile",
      filePath: require.resolve(moduleName, { paths: [mobileNodeModules] })
    };
  }

  if (firebaseCommonJsModules[moduleName]) {
    return {
      type: "sourceFile",
      filePath: firebaseCommonJsModules[moduleName]
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
