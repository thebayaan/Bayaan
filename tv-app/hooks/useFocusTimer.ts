import {useCallback, useEffect, useRef, useState} from 'react';

export function useFocusTimer(idleMs = 3000): {
  visible: boolean;
  reveal: () => void;
} {
  const [visible, setVisible] = useState<boolean>(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const arm = useCallback((): void => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), idleMs);
  }, [idleMs]);

  const reveal = useCallback((): void => {
    setVisible(true);
    arm();
  }, [arm]);

  useEffect(() => {
    arm();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [arm]);

  return {visible, reveal};
}
