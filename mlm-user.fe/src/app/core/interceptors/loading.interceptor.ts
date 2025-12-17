import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { LoadingService } from '../../services/loading.service';

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loadingService = inject(LoadingService);
  
  // Start loading
  loadingService.show();

  return next(req).pipe(
    finalize(() => {
      // Stop loading when request completes or fails
      loadingService.hide();
    })
  );
};
