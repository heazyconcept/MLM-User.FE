import { Injectable, signal } from '@angular/core';

export type ModalType = 'success' | 'error';

export interface ModalState {
  isOpen: boolean;
  type: ModalType;
  title: string;
  message: string;
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

  open(type: ModalType, title: string, message: string) {
    this.modalState.set({
      isOpen: true,
      type,
      title,
      message
    });
  }

  close() {
    this.modalState.update(state => ({ ...state, isOpen: false }));
  }
}
