# NativeTabs Inset Issues - Quick Reference & Fixes

**For Bayaan SDK 55 NativeTabs upgrade**

---

## The Problem (TL;DR)

NativeTabs on iOS forces ScrollViews/FlatLists to use automatic safe area insets, causing:

- Content pushed down by ~30-40px top padding
- Layout flashing when switching tabs (pre-render happens with device-only insets)
- Issues even when explicitly setting `contentInsetAdjustmentBehavior="never"`

**Cause:** Native react-native-screens layer overrides JS configuration at mount time before prop updates arrive.

---

## Fix Priority

### Fix 1: Always Use "never" (Safest)

Apply to ALL ScrollView/FlatList in tab screens:

```tsx
<ScrollView
  contentInsetAdjustmentBehavior="never"
  automaticallyAdjustContentInsets={false}
  // ... rest of props
>
```

**Effectiveness:** ~70% (works most of the time)
**Cost:** One line per scrollable component

---

### Fix 2: Add Decoy View (Most Reliable)

If Fix 1 doesn't work completely, add invisible view first:

```tsx
<View collapsable={false} style={{ position: 'absolute', width: 0, height: 0 }} />
<ScrollView contentInsetAdjustmentBehavior="never" ...>
  {/* content */}
</ScrollView>
```

**Why it works:** Blocks internal `RNSScrollViewFinder` from reaching your ScrollView and applying overrides.

**Effectiveness:** ~95% (tested, documented in expo/expo#43501)
**Cost:** One dummy View per scrollable component

---

### Fix 3: Inset Caching Context (For Flash Reduction)

Reduce flashing when switching to non-initial tabs:

```tsx
// Create context
const InsetsContext = React.createContext({ bottom: 0, top: 0 });

// In _layout.tsx
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const [maxInsets, setMaxInsets] = React.useState(insets);

  React.useEffect(() => {
    setMaxInsets(prev => ({
      top: Math.max(prev.top, insets.top),
      bottom: Math.max(prev.bottom, insets.bottom),
    }));
  }, [insets]);

  return (
    <InsetsContext.Provider value={maxInsets}>
      <NativeTabs>
        {/* tabs */}
      </NativeTabs>
    </InsetsContext.Provider>
  );
}

// In tab screens
const cachedInsets = React.useContext(InsetsContext);
// Use cachedInsets instead of useSafeAreaInsets() for initial padding
```

**Effectiveness:** ~80% (reduces but doesn't eliminate first-tab flash)
**Cost:** Moderate (context setup + refactor tab screen padding)

---

## Implementation Steps

### Step 1: Audit Current Code

Find all ScrollView/FlatList in tab screens:

```bash
grep -r "ScrollView\|FlatList" app/\(tabs\)/
```

### Step 2: Apply Fix 1 Everywhere

Add `contentInsetAdjustmentBehavior="never"` to all scrollable components

### Step 3: Test Each Tab

1. Launch app
2. Visit each tab
3. Scroll content
4. Check for:
  - Extra top padding
  - Content displaced
  - Flashing/layout shift
  - Blank area above content

### Step 4: Apply Fix 2 if Needed

If Fix 1 doesn't fully work, add decoy View

### Step 5: Test on Both Platforms

- iOS (priority: has the bug)
- Android (should work fine already)

---

## Code Examples

### Safe ScrollView (Correct Pattern)

```tsx
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1 }}>
      {/* Fix 2: Decoy view (only if Fix 1 doesn't work) */}
      <View collapsable={false} style={{ position: 'absolute', width: 0, height: 0 }} />

      {/* Fix 1: Always use "never" */}
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 16,
          paddingHorizontal: 16,
        }}
      >
        {/* Your content */}
      </ScrollView>
    </View>
  );
}
```

### Safe FlashList (from @shopify/flash-list)

```tsx
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1 }}>
      {/* Fix 2: Decoy view if needed */}
      <View collapsable={false} style={{ position: 'absolute', width: 0, height: 0 }} />

      {/* Fix 1: Always use "never" */}
      <FlashList
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        contentContainerStyle={{ paddingTop: insets.top + 16 }}
        data={items}
        renderItem={({ item }) => <ItemComponent item={item} />}
        estimatedItemSize={100}
      />
    </View>
  );
}
```

---

## What NOT to Do

❌ Don't rely on `disableAutomaticContentInsets` prop on NativeTabs.Trigger

- This is the root cause of the bug (prop arrives too late)

❌ Don't assume Android is the same as iOS

- Android doesn't have this issue, so don't test it as validation

❌ Don't use `contentInsetAdjustmentBehavior="automatic"`

- This is what the native override forces anyway

❌ Don't leave contentInset props undefined

- Be explicit with "never" + manual padding

---

## Related GitHub Issues to Monitor


| Issue                                                                                                              | Watch For                                     |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| [expo/expo#43056](https://github.com/expo/expo/issues/43056)                                                       | ScrollView ignores "never" inset (main issue) |
| [expo/expo#40775](https://github.com/expo/expo/issues/40775)                                                       | FlashList top inset issue                     |
| [expo/expo#42486](https://github.com/expo/expo/issues/42486)                                                       | Pre-render safe area flash                    |
| [software-mansion/react-native-screens#3573](https://github.com/software-mansion/react-native-screens/issues/3573) | Device-only insets on pre-render              |


---

## Testing Checklist

### Per Tab Screen

- No extra top padding visible
- Content starts at correct position (below status bar)
- First scroll smoothly (no jump)
- Can scroll to all content
- No blank area above content

### Across All Tabs

- Initial tab: no flash
- Switch to 2nd tab: check for flash
- Switch to 3rd+ tabs: check for flash
- Return to 1st tab: no re-flash
- Scroll in each tab: smooth
- No content displacement

### Platform Testing

- iOS: all checks above
- Android: confirm no regression (should be fine)

---

## Performance Notes

- Decoy View is ~0 perf cost (invisible, 0x0 size)
- contentInsetAdjustmentBehavior="never" has ~0 perf cost
- Inset caching context has minimal cost (context re-create on inset change)

---

## Reference Files

- **Full research:** `/docs/research/native-tabs-inset-issues.md`
- **Related CLAUDE.md:** Performance optimization section
- **Design system:** Color and design patterns

---

## When to Escalate

If after implementing all three fixes you still see issues:

1. Check if you're using a custom ScrollView wrapper (might not pass props correctly)
2. Check if there's a conflicting ViewContainer or SafeAreaView
3. Test in Expo Go vs. Dev Client (might be environment difference)
4. Create minimal reproduction and file issue on expo/expo with:
  - `contentInsetAdjustmentBehavior="never"` explicitly set
  - Decoy View present
  - Details about where it still fails

