import { Injectable, inject } from '@angular/core';
import { LegacyMe } from '../core/models/legacy-club.models';
import {
  buildLegacyQualifyCelebrationCopy,
  hasCelebratedLegacyQualify,
  legacyQualifyCelebrationStorageKey,
  markCelebratedLegacyQualify,
  shouldCelebrateLegacyQualify,
} from '../core/utils/legacy-qualify-celebration.util';
import { ModalService } from './modal.service';

const MODAL_RETRY_MS = 1500;

@Injectable({ providedIn: 'root' })
export class LegacyQualifyCelebrationService {
  private modalService = inject(ModalService);
  private retryScheduled = false;

  maybeCelebrate(me: LegacyMe | null, userId: string): void {
    if (!shouldCelebrateLegacyQualify(me)) return;

    const storageKey = legacyQualifyCelebrationStorageKey(userId, me!);
    if (hasCelebratedLegacyQualify(sessionStorage, storageKey)) return;

    if (this.modalService.modalState().isOpen) {
      this.scheduleRetry(me, userId);
      return;
    }

    this.openCelebration(me!, storageKey);
  }

  private scheduleRetry(me: LegacyMe | null, userId: string): void {
    if (this.retryScheduled) return;
    this.retryScheduled = true;
    setTimeout(() => {
      this.retryScheduled = false;
      this.maybeCelebrate(me, userId);
    }, MODAL_RETRY_MS);
  }

  private openCelebration(me: LegacyMe, storageKey: string | null): void {
    const copy = buildLegacyQualifyCelebrationCopy(me);
    markCelebratedLegacyQualify(sessionStorage, storageKey);
    this.modalService.open(
      'celebration',
      copy.title,
      copy.message,
      copy.redirectTo,
      copy.actionLabel,
      copy.lottiePath,
    );
  }
}
