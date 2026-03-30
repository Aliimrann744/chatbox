const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Fixes "No variants exist" build error with RN 0.81 + AGP 8.11.0.
 *
 * RN 0.81 bundles AGP 8.11.0 as an included build. Third-party libraries
 * declare older AGP versions in their buildscript blocks, producing variants
 * with a different AgpVersionAttr. Gradle's strict attribute matching then
 * rejects them with "No variants exist".
 *
 * Fix: Register a compatibility rule that accepts ANY AgpVersionAttr value,
 * so variant matching succeeds regardless of which AGP version built a library.
 */
function withForceAgpVersion(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      const snippet = `
// [agp-compat] Accept all AGP version attributes so libraries built with
// older AGP versions are compatible with the app's AGP 8.11.0
class AgpCompatRule implements AttributeCompatibilityRule<String> {
    void execute(CompatibilityCheckDetails<String> details) {
        details.compatible()
    }
}
dependencies {
    attributesSchema {
        attribute(Attribute.of('com.android.build.api.attributes.AgpVersionAttr', String)) {
            compatibilityRules.add(AgpCompatRule)
        }
    }
}
`;
      if (!config.modResults.contents.includes('agp-compat')) {
        config.modResults.contents += snippet;
      }
    }
    return config;
  });
}

module.exports = withForceAgpVersion;
