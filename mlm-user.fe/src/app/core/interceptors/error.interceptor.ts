import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ModalService } from '../services/modal.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const modalService = inject(ModalService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let errorMessage = 'An unknown error occurred!';
      
      if (error.error instanceof ErrorEvent) {
        // Client-side error
        errorMessage = `Error: ${error.error.message}`;
      } else {
        // Server-side error
        if (error.status === 401) {
          errorMessage = 'Unauthorized access. Please login again.';
          // Optionally redirect to login
        } else if (error.status === 403) {
          errorMessage = 'You do not have permission to perform this action.';
        } else if (error.status === 404) {
          errorMessage = 'Resource not found.';
        } else if (error.status >= 500) {
          errorMessage = 'Server error. Please try again later.';
        } else if (error.error && error.error.message) {
            errorMessage = error.error.message;
        }
      }

      modalService.open('error', 'Error', errorMessage);
      return throwError(() => error);
    })
  );
};
