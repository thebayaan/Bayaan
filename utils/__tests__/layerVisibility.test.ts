// @ai-generated
import {layerVisibilityProps} from '../layerVisibility';

describe('layerVisibilityProps', () => {
  it('shows the visible layer to everyone', () => {
    expect(layerVisibilityProps(true)).toEqual({
      pointerEvents: 'auto',
      accessibilityElementsHidden: false,
      importantForAccessibility: 'auto',
    });
  });

  it('hides the other layer from touches and screen readers too', () => {
    expect(layerVisibilityProps(false)).toEqual({
      pointerEvents: 'none',
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
    });
  });
});
