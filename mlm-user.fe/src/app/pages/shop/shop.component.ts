import { Component, inject, OnInit, ViewChild, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ProductService, Product, SortOption } from '../../services/product.service';
import { ProductCardComponent } from './components/product-card.component';
import { FilterBarComponent } from '../../components/filter-bar/filter-bar.component';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [
    CommonModule,
    ProductCardComponent,
    FilterBarComponent,
    SkeletonModule
  ],
  templateUrl: './shop.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShopComponent implements OnInit {
  private productService = inject(ProductService);
  private router = inject(Router);

  @ViewChild(FilterBarComponent) filterBarRef?: FilterBarComponent;

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

  skeletonArray = Array(8).fill(0);

  ngOnInit(): void {
    this.productService.loadProducts();
  }

  onCategorySelect(categoryId: string): void {
    this.productService.setCategory(categoryId);
  }

  onSearchChange(value: string): void {
    this.searchInput.set(value);
    this.productService.setSearchQuery(value);
  }

  onSortChange(option: SortOption): void {
    this.productService.setSortOption(option);
  }

  onClearFilters(): void {
    this.searchInput.set('');
    this.productService.clearFilters();
  }

  onProductClick(product: Product): void {
    this.router.navigate(['/marketplace', 'product', product.id]);
  }

  onExploreCategories(): void {
    this.filterBarRef?.scrollCategoriesIntoView();
  }

  formatCurrency(amount: number): string {
    return `₦${amount.toLocaleString('en-US')}`;
  }
}
