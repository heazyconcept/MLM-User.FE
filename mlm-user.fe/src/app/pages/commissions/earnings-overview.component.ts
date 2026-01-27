import { Component, inject, computed, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { RouterLink} from '@angular/router';
import { ChartModule } from 'primeng/chart';
import { UserService } from '../../services/user.service';
import { CommissionService } from '../../services/commission.service';
import { EarningsTabsComponent } from './earnings-tabs.component';

@Component({
  selector: 'app-earnings-overview',
  imports: [CommonModule, RouterLink, DecimalPipe, DatePipe, EarningsTabsComponent, ChartModule],
  templateUrl: './earnings-overview.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block bg-gray-50 min-h-screen'
  }
})
export class EarningsOverviewComponent implements OnInit {
  userService = inject(UserService);
  commissionService = inject(CommissionService);

  ngnSummary = this.commissionService.getSummary('NGN');
  usdSummary = this.commissionService.getSummary('USD');
  
  recentEntries = computed(() => {
    return this.commissionService.getAllCommissions()().slice(0, 5);
  });

  // Chart data and options
  chartData: any;
  chartOptions: any;

  ngOnInit(): void {
    this.initChart();
  }

  private initChart(): void {
    const textColorSecondary = '#64748b';
    const surfaceBorder = '#e5e7eb';

    this.chartData = {
      labels: ['Nov 1', 'Nov 4', 'Nov 8', 'Nov 11', 'Nov 15', 'Nov 18', 'Nov 22', 'Nov 25', 'Nov 30'],
      datasets: [
        {
          label: 'Earnings',
          data: [1200, 1900, 1500, 2800, 2200, 3100, 2600, 3500, 4200],
          fill: true,
          borderColor: '#49A321',
          backgroundColor: 'rgba(73, 163, 33, 0.1)',
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#49A321',
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2
        }
      ]
    };

    this.chartOptions = {
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (context: any) => `₦${context.raw.toLocaleString()}`
          }
        }
      },
      scales: {
        x: {
          ticks: { 
            color: textColorSecondary, 
            font: { size: 11 } 
          },
          grid: { 
            display: false 
          },
          border: {
            display: false
          }
        },
        y: {
          ticks: { 
            color: textColorSecondary, 
            font: { size: 11 },
            callback: (value: number) => `₦${value.toLocaleString()}`
          },
          grid: { 
            color: surfaceBorder,
            drawBorder: false
          },
          border: {
            display: false
          }
        }
      },
      interaction: {
        intersect: false,
        mode: 'index'
      }
    };
  }

  getTotalEarned(): number {
    return this.ngnSummary().totalEarnings + (this.usdSummary().totalEarnings * 1500);
  }

  getAvailable(): number {
    return this.ngnSummary().approvedCommissions + (this.usdSummary().approvedCommissions * 1500);
  }

  getPending(): number {
    return this.ngnSummary().pendingCommissions + (this.usdSummary().pendingCommissions * 1500);
  }

  getWithdrawn(): number {
    return this.ngnSummary().withdrawnAmount + (this.usdSummary().withdrawnAmount * 1500);
  }
}
