import { Injectable, signal } from '@angular/core';

export type ModalType = 'success' | 'error' | 'info' | 'warning';

export interface ModalState {
  isOpen: boolean;
  type: ModalType;
  title: string;
  message: string;
  redirectTo?: string;
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

  open(type: ModalType, title: string, message: string, redirectTo?: string) {
    this.modalState.set({
      isOpen: true,
      type,
      title,
      message,
      redirectTo
    });
  }

  /**
   * Open modal with an onClose callback (used by realtime notifications to advance the queue).
   */
  openWithCallback(type: ModalType, title: string, message: string, onClose: () => void) {
    this.modalState.set({
      isOpen: true,
      type,
      title,
      message,
      onClose
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
