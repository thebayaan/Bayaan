# Native tab direction

Expo SDK 57 / React Native Screens 4.26 support native tab direction. Bayaan
passes `unstable_nativeProps={{direction: appDirection}}` to `NativeTabs`,
placing Home on the right and the separate Search button on the left in Arabic
while keeping the normal platform design. No Screens patch is required.

The Yoga wrapper remains LTR to preserve the native mini-player accessory's
coordinates; screen and player contents apply the selected app direction.
Language changes persist the native direction and reload the app.

When upgrading Router or Screens, verify Arabic and English tab order, Search
placement, tab switching, and regular/minimized mini-player accessories.
