import { Component, inject, OnInit, OnDestroy, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProductService, Product, SortOption } from '../../services/product.service';
import { ProductCardComponent } from './components/product-card.component';
import { ProductDetailComponent } from './components/product-detail.component';
import { OrderSuccessComponent } from './components/order-success.component';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    ProductCardComponent,
    SkeletonModule
  ],
  providers: [DialogService],
  templateUrl: './shop.component.html',
  styles: [`
    :host ::ng-deep .product-detail-dialog {
      .p-dialog {
        border-radius: 1.5rem;
        overflow: hidden;
      }
      .p-dialog-header {
        padding: 1.25rem 1.5rem;
        border-bottom: 1px solid #f1f5f9;
      }
      .p-dialog-title {
        font-size: 1.125rem;
        font-weight: 700;
        color: #000;
      }
      .p-dialog-header-close {
        width: 2rem;
        height: 2rem;
        border-radius: 0.5rem;
        color: #64748b;
        transition: all 0.2s;
        &:hover {
          background: #f1f5f9;
          color: #000;
        }
      }
    }
    :host ::ng-deep .order-success-dialog {
      .p-dialog {
        border-radius: 1.5rem;
        overflow: hidden;
      }
      .p-dialog-header {
        display: none;
      }
      .p-dialog-content {
        padding: 1rem;
        overflow: hidden;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShopComponent implements OnInit, OnDestroy {
  private productService = inject(ProductService);
  private dialogService = inject(DialogService);
  private router = inject(Router);
  private dialogRef: DynamicDialogRef | null = null;
  private successDialogRef: DynamicDialogRef | null = null;

  // Signals from service
  products = this.productService.filteredProducts;
  categories = this.productService.categories;
  selectedCategory = this.productService.selectedCategory;
  searchQuery = this.productService.searchQuery;
  sortOption = this.productService.sortOption;
  productCount = this.productService.productCount;
  totalProductCount = this.productService.totalProductCount;
  isLoading = this.productService.isLoading;

  // Local state
  searchInput = signal('');
  
  sortOptions = [
    { label: 'Name (A-Z)', value: 'name-asc' as SortOption },
    { label: 'Name (Z-A)', value: 'name-desc' as SortOption },
    { label: 'Price: Low to High', value: 'price-asc' as SortOption },
    { label: 'Price: High to Low', value: 'price-desc' as SortOption },
    { label: 'Highest PV', value: 'pv-desc' as SortOption }
  ];

  // Skeleton array for loading state
  skeletonArray = Array(8).fill(0);

  ngOnInit(): void {
    this.productService.loadProducts();
  }

  ngOnDestroy(): void {
    this.dialogRef?.close();
    this.successDialogRef?.close();
  }

  onCategorySelect(categoryId: string): void {
    this.productService.setCategory(categoryId);
  }

  onSearch(): void {
    this.productService.setSearchQuery(this.searchInput());
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchInput.set(value);
    // Debounced search on typing
    this.productService.setSearchQuery(value);
  }

  onSortChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as SortOption;
    this.productService.setSortOption(value);
  }

  onClearFilters(): void {
    this.searchInput.set('');
    this.productService.clearFilters();
  }

  onProductClick(product: Product): void {
    this.dialogRef = this.dialogService.open(ProductDetailComponent, {
      data: { product },
      header: product.name,
      width: '90vw',
      style: { 'max-width': '900px' },
      contentStyle: { 'max-height': '85vh', 'overflow': 'auto', 'padding': '1.5rem' },
      baseZIndex: 10000,
      dismissableMask: true,
      closable: true,
      closeOnEscape: true,
      styleClass: 'product-detail-dialog'
    });

    // Handle dialog close
    if (this.dialogRef) {
      this.dialogRef.onClose.subscribe((result: any) => {
        if (result?.action === 'order-success') {
          this.openSuccessModal(result.orderData);
        }
      });
    }
  }

  private openSuccessModal(orderData: any): void {
    this.successDialogRef = this.dialogService.open(OrderSuccessComponent, {
      data: orderData,
      width: '90vw',
      style: { 'max-width': '450px' },
      baseZIndex: 10001,
      dismissableMask: false,
      closable: false,
      closeOnEscape: false,
      styleClass: 'order-success-dialog'
    });

    // Handle success modal close
    if (this.successDialogRef) {
      this.successDialogRef.onClose.subscribe((result: any) => {
        if (result?.action === 'view-orders') {
          this.router.navigate(['/orders']);
        }
        // 'continue' action just closes the modal and stays on shop page
      });
    }
  }

  formatCurrency(amount: number): string {
    return `₦${amount.toLocaleString('en-US')}`;
  }
}
