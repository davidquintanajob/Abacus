const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Forzar a Metro a pasar por Babel los archivos JS de node_modules que tengan sintaxis moderna
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

// Esta regla le quita el bloqueo estricto a node_modules para que Babel pueda actuar en paquetes modernos
config.resolver.unstable_enablePackageExports = true;

module.exports = config;