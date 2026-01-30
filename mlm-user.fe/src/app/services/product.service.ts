import { Injectable, signal, computed } from '@angular/core';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: 'NGN' | 'USD';
  pv: number; // Point Value
  category: string;
  images: string[];
  inStock: boolean;
  eligibleWallets: ('cash' | 'voucher' | 'autoship')[];
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}

// Mock product data
const MOCK_PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Premium Multivitamin Complex',
    description: 'A comprehensive daily multivitamin formula with essential vitamins and minerals. Supports immune health, energy production, and overall wellness. Made with high-quality, bioavailable ingredients for optimal absorption.',
    price: 15000,
    currency: 'NGN',
    pv: 30,
    category: 'health',
    images: [
      'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800',
      'https://images.unsplash.com/photo-1550572017-edd951aa8f72?w=800',
      'https://images.unsplash.com/photo-1577401239170-897942555fb3?w=800',
      'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800'
    ],
    inStock: true,
    eligibleWallets: ['cash', 'voucher']
  },
  {
    id: '2',
    name: 'Organic Protein Powder',
    description: 'Plant-based protein powder with 25g protein per serving. Perfect for post-workout recovery and muscle building. Includes digestive enzymes for easy absorption.',
    price: 22500,
    currency: 'NGN',
    pv: 45,
    category: 'health',
    images: [
      'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=800',
      'https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?w=800',
      'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=800&q=80',
      'https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?w=800&q=80'
    ],
    inStock: true,
    eligibleWallets: ['cash', 'voucher', 'autoship']
  },
  {
    id: '3',
    name: 'Luxury Skincare Set',
    description: 'Complete skincare routine featuring cleanser, toner, serum, and moisturizer. Formulated with natural botanicals and anti-aging peptides for radiant skin.',
    price: 45000,
    currency: 'NGN',
    pv: 90,
    category: 'lifestyle',
    images: [
      'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800',
      'https://images.unsplash.com/photo-1570194065650-d99fb4b38b17?w=800',
      'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=800',
      'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&q=80'
    ],
    inStock: true,
    eligibleWallets: ['cash', 'voucher']
  },
  {
    id: '4',
    name: 'Smart Fitness Tracker',
    description: 'Advanced fitness tracker with heart rate monitoring, sleep tracking, and GPS. Water-resistant design with 7-day battery life. Syncs with mobile app for detailed analytics.',
    price: 35000,
    currency: 'NGN',
    pv: 70,
    category: 'electronics',
    images: [
      'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=800',
      'https://images.unsplash.com/photo-1576243345690-4e4b79b63277?w=800',
      'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800',
      'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=800&q=80'
    ],
    inStock: true,
    eligibleWallets: ['cash']
  },
  {
    id: '5',
    name: 'Omega-3 Fish Oil Capsules',
    description: 'High-potency omega-3 fatty acids sourced from wild-caught fish. Supports heart health, brain function, and joint mobility. 180 capsules per bottle.',
    price: 12000,
    currency: 'NGN',
    pv: 24,
    category: 'health',
    images: [
      'https://images.unsplash.com/photo-1577401239170-897942555fb3?w=800'
    ],
    inStock: true,
    eligibleWallets: ['cash', 'voucher', 'autoship']
  },
  {
    id: '6',
    name: 'Essential Oil Diffuser Set',
    description: 'Ultrasonic aromatherapy diffuser with 6 pure essential oils. Creates a calming atmosphere with color-changing LED lights and auto shut-off timer.',
    price: 18500,
    currency: 'NGN',
    pv: 37,
    category: 'lifestyle',
    images: [
      'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=800'
    ],
    inStock: true,
    eligibleWallets: ['cash', 'voucher']
  },
  {
    id: '7',
    name: 'Monthly Wellness Subscription',
    description: 'Curated monthly box of premium health and wellness products. Includes supplements, healthy snacks, and self-care items. Cancel anytime.',
    price: 25000,
    currency: 'NGN',
    pv: 50,
    category: 'subscriptions',
    images: [
      'https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?w=800'
    ],
    inStock: true,
    eligibleWallets: ['cash', 'autoship']
  },
  {
    id: '8',
    name: 'Wireless Bluetooth Earbuds',
    description: 'Premium wireless earbuds with active noise cancellation. Crystal clear audio, 24-hour battery life with charging case, and IPX5 water resistance.',
    price: 28000,
    currency: 'NGN',
    pv: 56,
    category: 'electronics',
    images: [
      'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800'
    ],
    inStock: false,
    eligibleWallets: ['cash']
  },
  {
    id: '9',
    name: 'Collagen Beauty Powder',
    description: 'Marine collagen peptides for skin, hair, and nail health. Unflavored powder easily mixes into any beverage. 30 servings per container.',
    price: 19500,
    currency: 'NGN',
    pv: 39,
    category: 'health',
    images: [
      'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800'
    ],
    inStock: true,
    eligibleWallets: ['cash', 'voucher', 'autoship']
  },
  {
    id: '10',
    name: 'Meditation & Sleep App - Annual',
    description: '12-month premium subscription to guided meditation and sleep content. Includes hundreds of sessions, sleep stories, and breathing exercises.',
    price: 15000,
    currency: 'NGN',
    pv: 30,
    category: 'subscriptions',
    images: [
      'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800'
    ],
    inStock: true,
    eligibleWallets: ['cash', 'voucher']
  },
  {
    id: '11',
    name: 'Premium Green Tea Collection',
    description: 'Artisan green tea sampler with 6 varieties from Japan and China. Hand-picked leaves with delicate flavors. Perfect for tea enthusiasts.',
    price: 8500,
    currency: 'NGN',
    pv: 17,
    category: 'lifestyle',
    images: [
      'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=800'
    ],
    inStock: true,
    eligibleWallets: ['cash', 'voucher']
  },
  {
    id: '12',
    name: 'Portable Massage Gun',
    description: 'Deep tissue percussion massager with 6 speed settings and 4 interchangeable heads. Relieves muscle tension and speeds up recovery.',
    price: 42000,
    currency: 'NGN',
    pv: 84,
    category: 'electronics',
    images: [
      'https://images.unsplash.com/photo-1617952739858-28043cec5e9a?w=800'
    ],
    inStock: true,
    eligibleWallets: ['cash']
  }
];

