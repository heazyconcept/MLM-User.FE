import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ModalService } from '../../services/modal.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const modalService = inject(ModalService);
  const router = inject(Router);
  const authService = inject(AuthService);
  const authPaths = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password', '/auth/refresh'];

  const getBackendErrorMessage = (payload: unknown): string | null => {
    if (!payload) return null;
    if (typeof payload === 'string') return payload;

    if (typeof payload === 'object') {
      const record = payload as Record<string, unknown>;
      const messageFields = ['message', 'error', 'detail', 'title'];

      for (const field of messageFields) {
        const value = record[field];
        if (typeof value === 'string' && value.trim()) {
          return value;
        }
        if (Array.isArray(value)) {
          const joined = value
            .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
            .join(' ')
            .trim();
          if (joined) return joined;
        }
      }
    }

    return null;
  };

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let errorMessage = 'An unknown error occurred!';
      
      if (error.error instanceof ErrorEvent) {
        // Client-side error
        errorMessage = `Error: ${error.error.message}`;
      } else {
        // Server-side error
        if (error.status === 401) {
          authService.logoutLocal();

          const isAuthRequest = authPaths.some(path => req.url.includes(path));
          const currentPath = router.url.split('?')[0];
          const isAuthPage = currentPath.startsWith('/auth/');

          // Prevent infinite login redirects when login itself fails with 401.
          if (!isAuthRequest && !isAuthPage) {
            router.navigate(['/auth/login'], { queryParams: { returnUrl: router.url } });
          }

          return throwError(() => error);
        }

        errorMessage = getBackendErrorMessage(error.error) ?? error.message ?? 'Request failed. Please try again.';

        if (error.status === 400 && typeof ngDevMode !== 'undefined' && ngDevMode) {
          console.error('API 400:', error.error);
        }
      }

      // Skip modal for 404 on GET to onboarding endpoints where 404 means "not set up yet"
      const expected404GetPaths = ['users/me/bank', 'users/me/identity', 'users/me/preferences'];
      if (error.status === 404 && req.method === 'GET' && expected404GetPaths.some(path => req.url.includes(path))) {
        return throwError(() => error);
      }

      modalService.open('error', 'Error', errorMessage);
      return throwError(() => error);
    })
  );
};
