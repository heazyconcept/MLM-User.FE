import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs/operators';
import { CaucusService } from '../../services/caucus.service';

export const caucusBootstrapGuard: CanActivateFn = () => {
  const caucus = inject(CaucusService);
  const router = inject(Router);

  return caucus.loadMe().pipe(
    take(1),
    map((me) => {
      if (!me || me.status === 'NONE') {
        return router.createUrlTree(['/dashboard']);
      }
      return true;
    }),
  );
};
