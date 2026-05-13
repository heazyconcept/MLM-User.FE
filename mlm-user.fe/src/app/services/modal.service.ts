import { Injectable, signal } from '@angular/core';

export type ModalType = 'success' | 'error' | 'info' | 'warning' | 'celebration';

export interface ModalState {
  isOpen: boolean;
  type: ModalType;
  title: string;
  message: string;
  redirectTo?: string;
  actionLabel?: string;
  lottiePath?: string;
  onClose?: () => void;
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
    lottiePath?: string
  ) {
    this.modalState.set({
      isOpen: true,
      type,
      title,
      message,
      redirectTo,
      actionLabel,
      lottiePath
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
    lottiePath?: string
  ) {
    this.modalState.set({
      isOpen: true,
      type,
      title,
      message,
      onClose,
      redirectTo,
      actionLabel,
      lottiePath
    });
  }

  close() {
    const onClose = this.modalState().onClose;
    this.modalState.update(state => ({ ...state, isOpen: false, onClose: undefined }));
    if (onClose) {
      onClose();
    }
  }
}
