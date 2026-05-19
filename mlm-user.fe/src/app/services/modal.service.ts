import { Injectable, signal } from '@angular/core';

export type ModalType =
  | 'success'
  | 'error'
  | 'info'
  | 'warning'
  | 'celebration'
  | 'rank-upgrade'
  | 'cpv-milestone';

/** Information needed to render the rank-upgrade modal. */
export interface RankUpgradeInfo {
  previousRank?: string;
  previousRankSubtitle?: string;
  newRank?: string;
  newRankSubtitle?: string;
  /** Pill text e.g. "Stage 1 • Level 1 Unlocked" */
  unlockedLabel?: string;
}

export interface ModalState {
  isOpen: boolean;
  type: ModalType;
  title: string;
  message: string;
  redirectTo?: string;
  actionLabel?: string;
  lottiePath?: string;
  onClose?: () => void;
  /** Earnings amount for celebration modals */
  amount?: number;
  /** Currency code (e.g. 'NGN') for celebration modals */
  currency?: string;
  /** Rank info for rank-upgrade modals */
  rankInfo?: RankUpgradeInfo;
  /** Extra metadata from the notification payload */
  metadata?: Record<string, unknown>;
}

@Injectable({
  providedIn: 'root'
})
export class ModalService {
  modalState = signal<ModalState>({
    isOpen: false,
    type: 'success',
    title: '',
    message: ''
  });

  open(
    type: ModalType,
    title: string,
    message: string,
    redirectTo?: string,
    actionLabel?: string,
    lottiePath?: string,
    amount?: number,
    currency?: string,
    rankInfo?: RankUpgradeInfo
  ) {
    this.modalState.set({
      isOpen: true,
      type,
      title,
      message,
      redirectTo,
      actionLabel,
      lottiePath,
      amount,
      currency,
      rankInfo
    });
  }

  /**
   * Open modal with an onClose callback (used by realtime notifications to advance the queue).
   */
  openWithCallback(
    type: ModalType,
    title: string,
    message: string,
    onClose: () => void,
    redirectTo?: string,
    actionLabel?: string,
    lottiePath?: string,
    amount?: number,
    currency?: string,
    rankInfo?: RankUpgradeInfo
  ) {
    this.modalState.set({
      isOpen: true,
      type,
      title,
      message,
      onClose,
      redirectTo,
      actionLabel,
      lottiePath,
      amount,
      currency,
      rankInfo
    });
  }

  /** Convenience helper for opening a rank-upgrade modal. */
  openRankUpgrade(
    title: string,
    message: string,
    rankInfo: RankUpgradeInfo,
    redirectTo?: string,
    actionLabel?: string
  ) {
    this.open(
      'rank-upgrade',
      title,
      message,
      redirectTo,
      actionLabel,
      undefined,
      undefined,
      undefined,
      rankInfo
    );
  }

  close() {
    const onClose = this.modalState().onClose;
    this.modalState.update(state => ({ ...state, isOpen: false, onClose: undefined }));
    if (onClose) {
      onClose();
    }
  }
}