const MOCK_CATEGORIES: Category[] = [
  { id: 'all', name: 'All Products', icon: 'pi-th-large' },
  { id: 'health', name: 'Health', icon: 'pi-heart' },
  { id: 'lifestyle', name: 'Lifestyle', icon: 'pi-star' },
  { id: 'electronics', name: 'Electronics', icon: 'pi-bolt' },
  { id: 'subscriptions', name: 'Subscriptions', icon: 'pi-sync' }
];

export type SortOption = 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc' | 'pv-desc';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  // Private state
  private productsState = signal<Product[]>(MOCK_PRODUCTS);
  private categoriesState = signal<Category[]>(MOCK_CATEGORIES);
  private selectedCategoryState = signal<string>('all');
  private searchQueryState = signal<string>('');
  private sortOptionState = signal<SortOption>('name-asc');
  private selectedProductState = signal<Product | null>(null);
  private isLoadingState = signal<boolean>(false);

  // Public readonly signals
  readonly products = this.productsState.asReadonly();
  readonly categories = this.categoriesState.asReadonly();
  readonly selectedCategory = this.selectedCategoryState.asReadonly();
  readonly searchQuery = this.searchQueryState.asReadonly();
  readonly sortOption = this.sortOptionState.asReadonly();
  readonly selectedProduct = this.selectedProductState.asReadonly();
  readonly isLoading = this.isLoadingState.asReadonly();

  // Computed: filtered and sorted products
  readonly filteredProducts = computed(() => {
    let result = this.productsState();
    
    // Filter by category
    const category = this.selectedCategoryState();
    if (category && category !== 'all') {
      result = result.filter(p => p.category === category);
    }
    
    // Filter by search query
    const query = this.searchQueryState().toLowerCase().trim();
    if (query) {
      result = result.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query)
      );
    }
    
    // Sort
    const sort = this.sortOptionState();
    result = [...result].sort((a, b) => {
      switch (sort) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'price-asc':
          return a.price - b.price;
        case 'price-desc':
          return b.price - a.price;
        case 'pv-desc':
          return b.pv - a.pv;
        default:
          return 0;
      }
    });
    
    return result;
  });

  readonly productCount = computed(() => this.filteredProducts().length);
  readonly totalProductCount = computed(() => this.productsState().length);

  // Actions
  setCategory(categoryId: string): void {
    this.selectedCategoryState.set(categoryId);
  }

  setSearchQuery(query: string): void {
    this.searchQueryState.set(query);
  }

  setSortOption(option: SortOption): void {
    this.sortOptionState.set(option);
  }

  selectProduct(product: Product | null): void {
    this.selectedProductState.set(product);
  }

  getProductById(id: string): Product | undefined {
    return this.productsState().find(p => p.id === id);
  }

  clearFilters(): void {
    this.selectedCategoryState.set('all');
    this.searchQueryState.set('');
    this.sortOptionState.set('name-asc');
  }

  // Simulate loading products (for future API integration)
  loadProducts(): void {
    this.isLoadingState.set(true);
    setTimeout(() => {
      this.productsState.set(MOCK_PRODUCTS);
      this.isLoadingState.set(false);
    }, 500);
  }
}
