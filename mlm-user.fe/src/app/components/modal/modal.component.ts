import { Component, ElementRef, ViewChild, effect, inject } from '@angular/core';
import { ModalService } from '../../services/modal.service';

import { Router } from '@angular/router';
import lottie, { AnimationItem } from 'lottie-web';

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
  private celebrationAnimation?: AnimationItem;

  @ViewChild('celebrationAnimation')
  private celebrationAnimationRef?: ElementRef<HTMLDivElement>;

  constructor() {
    effect(() => {
      const state = this.modalService.modalState();
      if (state.isOpen && state.type === 'celebration') {
        setTimeout(() => this.initCelebrationAnimation(), 0);
      } else {
        this.destroyCelebrationAnimation();
      }
    });
  }

  close(navigate = true) {
    const redirectTo = this.modalService.modalState().redirectTo;
    this.modalService.close();
    if (navigate && redirectTo) {
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

  dismiss(): void {
    this.close(false);
  }

  onBackdropClick(): void {
    if (this.modalService.modalState().type === 'celebration') {
      this.dismiss();
      return;
    }
    this.close();
  }

  handlePrimaryAction(): void {
    const redirectTo = this.modalService.modalState().redirectTo;
    if (redirectTo) {
      this.close(true);
      return;
    }
    this.close(false);
  }

  primaryActionLabel(): string {
    return this.modalService.modalState().actionLabel ?? 'Continue';
  }

  private initCelebrationAnimation(): void {
    if (!this.celebrationAnimationRef?.nativeElement || this.celebrationAnimation) return;

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.celebrationAnimation = lottie.loadAnimation({
      container: this.celebrationAnimationRef.nativeElement,
      renderer: 'svg',
      loop: !reduceMotion,
      autoplay: !reduceMotion,
      path: this.modalService.modalState().lottiePath ?? '/assets/lottie/trophy.json',
    });

    if (reduceMotion) {
      this.celebrationAnimation.goToAndStop(0, true);
    }
  }

  private destroyCelebrationAnimation(): void {
    if (this.celebrationAnimation) {
      this.celebrationAnimation.destroy();
      this.celebrationAnimation = undefined;
    }
    if (this.celebrationAnimationRef?.nativeElement) {
      this.celebrationAnimationRef.nativeElement.innerHTML = '';
    }
  }
}
