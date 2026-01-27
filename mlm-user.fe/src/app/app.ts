import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ModalComponent } from './components/modal/modal.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ModalComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('MLM-USER.FE');
}
