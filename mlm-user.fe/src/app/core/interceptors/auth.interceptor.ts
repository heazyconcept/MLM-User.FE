import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, filter, switchMap, take } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

const AUTH_URLS = ['auth/login', 'auth/register', 'auth/refresh', 'auth/forgot-password', 'auth/reset-password'];

function isAuthUrl(url: string): boolean {
  return AUTH_URLS.some(authUrl => url.includes(authUrl));
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = localStorage.getItem('mlm_auth_token');

  let authReq = req;
  if (token && !isAuthUrl(req.url)) {
    authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isAuthUrl(req.url)) {
        return handleTokenRefresh(authReq, next, authService, router);
      }
      return throwError(() => error);
    })
  );
};

function handleTokenRefresh(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService,
  router: Router
): Observable<any> {

  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    return authService.refreshToken().pipe(
      switchMap(tokens => {
        isRefreshing = false;
        refreshTokenSubject.next(tokens.accessToken);

        const retryReq = req.clone({
          setHeaders: { Authorization: `Bearer ${tokens.accessToken}` }
        });
        return next(retryReq);
      }),
      catchError(err => {
        isRefreshing = false;
        authService.logoutLocal();
        router.navigate(['/auth/login']);
        return throwError(() => err);
      })
    );
  }

  return refreshTokenSubject.pipe(
    filter(token => token !== null),
    take(1),
    switchMap(token => {
      const retryReq = req.clone({
        setHeaders: { Authorization: `Bearer ${token}` }
      });
      return next(retryReq);
    })
  );
}
