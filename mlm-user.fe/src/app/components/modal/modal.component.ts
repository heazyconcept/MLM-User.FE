import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalService } from '../../services/modal.service';

import { Router } from '@angular/router';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal.component.html',
  styles: []
})
export class ModalComponent {
  modalService = inject(ModalService);
  private router = inject(Router);

  close() {
    const redirectTo = this.modalService.modalState().redirectTo;
    this.modalService.close();
    if (redirectTo) {
      this.router.navigate([redirectTo]);
    }
  }
}
