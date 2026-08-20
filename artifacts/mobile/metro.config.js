const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Keep Expo's default watch folders and add the Tayyibati monorepo root.
config.watchFolders = [
  ...config.watchFolders,
  workspaceRoot,
];

// Resolve packages from the app first, then the workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Exclude temporary agent/skill directories.
config.resolver.blockList = [
  new RegExp(
    `${workspaceRoot.replace(/[/\\]/g, "[\\\\/]")}\\.local[\\\\/].*`
  ),
];

module.exports = config;