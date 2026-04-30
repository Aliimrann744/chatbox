const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Removes the `com.google.android.gms.permission.AD_ID` permission that
 * `react-native-fbsdk-next` (and the play-services-ads-identifier transitive
 * dep) inject into the merged AndroidManifest. Without this, Play Console
 * flags "Incomplete advertising ID declaration" for apps targeting
 * Android 13+ that do not actually use the advertising ID.
 *
 * The manifest merger honors `tools:node="remove"`, so adding the permission
 * with that attribute deletes it from the final APK/AAB manifest.
 */
const AD_ID_PERMISSION = 'com.google.android.gms.permission.AD_ID';

function withRemoveAdIdPermission(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    manifest.$ = manifest.$ || {};
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    manifest['uses-permission'] = manifest['uses-permission'] || [];

    manifest['uses-permission'] = manifest['uses-permission'].filter(
      (perm) => perm?.$?.['android:name'] !== AD_ID_PERMISSION,
    );

    manifest['uses-permission'].push({
      $: {
        'android:name': AD_ID_PERMISSION,
        'tools:node': 'remove',
      },
    });

    return config;
  });
}

module.exports = withRemoveAdIdPermission;
