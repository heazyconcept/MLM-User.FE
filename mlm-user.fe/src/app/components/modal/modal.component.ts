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
    const type = this.modalService.modalState().type;
    if (type === 'celebration' || type === 'rank-upgrade' || type === 'cpv-milestone') {
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

  /**
   * Format the celebration reward amount using the modal state's currency.
   * Uses NGN/Naira symbol (₦) by default. Returns an empty string when no
   * amount is supplied so the reward card can be hidden by the template.
   */
  formattedAmount(): string {
    const state = this.modalService.modalState();
    const amount = state.amount;
    if (amount === undefined || amount === null || Number.isNaN(amount)) {
      return '';
    }

    const currency = state.currency ?? 'NGN';
    try {
      // en-NG renders NGN as the ₦ symbol with grouping and 2 decimals.
      return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      // Fallback if currency code is unsupported by Intl.
      const symbol = currency === 'NGN' ? '₦' : `${currency} `;
      return `${symbol}${amount.toFixed(2)}`;
    }
  }

  // ── Rank-upgrade accessors ──────────────────────────────────────────
  rankPrevious(): string {
    return this.modalService.modalState().rankInfo?.previousRank ?? 'Stakeholder';
  }
  rankPreviousSubtitle(): string {
    return this.modalService.modalState().rankInfo?.previousRankSubtitle ?? '(Entry Level)';
  }
  rankNew(): string {
    return this.modalService.modalState().rankInfo?.newRank ?? 'Mentor';
  }
  rankNewSubtitle(): string {
    return this.modalService.modalState().rankInfo?.newRankSubtitle ?? '(Stage 1, Level 1)';
  }
  rankUnlockedLabel(): string {
    return (
      this.modalService.modalState().rankInfo?.unlockedLabel ?? 'Stage 1 • Level 1 Unlocked'
    );
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
