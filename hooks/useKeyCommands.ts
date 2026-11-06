// @ai-generated
import {useEffect, useRef} from 'react';
import {
  addKeyLayer,
  type KeyBinding,
  type KeyLayer,
} from '@/services/keyboard/keyCommands';

/**
 * Binds hardware keyboard shortcuts while `active` (iPad only). The layer is
 * added when it turns active, so it overrides whatever was bound before it,
 * and taken away when it turns inactive or unmounts. Pass memoized
 * `bindings`: each new array updates the layer in place.
 */
export function useKeyCommands(
  bindings: readonly KeyBinding[],
  active = true,
  options: {base?: boolean} = {},
): void {
  const layerRef = useRef<KeyLayer | null>(null);
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;
  const base = options.base === true;

  useEffect(() => {
    if (!active) return;
    const layer = addKeyLayer(bindingsRef.current, {base});
    layerRef.current = layer;
    return () => {
      layer.remove();
      layerRef.current = null;
    };
  }, [active, base]);

  useEffect(() => {
    layerRef.current?.update(bindings);
  }, [bindings]);
}
