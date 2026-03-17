/**
 * Service Worker Registration for ECODIGITAL PWA
 * Handles offline functionality and cache management
 */

// Type definitions for better IDE support
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Deferred install prompt for PWA
let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      console.log('[PWA] Service Worker registered successfully:', registration.scope);

      // Handle updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[PWA] New content available');
            showUpdateNotification();
          }
        });
      });

      // Check for updates periodically (every hour)
      setInterval(() => {
        registration.update().catch((err) => {
          console.warn('[PWA] Update check failed:', err);
        });
      }, 60 * 60 * 1000);

    } catch (error) {
      console.error('[PWA] Service Worker registration failed:', error);
      // Retry registration after 5 seconds on failure
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    }
  });

  // Handle offline/online status
  window.addEventListener('online', () => {
    console.log('[PWA] App is online');
    document.body.classList.remove('offline');
    showStatusNotification('Conexión restaurada', 'success');
  });

  window.addEventListener('offline', () => {
    console.log('[PWA] App is offline');
    document.body.classList.add('offline');
    showStatusNotification('Modo sin conexión', 'warning');
  });

  // Handle service worker controller changes
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[PWA] Service Worker controller changed');
    window.location.reload();
  });

  // Handle messages from service worker
  navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
      console.log('[PWA] Skip waiting message received');
    }
  });
}

// PWA Install prompt handling
window.addEventListener('beforeinstallprompt', (event: Event) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  event.preventDefault();
  // Stash the event so it can be triggered later
  deferredInstallPrompt = event as BeforeInstallPromptEvent;
  console.log('[PWA] Install prompt available');
});

// Handle app installed event
window.addEventListener('appinstalled', () => {
  console.log('[PWA] App installed successfully');
  deferredInstallPrompt = null;
  // Clear the deferred prompt
  showStatusNotification('¡App instalada!', 'success');
});

/**
 * Show update notification to user
 */
function showUpdateNotification(): void {
  const notification = document.createElement('div');
  notification.className = 'pwa-update-notification';
  notification.innerHTML = `
    <div class="pwa-update-content">
      <span>Nueva versión disponible</span>
      <button id="pwa-update-btn">Actualizar</button>
      <button id="pwa-dismiss-btn">Después</button>
    </div>
  `;
  
  document.body.appendChild(notification);

  // Handle update button
  const updateBtn = document.getElementById('pwa-update-btn');
  if (updateBtn) {
    updateBtn.addEventListener('click', () => {
      // Tell the waiting service worker to activate
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
      }
      window.location.reload();
    });
  }

  // Handle dismiss button
  const dismissBtn = document.getElementById('pwa-dismiss-btn');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', () => {
      notification.remove();
    });
  }

  // Auto-dismiss after 10 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 10000);
}

/**
 * Show status notification
 */
function showStatusNotification(message: string, type: 'success' | 'warning' | 'error'): void {
  const notification = document.createElement('div');
  notification.className = `pwa-status-notification pwa-status-${type}`;
  notification.textContent = message;
  
  document.body.appendChild(notification);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    notification.classList.add('pwa-status-fade-out');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 300);
  }, 3000);
}

/**
 * Trigger PWA install prompt programmatically
 */
export async function triggerInstallPrompt(): Promise<boolean> {
  if (!deferredInstallPrompt) {
    console.warn('[PWA] Install prompt not available');
    return false;
  }

  try {
    // Show the install prompt
    deferredInstallPrompt.prompt();
    
    // Wait for the user's response
    const { outcome } = await deferredInstallPrompt.userChoice;
    
    console.log(`[PWA] User ${outcome} the install prompt`);
    
    // Clear the deferred prompt
    deferredInstallPrompt = null;
    
    return outcome === 'accepted';
  } catch (error) {
    console.error('[PWA] Install prompt failed:', error);
    return false;
  }
}

/**
 * Check if app is running as PWA
 */
export function isPWA(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * Check if app is installable
 */
export function isInstallable(): boolean {
  return deferredInstallPrompt !== null;
}

// Export for use in other modules
export { deferredInstallPrompt };