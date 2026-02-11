import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { PlatformProvider } from './platform/PlatformContext';
import { tauriPlatform } from './platform/tauriPlatform';
import { studioRouter } from './studioRouter';
import { useAutoConnect } from './lib/hooks/useAutoConnect';
import './studio.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/** Inner component that has access to PlatformProvider context */
function StudioInner() {
  const { state, error, retry } = useAutoConnect();

  if (state === 'connected') {
    return <RouterProvider router={studioRouter} />;
  }

  return (
    <div className="h-screen bg-background flex flex-col items-center justify-center gap-4 text-foreground">
      {state === 'error' ? (
        <>
          <div className="text-destructive text-lg">Failed to connect to server</div>
          <div className="text-muted-foreground text-sm max-w-md text-center">{error}</div>
          <button
            onClick={retry}
            className="mt-4 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </>
      ) : (
        <>
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
          <div className="text-muted-foreground text-sm">
            {state === 'idle' ? 'Initializing...' : 'Starting server...'}
          </div>
        </>
      )}
    </div>
  );
}

export default function StudioApp() {
  return (
    <PlatformProvider platform={tauriPlatform}>
      <QueryClientProvider client={queryClient}>
        <StudioInner />
      </QueryClientProvider>
    </PlatformProvider>
  );
}
