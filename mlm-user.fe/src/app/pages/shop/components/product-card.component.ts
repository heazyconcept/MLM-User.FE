import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Product } from '../../../services/product.service';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-card.component.html',
  styles: [`
    :host {
      display: block;
    }
    
    .line-clamp-1 {
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    
    .line-clamp-2 {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductCardComponent {
  @Input({ required: true }) product!: Product;
  @Output() productClick = new EventEmitter<Product>();

  onProductClick(): void {
    this.productClick.emit(this.product);
  }

  getCategoryLabel(): string {
    const labels: Record<string, string> = {
      'health': 'Health',
      'lifestyle': 'Lifestyle',
      'electronics': 'Tech',
      'subscriptions': 'Subscribe'
    };
    return labels[this.product.category] || this.product.category;
  }

  getRating(): string {
    // Generate a consistent "rating" based on product id for demo
    const ratings = ['4.8', '4.9', '5.0', '4.7', '4.9'];
    const index = parseInt(this.product.id) % ratings.length;
    return ratings[index];
  }

  getShortDescription(): string {
    // Return first sentence or truncate to ~60 chars
    const firstSentence = this.product.description.split('.')[0];
    return firstSentence.length > 80 ? firstSentence.substring(0, 77) + '...' : firstSentence + '.';
  }

  formatCurrency(amount: number): string {
    return `₦${amount.toLocaleString('en-US')}`;
  }
}
