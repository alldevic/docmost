import "@mantine/core/styles.css";
import "@mantine/spotlight/styles.css";
import "@mantine/notifications/styles.css";
import '@mantine/dates/styles.css';

// Polyfill URL.canParse for older browsers (required by mermaid v11)
if (typeof URL.canParse !== "function") {
  URL.canParse = function (url: string, base?: string): boolean {
    try {
      new URL(url, base);
      return true;
    } catch {
      return false;
    }
  };
}

import { registerServiceWorker } from "@/lib/pwa/register-service-worker.ts";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { mantineCssResolver, theme } from "@/theme";
import { MantineProvider } from "@mantine/core";
import { BrowserRouter } from "react-router-dom";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import "./i18n";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

const container = document.getElementById("root") as HTMLElement;
const root = (container as any).__reactRoot ??= ReactDOM.createRoot(container);

function renderApp() {
  const appContent = (
    <HelmetProvider>
      <App />
    </HelmetProvider>
  );

  root.render(
    <BrowserRouter>
      <MantineProvider theme={theme} cssVariablesResolver={mantineCssResolver}>
        <ModalsProvider>
          <QueryClientProvider client={queryClient}>
            <Notifications position="bottom-center" limit={3} zIndex={10000} />
            {appContent}
          </QueryClientProvider>
        </ModalsProvider>
      </MantineProvider>
    </BrowserRouter>,
  );
}

renderApp();

registerServiceWorker();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (registration) => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New update available and installed
                // Since we use skipWaiting() in sw.js, it will activate immediately.
                // We can reload the page to use the new version.
                console.log('New version initialized. Reloading...');
                window.location.reload();
              }
            });
          }
        });
      },
      (err) => {
        console.log('ServiceWorker registration failed: ', err);
      }
    );

    // Ensure controller change reloads the page (for instant claim)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  });
}

