// Config plugin: Add SEND_SMS permission to AndroidManifest
const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

module.exports = function withDirectSms(config) {
  return withAndroidManifest(config, async (modConfig) => {
    const androidManifest = modConfig.modResults;

    // Add SEND_SMS and READ_PHONE_STATE permissions
    const permissionsToAdd = [
      'android.permission.SEND_SMS',
      'android.permission.READ_PHONE_STATE',
    ];

    // Ensure uses-permissions array exists
    if (!androidManifest.manifest['uses-permission']) {
      androidManifest.manifest['uses-permission'] = [];
    }

    const existingPermissions = androidManifest.manifest['uses-permission'].map(
      (p) => p.$['android:name']
    );

    for (const perm of permissionsToAdd) {
      if (!existingPermissions.includes(perm)) {
        androidManifest.manifest['uses-permission'].push({
          $: { 'android:name': perm },
        });
      }
    }

    return modConfig;
  });
};
