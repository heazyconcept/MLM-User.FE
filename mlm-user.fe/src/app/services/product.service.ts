import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

export interface Product {
  id: number;
  name: string;
  price: number;
  description: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private http = inject(HttpClient);
  private apiUrl = 'https://api.example.com/products'; // Replace with actual API

  // Private writable signal for internal state
  private productsState = signal<Product[]>([]);
  private errorState = signal<string | null>(null);

  // Public readonly signals for components to consume
  readonly products = this.productsState.asReadonly();
  readonly error = this.errorState.asReadonly();
  
  // Computed signal for derived state (example: product count)
  readonly productCount = computed(() => this.productsState().length);

  /**
   * Fetches products from the API and updates the signal.
   * Call this from anywhere (e.g., component initialization, refresh button).
   * All subscribers to the `products` signal will automatically update.
   */
  loadProducts() {
    this.http.get<Product[]>(this.apiUrl).pipe(
      catchError(err => {
        this.errorState.set('Failed to load products');
        console.error('Error loading products', err);
        return of([]);
      })
    ).subscribe(products => {
      this.productsState.set(products);
      this.errorState.set(null); // Clear error on success
    });
  }

  /**
   * Example of updating state locally without API call (optimistic UI or simple management)
   */
  addProductLocally(product: Product) {
    this.productsState.update(current => [...current, product]);
  }
}
