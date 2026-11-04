// @ai-start
import React, {ReactNode, useCallback, useState} from 'react';
import * as Sentry from '@sentry/react-native';
import AppErrorScreen, {safeText} from '@/components/AppErrorScreen';
import branding from '@/config/branding';
import i18n from '@/i18n';

interface Props {
  children: ReactNode;
}

// Two retries, then stop offering one. The budget lasts for the session: a throw
// in a child's effect comes after the commit, so nothing can show that a retry
// worked. After two failed retries, a restart is the right advice for any later
// crash too.
const MAX_RETRIES = 2;

function flushReport() {
  // The user's next action on this screen is often a force quit. Flush so the
  // report does not race the kill. This runs a few times per process at most.
  Sentry.flush().catch(() => undefined);
}

function ErrorBoundary({children}: Props) {
  const [retries, setRetries] = useState(0);

  const renderFallback = useCallback(
    (fallback: {resetError: () => void}) =>
      retries < MAX_RETRIES ? (
        <AppErrorScreen
          message={safeText(
            () =>
              i18n.t('home:errorBoundary.message', {
                appName: branding.appName,
              }),
            'The app hit an unexpected error on this screen.',
          )}
          onRetry={() => {
            setRetries(count => count + 1);
            fallback.resetError();
          }}
        />
      ) : (
        <AppErrorScreen
          message={safeText(
            () =>
              i18n.t('home:errorBoundary.repeat', {
                appName: branding.appName,
              }),
            'The app keeps hitting errors. Close it fully and open it again.',
          )}
        />
      ),
    [retries],
  );

  return (
    <Sentry.ErrorBoundary
      fallback={renderFallback}
      beforeCapture={scope => scope.setTag('scope', 'error-boundary')}
      onError={flushReport}>
      {children}
    </Sentry.ErrorBoundary>
  );
}
// @ai-end

export default ErrorBoundary;
