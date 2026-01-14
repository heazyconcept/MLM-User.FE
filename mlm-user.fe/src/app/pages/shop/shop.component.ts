import { Component, inject, OnInit, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService, Product, SortOption } from '../../services/product.service';
import { ProductCardComponent } from './components/product-card.component';
import { ProductDetailComponent } from './components/product-detail.component';
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
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShopComponent implements OnInit {
  private productService = inject(ProductService);
  private dialogService = inject(DialogService);
  private dialogRef: DynamicDialogRef | null = null;

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
      contentStyle: { 'max-height': '85vh', 'overflow': 'auto' },
      baseZIndex: 10000,
      dismissableMask: true,
      styleClass: 'product-detail-dialog'
    });
  }

  formatCurrency(amount: number): string {
    return `₦${amount.toLocaleString('en-US')}`;
  }
}

