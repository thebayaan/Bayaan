/**
 * sheetGestures for tests that render a verse sheet screen without the
 * sheet: plain React Native views taking the same props. Use it with
 * `jest.mock('<path to>/sheetGestures')`.
 */
import React from 'react';
import {ScrollView, View, type ViewProps} from 'react-native';
import type {SheetScrollViewProps} from '../sheetGestures';

export function SheetScrollView({ref, ...props}: SheetScrollViewProps) {
  return <ScrollView ref={ref} {...props} />;
}

export function SheetFooter(props: ViewProps) {
  return <View {...props} />;
}
