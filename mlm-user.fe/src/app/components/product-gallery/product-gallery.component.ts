import { Component, Input, Output, EventEmitter, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-product-gallery',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-gallery.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductGalleryComponent {
  @Input() images: string[] = [];
  @Input() alt = '';

  @Output() imageSelect = new EventEmitter<string>();

  selectedImage = signal('');

  get displayImage(): string {
    return this.selectedImage() || (this.images[0] ?? '');
  }

  selectImage(image: string): void {
    this.selectedImage.set(image);
    this.imageSelect.emit(image);
  }
}
