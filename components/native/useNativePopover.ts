// @ai-generated
import {Platform} from 'react-native';
import {useResponsive} from '@/hooks/useResponsive';

/**
 * Whether a panel opens as a popover anchored to its button instead of a
 * sheet: iPad only. Android tablets keep their cards.
 */
export function useNativePopover(): boolean {
  const {isTablet} = useResponsive();
  return Platform.OS === 'ios' && isTablet;
}
