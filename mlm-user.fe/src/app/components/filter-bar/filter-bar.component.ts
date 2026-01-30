import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Category } from '../../services/product.service';

export type SortOption = 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc' | 'pv-desc';

export interface SortOptionItem {
  label: string;
  value: SortOption;
}

@Component({
  selector: 'app-filter-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './filter-bar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FilterBarComponent {
  @Input() searchQuery = '';
  @Input() sortOption: SortOption = 'name-asc';
  @Input() sortOptions: SortOptionItem[] = [];
  @Input() categories: Category[] = [];
  @Input() selectedCategory = 'all';

  @Output() searchChange = new EventEmitter<string>();
  @Output() sortChange = new EventEmitter<SortOption>();
  @Output() categoryChange = new EventEmitter<string>();
  @Output() clearFilters = new EventEmitter<void>();

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchChange.emit(value);
  }

  onSortChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as SortOption;
    this.sortChange.emit(value);
  }

  onCategorySelect(categoryId: string): void {
    this.categoryChange.emit(categoryId);
  }

  onClearFilters(): void {
    this.clearFilters.emit();
  }

  @ViewChild('categoryFilters') categoryFiltersRef!: ElementRef<HTMLElement>;

  scrollCategoriesIntoView(): void {
    this.categoryFiltersRef?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
