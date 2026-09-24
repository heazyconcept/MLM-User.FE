import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { NavigationEnd, NavigationError, provideRouter, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { definePreset } from '@primeuix/themes';
import { DialogService } from 'primeng/dynamicdialog';
import { ConfirmationService, MessageService } from 'primeng/api';


const MyPreset = definePreset(Aura, {
    semantic: {
        primary: {
            50: '#f4f9f1',
            100: '#e8f3e3',
            200: '#d1e7c7',
            300: '#abd4a1',
            400: '#7bb771',
            500: '#49A321',
            600: '#3a8a1a',
            700: '#2e6b16',
            800: '#265614',
            900: '#214914',
            950: '#11290a'
        }
    }
});

import { routes } from './app.routes';

const LAZY_ROUTE_RECOVERY_KEY = 'mlm.lazy-route-recovery';

/** After deploy, cached index.html may reference removed lazy chunks — hard-reload the target URL once. */
function provideLazyRouteRecovery(): ReturnType<typeof provideAppInitializer> {
  return provideAppInitializer(() => {
    const router = inject(Router);

    router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        sessionStorage.removeItem(LAZY_ROUTE_RECOVERY_KEY);
      });

    router.events
      .pipe(filter((event): event is NavigationError => event instanceof NavigationError))
      .subscribe((event) => {
        const message = String(event.error?.message ?? event.error ?? '');
        const isChunkFailure =
          message.includes('Failed to fetch dynamically imported module') ||
          message.includes('Loading chunk') ||
          message.includes('ChunkLoadError') ||
          message.includes('error loading dynamically imported module');

        if (!isChunkFailure || !event.url) return;

        const lastRecovery = sessionStorage.getItem(LAZY_ROUTE_RECOVERY_KEY);
        if (lastRecovery === event.url) return;

        sessionStorage.setItem(LAZY_ROUTE_RECOVERY_KEY, event.url);
        window.location.assign(event.url);
      });
  });
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideLazyRouteRecovery(),
    providePrimeNG({
        theme: {
            preset: MyPreset,
            options: {

                darkModeSelector: '.dark',
                cssLayer: {
                    name: 'primeng',
                    order: 'tailwind-base, primeng, tailwind-utilities'
                }
            }
        }
    }),
    DialogService,
    ConfirmationService,
    MessageService,
    provideHttpClient(


      withInterceptors([authInterceptor, errorInterceptor])
    )
  ]
};
