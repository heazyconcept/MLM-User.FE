import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-earnings-tabs',
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './earnings-tabs.component.html'
})
export class EarningsTabsComponent {}
