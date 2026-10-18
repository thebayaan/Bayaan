import React, {useEffect, useState} from 'react';
import {Text, View} from 'react-native';
import {colors} from '../../theme/colors';
import {fonts} from '../../theme/typography';
import {createScaledStyles} from '../../theme/scale';

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** "6:41 AM", without relying on Intl (Hermes builds vary). */
export function formatClock(date: Date): string {
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours % 12 === 0 ? 12 : hours % 12}:${minutes} ${hours < 12 ? 'AM' : 'PM'}`;
}

/** The current time, refreshed each minute. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    // Tick on the minute, then every minute.
    const first = setTimeout(
      () => {
        setNow(new Date());
        interval = setInterval(() => setNow(new Date()), 60 * 1000);
      },
      (60 - new Date().getSeconds()) * 1000,
    );
    return () => {
      clearTimeout(first);
      if (interval) clearInterval(interval);
    };
  }, []);
  return now;
}

type Props = {
  now: Date;
  /** Line under the time; the weekday when omitted. */
  caption?: string;
};

/** Time with a small caption, top right of the adhkar screens. */
export function AdhkarClock({now, caption}: Props): React.ReactElement {
  return (
    <View style={styles.root} accessible={false}>
      <Text style={styles.time}>{formatClock(now)}</Text>
      <Text style={styles.caption}>{caption ?? WEEKDAYS[now.getDay()]}</Text>
    </View>
  );
}

const styles = createScaledStyles({
  root: {alignItems: 'flex-end'},
  // The same type as the other places' clock (HomeClock).
  time: {
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontWeight: '600',
    fontSize: 30,
    letterSpacing: -0.3,
  },
  caption: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontWeight: '500',
    fontSize: 19,
    marginTop: 2,
  },
});
