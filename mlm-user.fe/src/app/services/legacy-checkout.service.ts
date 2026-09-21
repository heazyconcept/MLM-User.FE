import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, from, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { LegacyClubHttpError, legacyClubMockStore } from '../core/mocks/legacy-club.mock';
import { LEGACY_ERROR_CODES } from '../core/models/legacy-club.models';
import {
  CheckoutConfirmPayload,
} from './cart-checkout.service';
import { LegacyCartService } from './legacy-cart.service';
import { LegacyClubService } from './legacy-club.service';
import {
  CheckoutBatchPayload,
  CheckoutResponse,
  OrderService,
} from './order.service';
import { UserService } from './user.service';
import { ModalService } from './modal.service';
import {
  PROFILE_INCOMPLETE_CODE,
  PROFILE_SETUP_ACTION_LABEL,
  PROFILE_SETUP_PATH,
  PROFILE_SETUP_QUERY,
  PROFILE_SETUP_TITLE,
  checkoutProfileMessage,
  isProfileIncompleteError,
  profileIncompleteMissingFields,
} from '../core/utils/profile-complete.util';

function mapHttpErrorCatch(err: unknown): LegacyClubHttpError {
  if (err instanceof LegacyClubHttpError) return err;
  const http = err as {
    status?: number;
    error?: { code?: string; error?: string; message?: string | string[] };
    message?: string;
  };
  const code = http?.error?.code ?? http?.error?.error ?? 'UNKNOWN';
  const message =
    (typeof http?.error?.message === 'string'
      ? http.error.message
      : Array.isArray(http?.error?.message)
        ? http.error.message[0]
        : undefined) ??
    http?.message ??
    'Something went wrong.';
  return new LegacyClubHttpError(http?.status ?? 500, String(code), message);
}

@Injectable({ providedIn: 'root' })
export class LegacyCheckoutService {
  private orderService = inject(OrderService);
  private legacyCart = inject(LegacyCartService);
  private legacyClub = inject(LegacyClubService);
  private userService = inject(UserService);
  private modalService = inject(ModalService);
  private router = inject(Router);

  private readonly useMocks = environment.useLegacyClubMocks === true;

  requireCompleteProfile(): boolean {
    if (!this.userService.needsProfileSetup()) return true;
    this.modalService.open(
      'warning',
      PROFILE_SETUP_TITLE,
      checkoutProfileMessage(this.userService.currentUser()?.profileMissingFields),
      PROFILE_SETUP_PATH,
      PROFILE_SETUP_ACTION_LABEL,
    );
    void this.router.navigate([PROFILE_SETUP_PATH], { queryParams: { ...PROFILE_SETUP_QUERY } });
    return false;
  }

  submitLegacyCheckout(payload: CheckoutConfirmPayload): Observable<{ checkoutId: string; orderId?: string }> {
    if (!this.requireCompleteProfile()) {
      return throwError(() => ({ code: PROFILE_INCOMPLETE_CODE }));
    }

    if (!this.legacyCart.canCheckout()) {
      return throwError(
        () =>
          new LegacyClubHttpError(
            400,
            LEGACY_ERROR_CODES.LEGACY_CART_BELOW_PACKAGE,
            'Add more products to meet the package amount.',
          ),
      );
    }

    if (this.useMocks) {
      return from(legacyClubMockStore.checkoutAndPay('LEGACY_VOUCHER')).pipe(
        tap(() => {
          this.legacyCart.resetLocal();
          void this.legacyClub.loadMe().subscribe();
        }),
        tap((res) => {
          void this.router.navigate(['/legacy/success'], {
            queryParams: { orderId: res.orderId },
          });
        }),
        catchError((err) => {
          const mapped = err instanceof LegacyClubHttpError ? err : mapHttpErrorCatch(err);
          this.handleCheckoutError(mapped);
          return throwError(() => mapped);
        }),
      );
    }

    const batch: CheckoutBatchPayload = {
      channel: 'LEGACY',
      countryCode: payload.countryCode,
      subdivisionCode: payload.subdivisionCode,
      state: payload.state,
      paymentMethod: 'WALLET',
      idempotencyKey: crypto.randomUUID(),
      groups: payload.groups,
    };

    return this.orderService.checkoutBatch(batch).pipe(
      catchError((err) => {
        if (isProfileIncompleteError(err)) {
          this.modalService.open(
            'warning',
            PROFILE_SETUP_TITLE,
            checkoutProfileMessage(profileIncompleteMissingFields(err)),
            PROFILE_SETUP_PATH,
            PROFILE_SETUP_ACTION_LABEL,
          );
        }
        const mapped = mapHttpErrorCatch(err);
        this.handleCheckoutError(mapped);
        return throwError(() => mapped);
      }),
      switchMap((checkout: CheckoutResponse) =>
        this.orderService.payCheckoutWithWallet(checkout.checkoutId, 'LEGACY_VOUCHER').pipe(
          switchMap(() => this.legacyCart.clear().pipe(map(() => checkout))),
          tap(() => {
            void this.legacyClub.loadMe().subscribe();
            void this.legacyClub.getMonths().subscribe({ error: () => undefined });
          }),
          tap((c) => {
            void this.router.navigate(['/legacy/success'], {
              queryParams: { orderId: c.orders[0]?.id },
            });
          }),
          map((c) => ({ checkoutId: c.checkoutId, orderId: c.orders[0]?.id })),
          catchError((err) => {
            const mapped = mapHttpErrorCatch(err);
            this.handleCheckoutError(mapped);
            return throwError(() => mapped);
          }),
        ),
      ),
    );
  }

  private handleCheckoutError(err: LegacyClubHttpError): void {
    switch (err.code) {
      case LEGACY_ERROR_CODES.LEGACY_CART_BELOW_PACKAGE:
        this.modalService.open('error', 'Cart below package', err.message, '/legacy/cart');
        break;
      case LEGACY_ERROR_CODES.LEGACY_JOIN_REQUIRED:
        void this.router.navigate(['/legacy/join']);
        break;
      case LEGACY_ERROR_CODES.LEGACY_SHOP_JOIN_ONLY:
        void this.router.navigate(['/legacy']);
        break;
      case LEGACY_ERROR_CODES.LEGACY_VOUCHER_REQUIRED:
      case 'INSUFFICIENT_BALANCE':
        this.modalService.open(
          'error',
          'Legacy product voucher',
          err.message || 'Fund your Legacy product voucher, then return here.',
          '/legacy/voucher',
        );
        break;
      default:
        this.modalService.open('error', 'Checkout failed', err.message);
    }
  }
}
