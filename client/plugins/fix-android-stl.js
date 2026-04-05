const { withGradleProperties } = require('expo/config-plugins');

/**
 * Forces c++_shared as the Android STL for all native module builds.
 *
 * Some native modules bundle CMakeLists.txt files that default to the
 * static STL, which can produce "undefined symbol: std::terminate" linker
 * errors at build time. Setting ANDROID_STL=c++_shared at the project level
 * guarantees a single consistent STL across every native library.
 *
 * Because the /android folder is regenerated fresh by `expo prebuild` on
 * every EAS build, this fix must live in a config plugin — not in a
 * hand-edited gradle.properties — so it gets re-applied on each build.
 */
function withFixAndroidStl(config) {
  return withGradleProperties(config, (config) => {
    const props = config.modResults;

    const setOrReplace = (key, value) => {
      const existing = props.find(
        (item) => item.type === 'property' && item.key === key,
      );
      if (existing) {
        existing.value = value;
      } else {
        props.push({ type: 'property', key, value });
      }
    };

    // Primary fix — single STL across all native modules.
    setOrReplace('ANDROID_STL', 'c++_shared');

    // Packaging: do not use legacy packaging (matches modern RN default).
    setOrReplace('expo.useLegacyPackaging', 'false');

    return config;
  });
}

module.exports = withFixAndroidStl;
