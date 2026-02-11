import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { PlatformProvider } from './platform/PlatformContext';
import { tauriPlatform } from './platform/tauriPlatform';
import { studioRouter } from './studioRouter';
import './studio.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function StudioApp() {
  return (
    <PlatformProvider platform={tauriPlatform}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={studioRouter} />
      </QueryClientProvider>
    </PlatformProvider>
  );
}
