import { Component, inject, signal, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NetworkService } from '../../../services/network.service';
import { StatCardComponent } from '../../../components/stat-card/stat-card.component';

@Component({
  selector: 'app-performance-cpv',
  standalone: true,
  imports: [CommonModule, StatCardComponent],
  templateUrl: './performance-cpv.component.html'
})
export class PerformanceCpvComponent implements AfterViewInit {
  private networkService = inject(NetworkService);
  cpv = this.networkService.cpvSummary;
  summary = this.networkService.networkSummary;
  
  animatedPercentage = signal(0);

  getPercentage() {
    const { teamCpv, requiredCpv } = this.cpv();
    if (!requiredCpv) return 0;
    return Math.min(100, (teamCpv / requiredCpv) * 100);
  }

  getTeamCpvSubValue(): string {
    return `/ ${this.cpv().requiredCpv} required`;
  }

  getRankSubValue(): string {
    return `${this.summary().nextRank} next`;
  }

  getProgressValue(): string {
    return `${this.getPercentage().toFixed(0)}%`;
  }

  ngAfterViewInit(): void {
    // Start animation after a small delay to ensure view is fully rendered
    setTimeout(() => {
      this.animateProgressBar();
    }, 100);
  }

  private animateProgressBar(): void {
    const targetPercentage = this.getPercentage();
    const duration = 1500; // 1.5 seconds
    const startTime = Date.now();
    const startValue = 0;

    const animate = () => {
      const currentTime = Date.now();
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentValue = startValue + (targetPercentage - startValue) * easeOut;
      
      this.animatedPercentage.set(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Ensure we end exactly at target percentage
        this.animatedPercentage.set(targetPercentage);
      }
    };

    requestAnimationFrame(animate);
  }
}
