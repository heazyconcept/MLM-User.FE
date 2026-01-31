import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-copy-button',
  standalone: true,
  imports: [CommonModule, ButtonModule, TooltipModule],
  templateUrl: './copy-button.component.html'
})
export class CopyButtonComponent {
  @Input() textToCopy: string = '';
  @Input() label: string = 'Copy';
  @Input() tooltip: string = 'Copy to clipboard';
  @Input() styleClass: string = '';

  /** Emitted when text was successfully copied to clipboard (e.g. for showing a toast). */
  @Output() copiedSuccess = new EventEmitter<void>();

  copied = signal(false);

  copyToClipboard() {
    if (!this.textToCopy) return;
    
    navigator.clipboard.writeText(this.textToCopy).then(() => {
      this.copied.set(true);
      this.copiedSuccess.emit();
      setTimeout(() => this.copied.set(false), 2000);
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  }
}
