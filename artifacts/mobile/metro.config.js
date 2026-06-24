const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch entire monorepo so Metro can find packages hoisted to workspace root
config.watchFolders = [workspaceRoot];

// Resolve packages from the app first, then the workspace root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Exclude agent/skill temp directories so Metro doesn't crash when they
// are created and deleted while the bundler is running.
config.resolver.blockList = [
  new RegExp(`${workspaceRoot.replace(/[/\\]/g, "[\\\\/]")}\\.local[\\\\/].*`),
];

module.exports = config;
