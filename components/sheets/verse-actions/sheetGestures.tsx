/**
 * Scrolling and tapping in the verse sheet and its screens, with the pieces
 * every sheet uses (SheetGestures.tsx).
 *
 * Lists scroll with SheetScrollView: linked to the sheet's drag at their
 * top, so a drag down there moves the sheet, and holding the drag off while
 * scrolled, so scrolling never moves or closes it. Drags from the handle or
 * a screen's back row always move it. Root search's FlashList
 * (components/search/quran/RootResults.tsx) scrolls on SheetScrollView too.
 *
 * SheetFooter holds the buttons at the bottom of a screen: Previous / Next
 * (Word Study, Translation, Tafsir), Save Note, the Share buttons, and the
 * highlight colours with Remove. The sheet's drag starts after 5pt of
 * vertical movement anywhere on the sheet, the top of a list included, and
 * when it starts it cancels the press under the finger: a tap that moved
 * 5pt was lost and nudged the sheet instead. The footer claims each touch
 * the moment the finger lands, without cancelling the press, so the drag
 * never starts for that touch.
 *
 * The claim keeps the touch from every other gesture under it. A footer
 * therefore holds only JS-driven touchables (Pressable), never a native
 * ScrollView, TextInput or Switch, which would no longer get the touch. A
 * drag that starts on a footer does not scroll the list it sits in either,
 * so the rows of a list (the verse menu, Word Study's words, Similar
 * Verses' verses) stay out of footers and the list scrolls from them.
 */
export {
  FOOTER_CLAIM,
  SheetFooter,
  SheetScrollView,
  type SheetScrollViewProps,
} from '@/components/sheets/SheetGestures';
