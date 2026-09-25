import { Injectable, inject } from '@angular/core';
import { Observable, Subscription, interval, switchMap, takeWhile, tap } from 'rxjs';
import { LegacyClubService } from './legacy-club.service';
import {
  LegacyMe,
  LegacyPaymentPurpose,
  LegacyPaymentRecord,
  LegacyPaymentWalletRequest,
} from '../core/models/legacy-club.models';
import { LegacyClubHttpError } from '../core/mocks/legacy-club.mock';
import { LEGACY_ERROR_CODES } from '../core/models/legacy-club.models';

const POLL_INTERVAL_MS = 15_000;

@Injectable({ providedIn: 'root' })
export class LegacyPaymentService {
  private legacyClub = inject(LegacyClubService);

  newRequestKey(): string {
    return crypto.randomUUID();
  }

  payWithWallet(
    purpose: LegacyPaymentPurpose,
    requestKey?: string,
  ): Observable<LegacyMe | null> {
    const body: LegacyPaymentWalletRequest = {
      purpose,
      requestKey: requestKey ?? this.newRequestKey(),
    };
    return this.legacyClub.payWithWallet(body).pipe(
      switchMap(() => this.legacyClub.loadMe()),
    );
  }

  payWithWalletRetry409(
    purpose: LegacyPaymentPurpose,
    requestKey: string,
  ): Observable<LegacyMe | null> {
    return this.payWithWallet(purpose, requestKey).pipe(
      tap({
        error: (err: unknown) => {
          if (err instanceof LegacyClubHttpError && err.status === 409) {
            throw new LegacyClubHttpError(
              409,
              LEGACY_ERROR_CODES.DUPLICATE_REQUEST_KEY,
              err.message,
            );
          }
        },
      }),
    );
  }

  submitManualPayment(formData: FormData): Observable<LegacyPaymentRecord> {
    return this.legacyClub.payManual(formData);
  }

  pollUntilPaymentCleared(onTick?: (me: LegacyMe | null) => void): Subscription {
    return interval(POLL_INTERVAL_MS)
      .pipe(
        switchMap(() => this.legacyClub.loadMe()),
        takeWhile((me) => !!me?.pendingPayment || me?.status === 'PENDING_JOIN', true),
      )
      .subscribe((me) => {
        onTick?.(me);
      });
  }

  hasPendingPayment(me: LegacyMe | null | undefined): boolean {
    if (!me) return false;
    return me.status === 'PENDING_JOIN' || !!me.pendingPayment;
  }
}
