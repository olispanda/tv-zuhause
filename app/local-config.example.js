/* Household settings for this TV. Copy to local-config.js (ignored by Git, packaged when present) and edit.
   Pulling UI updates never touches local-config.js, so names and places here survive every update.
   Without the file, CleanFrame uses its defaults. ES5 only – this runs on the TV. */
window.CleanFrameLocal = {
  // HDMI port number: name shown in Settings → Samsung → Inputs.
  inputNames: { /* 1: 'Apple TV', 2: 'Nintendo Switch' */ },
  // Extra bundled marks by native app ID: { 'AbCdE12345.SomeApp': 'plex' }. The mark must exist in
  // app/assets/icons/ and in metrics.js (see docs/ui-kit.md). Plex is recognised by name already.
  brands: {},
  // Where the day/night palette follows the sun: [longitude, latitude]. Default: Zürich HB.
  location: null
};
