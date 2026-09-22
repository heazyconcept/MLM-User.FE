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
    pin: string,
    requestKey?: string,
  ): Observable<LegacyMe | null> {
    const key = requestKey ?? this.newRequestKey();
    const body: LegacyPaymentWalletRequest = { purpose, requestKey: key, pin };
    return this.legacyClub.payWithWallet(body).pipe(
      switchMap(() => this.legacyClub.loadMe()),
    );
  }

  payWithWalletRetry409(
    purpose: LegacyPaymentPurpose,
    pin: string,
    requestKey: string,
  ): Observable<LegacyMe | null> {
    return this.payWithWallet(purpose, pin, requestKey).pipe(
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

  pollUntilPaymentCleared(onTick?: () => void): Subscription {
    return interval(POLL_INTERVAL_MS)
      .pipe(
        switchMap(() => this.legacyClub.loadMe()),
        takeWhile((me) => !!me?.pendingPayment || me?.status === 'PENDING_JOIN', true),
      )
      .subscribe((me) => {
        onTick?.();
        if (me && !me.pendingPayment && me.status !== 'PENDING_JOIN') {
          return;
        }
      });
  }

  hasPendingPayment(me: LegacyMe | null | undefined): boolean {
    if (!me) return false;
    return me.status === 'PENDING_JOIN' || !!me.pendingPayment;
  }
}
