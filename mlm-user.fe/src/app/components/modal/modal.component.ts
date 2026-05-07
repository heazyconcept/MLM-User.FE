import { Component, inject } from '@angular/core';
import { ModalService } from '../../services/modal.service';

import { Router } from '@angular/router';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [],
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
      const currentUrl = this.router.url;
      const basePath = redirectTo.split('?')[0];
      const currentBasePath = currentUrl.split('?')[0];
      
      if (basePath === currentBasePath) {
        this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
          this.router.navigate([redirectTo]);
        });
      } else {
        this.router.navigate([redirectTo]);
      }
    }
  }
}
