import { Injectable, signal } from '@angular/core';

export type ModalType = 'success' | 'error';

export interface ModalState {
  isOpen: boolean;
  type: ModalType;
  title: string;
  message: string;
  redirectTo?: string;
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

  close() {
    this.modalState.update(state => ({ ...state, isOpen: false }));
  }
}
