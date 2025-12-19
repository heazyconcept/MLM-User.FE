import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { definePreset } from '@primeuix/themes';
import { DialogService } from 'primeng/dynamicdialog';
import { ConfirmationService } from 'primeng/api';


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

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
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
    provideHttpClient(


      withInterceptors([loadingInterceptor])
    )
  ]
};
