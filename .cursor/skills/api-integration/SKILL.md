---
description: Guide for implementing proper API integrations and tracking progress
---

# API Integration Skill

This skill provides a standardized approach to integrating APIs in the application, ensuring consistency, type safety, and proper error handling. It includes safety procedures, mandatory unit testing, and progress tracking.

## 1. Preparation

Before starting an integration task:

1.  **Analyze**: Identify the component or service that needs API integration.
2.  **Contracts**: Ensure you have the API endpoint details (URL, method, request body, response type).
3.  **Types**: Define TypeScript interfaces for the Request and Response payloads.

## 1.1 Safety Procedures (MANDATORY)

Before and during implementation, follow these safety checks:

1.  **Environment**: Verify `environment.apiUrl` is correctly configured. Never hardcode API base URLs.
2.  **Auth**: Ensure protected endpoints use the auth interceptor (token injection). Confirm the endpoint requires auth if applicable.
3.  **Error Handling**: Every API call MUST use `catchError` or equivalent to handle failures. Never leave unhandled HTTP errors.
4.  **Types**: All request/response payloads MUST have TypeScript interfaces. Avoid `any` or untyped responses.
5.  **Sensitive Data**: Never log request/response bodies containing passwords, tokens, or PII in production.

## 2. Implementation Steps

### Step 1: Define Interfaces

Create or update types in the service file or a dedicated `models` file.

```typescript
export interface UserProfile {
  id: string;
  email: string;
  // ... other fields
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
```

### Step 2: Inject ApiService

Ensure the service imports and injects the `ApiService`.

```typescript
import { inject } from '@angular/core';
import { ApiService } from '../services/api.service';

@Injectable({ providedIn: 'root' })
export class FeatureService {
  private api = inject(ApiService);
  // ...
}
```

### Step 3: Implement Methods

Replace mock data or generic `HttpClient` calls with `ApiService` methods. Use RxJS operators for side effects and state management.

```typescript
// Example: Fetching data
getProfile(): Observable<UserProfile> {
  return this.api.get<ApiResponse<UserProfile>>('user/profile').pipe(
    map(response => response.data),
    catchError(this.handleError) // Centralized error handling if available
  );
}
```

### Step 4: State Management (Signals)

Use Angular Signals to manage `loading`, `error`, and `data` states.

```typescript
export class FeatureService {
  private _data = signal<Data | null>(null);
  private _loading = signal<boolean>(false);
  private _error = signal<string | null>(null);

  readonly data = this._data.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  fetchData() {
    this._loading.set(true);
    this.api.get<Data>('endpoint').subscribe({
      next: (res) => {
        this._data.set(res);
        this._loading.set(false);
      },
      error: (err) => {
        this._error.set(err.message);
        this._loading.set(false);
      }
    });
  }
}
```

## 3. Unit Test (MANDATORY)

Before considering an endpoint integration complete, you **MUST** run a unit test to confirm it works.

### Step 1: Create or Update Service Spec

For each service that uses an API endpoint, add or update tests in `*.service.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FeatureService } from './feature.service';
import { ApiService } from '../services/api.service';

describe('FeatureService', () => {
  let service: FeatureService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [FeatureService, ApiService]
    });
    service = TestBed.inject(FeatureService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should fetch profile from GET /user/profile', () => {
    const mockResponse = { success: true, data: { id: '1', email: 'test@example.com' } };
    service.getProfile().subscribe(res => expect(res.email).toBe('test@example.com'));
    const req = httpMock.expectOne(r => r.url.includes('user/profile') && r.method === 'GET');
    req.flush(mockResponse);
  });
});
```

### Step 2: Run Tests

Execute `ng test` (or `npm test`) and ensure all tests pass before proceeding.

```bash
ng test
```

**Do not mark an endpoint as completed until its unit test passes.**

## 4. Progress Tracking (MANDATORY)

You **MUST** update progress files after *every* successful integration.

### 4.1 API Integration Table: `mlm-user.fe/progress.md`

Append a new row for each completed endpoint:

| Feature | Endpoint | Status | Date | Notes |
|---------|----------|--------|------|-------|
| User Profile | GET /user/profile | ✅ Completed | YYYY-MM-DD | Migrated from mock data |
| Auth Login | POST /auth/login | 🚧 In Progress | YYYY-MM-DD | Pending backend fix |

**Status Icons:** ✅ Completed | 🚧 In Progress | ❌ Failed/Blocked | ⏸️ Pending

### 4.2 Overall Build State: `progress.txt`

When a significant integration milestone is reached (e.g., auth fully wired, marketplace live), update the root `progress.txt` to reflect the new state (e.g., under PENDING / NOT DONE or FEATURES).

## 5. Verification Checklist

After implementation, unit test, and progress update:

1.  **Unit Test**: `ng test` passes for the new/updated spec.
2.  **UI**: Verify the integration works in the browser.
3.  **Network**: Check DevTools Network tab for correct request/response.
4.  **Error Handling**: Simulate network errors to verify graceful degradation.
