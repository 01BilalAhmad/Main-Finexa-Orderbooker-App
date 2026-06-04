// Config plugin: Fix Android build compatibility
// Ensure compatible dependency resolution for Expo SDK 55
const { withAppBuildGradle } = require('@expo/config-plugins');

/** Update the app-level build.gradle */
function updateAppBuildGradle(buildGradle) {
  // Force compatible versions that work with compileSdk 36
  const resolutionBlock = `
    configurations.all {
        resolutionStrategy {
            force 'androidx.activity:activity:1.11.0'
            force 'androidx.activity:activity-ktx:1.11.0'
            force 'androidx.core:core:1.17.0'
            force 'androidx.core:core-ktx:1.17.0'
        }
    }
  `;

  // Only add if not already present
  if (!buildGradle.includes("force 'androidx.activity:activity:1.11.0'")) {
    // Remove any old resolution blocks
    buildGradle = buildGradle.replace(
      /configurations\.all\s*\{\s*resolutionStrategy\s*\{[^}]*\}\s*\}/g,
      ''
    );

    // Insert after 'android {' declaration
    buildGradle = buildGradle.replace(
      /android\s*\{/,
      `android {\n${resolutionBlock}`
    );
  }

  return buildGradle;
}

module.exports = function withAndroidBuildFix(config) {
  config = withAppBuildGradle(config, (modConfig) => {
    modConfig.modResults.contents = updateAppBuildGradle(
      modConfig.modResults.contents
    );
    return modConfig;
  });

  return config;
};
