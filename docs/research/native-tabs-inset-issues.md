# NativeTabs Content Inset Issues - GitHub Research Report

**Date:** March 7, 2026
**Search Scope:** expo/expo, expo/expo-router, software-mansion/react-native-screens
**Status:** 4 critical open issues, 1 workaround documented

---

## Executive Summary

NativeTabs in Expo Router SDK 55+ has systemic content inset issues on iOS, primarily caused by:

1. **ScrollView contentInsetAdjustmentBehavior is overridden** — Native screens force `automatic` insets even when explicitly set to `never`
2. **Pre-rendering without bounded insets** — All tabs render before tab bar is measured, causing layout flashes when SafeAreaProvider updates
3. **Dynamic prop synchronization broken** — `disableAutomaticContentInsets` arrives too late for native side to apply correctly
4. **Safe area measurement inconsistency** — Device-only insets applied initially, then jumps to bounded insets causing visible layout shifts

---

## Critical Issues Found

### 1. ScrollView Ignores contentInsetAdjustmentBehavior="never" (UPSTREAM: react-native-screens)

**Issue:** [expo/expo#43056](https://github.com/expo/expo/issues/43056)
**Status:** Open (Accepted, Upstream: React Native Screens)
**Assignee:** Ubax
**Comments:** 11
**Last Updated:** March 1, 2026

#### Problem
When a ScrollView with `contentInsetAdjustmentBehavior="never"` and `automaticallyAdjustContentInsets={false}` is used in a NativeTabs screen, iOS still applies automatic content insets, resulting in unexpected extra top padding. This does not occur on Android or in regular Stack screens.

#### Details
- **Platform:** iOS only
- **Affected Version:** SDK 55.0.0-preview.10
- **Behavior:** Extra padding applied despite explicit `never` setting
- **Video Evidence:** https://github.com/user-attachments/assets/036e195b-5963-4791-9fd0-78422084ba0d
- **Reproduction:** https://github.com/AdiRishi/expo-scrollview-bug-reproduction

#### Root Cause (from react-native-screens)
The native `RNSScrollViewHelper.mm` forces content inset adjustment:
```objc
if ([scrollView contentInsetAdjustmentBehavior] == UIScrollViewContentInsetAdjustmentNever) {
    [scrollView setContentInsetAdjustmentBehavior:UIScrollViewContentInsetAdjustmentAutomatic];
}
```

This override happens in `mountChildComponentView` before React prop updates can take effect.

---

### 2. FlashList Gets Unexpected Top Safe Area Inset in NativeTabs

**Issue:** [expo/expo#40775](https://github.com/expo/expo/issues/40775)
**Status:** Open (Accepted)
**Assignee:** Ubax
**Comments:** 3
**Last Updated:** November 27, 2025

#### Problem
Using FlashList inside a NativeTabs screen results in content being pushed down by ~34-40px of top safe area automatically applied. Setting `contentInsetAdjustmentBehavior="never"` works, but the inset reappears after app reload.

#### Details
- **Expected Behavior:** FlashList should render without automatic safe area padding
- **Actual Behavior:** Image pushed down by top safe area on initial render
- **Platform:** iOS
- **Affected Version:** SDK 54.0.21
- **Reproduction:** https://github.com/liixing/expo-native-tabs

#### User Workaround
Setting `contentInsetAdjustmentBehavior="never"` temporarily fixes it, but persists only within the session.

---

### 3. NativeTabs Pre-rendering Causes Safe Area Flash on First Tab Visit

**Issue:** [expo/expo#42486](https://github.com/expo/expo/issues/42486)
**Status:** Open (Needs More Info, Accepted, SDK-55)
**Assignee:** Ubax
**Comments:** 4
**Last Updated:** February 27, 2026

#### Problem
NativeTabs pre-renders all tabs simultaneously on app load. When nested SafeAreaProviders measure their bounded insets (including tab bar), they initially get device-only insets (~34px), then jump to bounded insets (~83px including tab bar) when the tab is visited, causing visible layout flash.

#### Details
- **Cause:** Pre-rendered tab content not positioned relative to tab bar in native view hierarchy
- **Effect:** ~49px layout shift when navigating to non-initial tabs
- **Platforms:** iOS 18+
- **Stack:** expo-router 6.0.21 / react-native 0.81.5

#### Workaround (from issue description)
Cache the largest bottom inset value from all tabs visited and apply it globally:
```typescript
// Share insets via React context across tab screens
// Cache largest bottom value (includes tab bar)
// First tab still flashes, subsequent tabs use cached insets
```

#### Related Issue
- software-mansion/react-native-screens#3573 — Same root cause in react-native-screens

---

### 4. SafeAreaProvider Returns Device-Only Insets for Pre-rendered Tabs

**Issue:** [software-mansion/react-native-screens#3573](https://github.com/software-mansion/react-native-screens/issues/3573)
**Status:** Open (Bug, iOS, Missing Repro)
**Comments:** 4
**Last Updated:** January 29, 2026

#### Problem
In react-native-screens (underlying NativeTabs), pre-rendered screens return device-only insets instead of bounded insets from nested SafeAreaProviders.

#### Context
When NativeTabs pre-renders all tabs before tab bar is measured:
1. Nested SafeAreaProvider gets device-only insets (~34px)
2. Pre-rendered content is not positioned as child of tab bar layout
3. When user visits tab, SafeAreaProvider re-measures and gets bounded insets (~83px)
4. Result: visible layout shift of ~49px

#### Potential Solutions (from issue)
1. Add `lazy` prop to defer tab rendering until visited
2. Add `detachInactiveScreens` prop (React Navigation pattern)
3. Document the limitation and recommend workarounds

#### Workaround
Share insets via React context and cache largest bottom value across tabs.

---

### 5. ScrollView Blank Area During Rendering with Native Bottom Tabs

**Issue:** [software-mansion/react-native-screens#3598](https://github.com/software-mansion/react-native-screens/issues/3598)
**Status:** Open (iOS, Repro Provided)
**Comments:** 0
**Last Updated:** January 30, 2026

#### Problem
When using React Navigation's native bottom tabs on iOS with a ScrollView as the main container, an empty area appears above the scroll view during rendering. The gap disappears when scrolling, and does not occur on Android.

#### Details
- **Platform:** iOS only
- **Version:** react-native-screens 4.20.0, react-native 0.83.1 (New Architecture/Fabric)
- **Reproduction:** https://github.com/cetfu/ReactNavigationReproducerScrollView/

---

## Workarounds Found

### Workaround 1: Decoy View to Block ScrollViewFinder (Tested & Documented)

**Issue:** [expo/expo#43501](https://github.com/expo/expo/issues/43501)
**Status:** Closed (Incomplete - Missing Valid Repro)

When `disableAutomaticContentInsets` fails (because it arrives too late), use an invisible decoy View as the first child:

```tsx
<View collapsable={false} style={{ position: 'absolute', width: 0, height: 0 }} />
<ScrollView contentInsetAdjustmentBehavior="never" ...>
  {/* content */}
</ScrollView>
```

**Mechanism:** RNSScrollViewFinder traverses `subviews[0]` recursively. The decoy causes the finder to dead-end before reaching the ScrollView, preventing the override.

**Effectiveness:** ✓ Confirmed working
**Trade-off:** Hacky, relies on internal implementation detail

### Workaround 2: Context-Based Inset Caching

**From Issue:** [expo/expo#42486](https://github.com/expo/expo/issues/42486)

Share insets across tabs via React context and cache the maximum bottom inset:

```tsx
// _layout.tsx
const maxInsets = useSharedValue({ bottom: 0, top: 0 });

useEffect(() => {
  maxInsets.value.bottom = Math.max(insets.bottom, maxInsets.value.bottom);
  // Provide via context to all tabs
}, [insets.bottom]);
```

**Effectiveness:** ✓ Reduces flashing on subsequent tabs
**Trade-off:** First tab still flashes; requires context setup

### Workaround 3: contentInsetAdjustmentBehavior="never" (Partial)

**From Issue:** [expo/expo#40775](https://github.com/expo/expo/issues/40775)

Set ScrollView prop explicitly:
```tsx
<ScrollView contentInsetAdjustmentBehavior="never" />
```

**Effectiveness:** ⚠️ Partial - works temporarily but may reset on reload
**Trade-off:** Not reliable across app reloads

---

## Dynamic Prop Synchronization Issue

**Issue:** [expo/expo#43501](https://github.com/expo/expo/issues/43501)
**Status:** Closed (Marked Incomplete Due to Missing Repro)
**Key Finding:** Root cause documented, workaround provided

### The Problem

In `NativeTabTrigger.js`, the `convertTabPropsToOptions` function has two branches:

```javascript
// isDynamic = false (initial layout context)
const initialOptions = {
    disableAutomaticContentInsets,  // ✓ INCLUDED
    // ... other props
};

// isDynamic = true (focus effect → navigation.setOptions())
const initialOptions = {
    // ✗ MISSING disableAutomaticContentInsets
    ...(unstable_nativeProps ? { nativeProps: unstable_nativeProps } : {}),
    disableTransparentOnScrollEdge,
};
```

**Result:** The native side receives `disableAutomaticContentInsets` only during initial render, not during dynamic updates. By the time the focus effect arrives with updated options, the native override has already fired.

### Console Warning
When this occurs, RNScreens logs:
```
[RNScreens] changing overrideScrollViewContentInsetAdjustmentBehavior dynamically is currently unsupported
```

---

## Additional Related Issues

### Issue: Different Top Inset with headerTransparent in Dev Client vs Expo Go

**Issue:** [expo/expo#43733](https://github.com/expo/expo/issues/43733)
**Status:** Open (Needs Review)
**Last Updated:** March 7, 2026

- iOS only
- SDK 55.0.5
- Top spacing inconsistent between Expo Go and Dev Client with `headerTransparent: true`
- May be related to inset measurement timing

### Issue: Inverted FlatLists Faded Until Scroll

**Issue:** [expo/expo#41366](https://github.com/expo/expo/issues/41366)
**Status:** Open (Accepted, Upstream: React Native Screens)
**Assignee:** Ubax

- Inverted FlatLists in NativeTabs render faded/invisible until user scrolls past boundary
- Likely related to content inset measurement affecting scroll view rendering

---

## Summary Table

| Issue | Repo | Status | Root Cause | Workaround |
|-------|------|--------|-----------|-----------|
| ScrollView ignores `never` inset | expo/expo#43056 | Open | Native override in mountChildComponentView | Decoy view block finder |
| FlashList top inset | expo/expo#40775 | Open | Automatic inset in NativeTabs | Temporary `contentInsetAdjustmentBehavior="never"` |
| Pre-render safe area flash | expo/expo#42486 | Open | Device-only insets on pre-render | Context-based inset caching |
| Device-only insets pre-render | react-native-screens#3573 | Open | Pre-render not positioned under tab bar | Cache largest bottom inset |
| ScrollView blank area | react-native-screens#3598 | Open | Content inset calculation timing | Unknown (not explored) |
| Dynamic prop sync | expo/expo#43501 | Closed | Missing in isDynamic branch | Decoy view workaround |

---

## Key Findings

1. **Native layer intercepts ScrollView configuration** — react-native-screens aggressively overrides `contentInsetAdjustmentBehavior` from `never` to `automatic`, preventing correct manual inset management.

2. **Timing mismatch between native and JS** — Props that control inset behavior (like `disableAutomaticContentInsets`) arrive after native initialization completes.

3. **Pre-render without context is dangerous** — Tab screens render before the tab bar exists in the native hierarchy, causing SafeAreaProvider to measure incorrectly.

4. **iOS-only issues** — All content inset problems are iOS-specific; Android unaffected.

5. **Upstream dependency chain** — These are react-native-screens issues that expo-router cannot fully resolve in JS layer.

---

## Recommendations for Bayaan

Given Bayaan's use of NativeTabs (SDK 55 upgrade):

1. **Proactive Content Inset Management:**
   - Always set `contentInsetAdjustmentBehavior="never"` on ScrollView/FlatList in tab screens
   - Manually manage top padding using `useSafeAreaInsets()` hook

2. **Implement Inset Caching:**
   - Create context provider that shares calculated insets across tabs
   - Cache maximum bottom inset to reduce flashing

3. **Use Decoy View Pattern:**
   - If above don't work, add invisible decoy View as first child before ScrollView
   - Blocks internal ScrollViewFinder from applying overrides

4. **Monitor for Updates:**
   - Watch expo/expo#43056, #42486, and react-native-screens#3573 for fixes
   - These are marked as accepted issues with upstream acknowledgment

5. **Testing:**
   - Test all scrollable content (FlashList, FlatList, ScrollView) in tabs
   - Check for content displacement, flashing, and blank areas on first visit
   - Test both iOS and Android thoroughly

---

## Search Queries Used

```bash
# Primary searches
gh search issues --repo expo/expo-router --repo expo/expo --repo software-mansion/react-native-screens "NativeTabs inset"
gh search issues --repo expo/expo-router --repo expo/expo --repo software-mansion/react-native-screens "native tabs scroll"
gh search issues --repo expo/expo-router --repo expo/expo --repo software-mansion/react-native-screens "unstable-native-tabs"
gh search issues --repo expo/expo --repo expo/expo-router "headerTransparent"
```

---

## References

- [Expo Router NativeTabs Docs](https://docs.expo.dev/router/advanced/nativetabs/)
- [React Native Screens Documentation](https://github.com/software-mansion/react-native-screens)
- [Expo SDK 55 Release Notes](https://docs.expo.dev/sdk/55/)
