import { Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';

export interface ApiQueryState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  isSuccess: boolean;
  isError: boolean;
}

export interface ApiMutationState<TData, TVariables> {
  data: TData | null;
  isLoading: boolean;
  error: Error | null;
  isSuccess: boolean;
  isError: boolean;
  variables: TVariables | null;
}

export interface QueryOptions {
  enabled?: boolean;
  refetchOnMount?: boolean;
  staleTime?: number;
  cacheTime?: number;
}

export interface MutationOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
  invalidateQueries?: string[];
}

export interface QuerySignal<T> {
  state: ReturnType<typeof signal<ApiQueryState<T>>>;
  data: ReturnType<typeof computed<T | null>>;
  isLoading: ReturnType<typeof computed<boolean>>;
  error: ReturnType<typeof computed<Error | null>>;
  isSuccess: ReturnType<typeof computed<boolean>>;
  isError: ReturnType<typeof computed<boolean>>;
  fetch: () => Promise<void>;
  refetch: () => Promise<void>;
  queryKey: string;
}

export interface MutationSignal<TData, TVariables> {
  state: ReturnType<typeof signal<ApiMutationState<TData, TVariables>>>;
  data: ReturnType<typeof computed<TData | null>>;
  isLoading: ReturnType<typeof computed<boolean>>;
  error: ReturnType<typeof computed<Error | null>>;
  isSuccess: ReturnType<typeof computed<boolean>>;
  isError: ReturnType<typeof computed<boolean>>;
  variables: ReturnType<typeof computed<TVariables | null>>;
  mutate: (variables: TVariables) => Promise<void>;
  reset: () => void;
  mutationKey: string;
}

@Injectable({
  providedIn: 'root'
})
export class ApiSignalService {
  private get baseUrl(): string {
    try {
      const env = require('../../../environments/environment')?.environment;
      return env?.apiUrl || 'http://localhost:3000/api';
    } catch {
      return 'http://localhost:3000/api';
    }
  }
  
  private queryRegistry = new Map<string, QuerySignal<any>>();
  private mutationRegistry = new Map<string, MutationSignal<any, any>>();

  constructor(private http: HttpClient) {}

  createQuerySignal<T>(
    queryKey: string,
    fetcher: () => Observable<T>,
    options: QueryOptions = {}
  ): QuerySignal<T> {
    if (this.queryRegistry.has(queryKey)) {
      return this.queryRegistry.get(queryKey)! as QuerySignal<T>;
    }

    const state = signal<ApiQueryState<T>>({
      data: null,
      isLoading: false,
      error: null,
      isSuccess: false,
      isError: false,
    });

    const data = computed(() => state().data);
    const isLoading = computed(() => state().isLoading);
    const error = computed(() => state().error);
    const isSuccess = computed(() => state().isSuccess);
    const isError = computed(() => state().isError);

    const fetch = async () => {
      if (state().isLoading) return;

      state.update(s => ({ ...s, isLoading: true, error: null, isError: false }));

      try {
        const result = await firstValueFrom(fetcher());
        state.set({
          data: result,
          isLoading: false,
          error: null,
          isSuccess: true,
          isError: false,
        });
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error occurred');
        state.set({
          data: null,
          isLoading: false,
          error,
          isSuccess: false,
          isError: true,
        });
      }
    };

    const refetch = () => fetch();

    if (options.enabled !== false) {
      fetch();
    }

    const querySignal = {
      state,
      data,
      isLoading,
      error,
      isSuccess,
      isError,
      fetch,
      refetch,
      queryKey,
    };

    this.queryRegistry.set(queryKey, querySignal);
    return querySignal;
  }

  createMutationSignal<TData, TVariables = any>(
    mutationKey: string,
    mutator: (variables: TVariables) => Observable<TData>,
    options: MutationOptions = {}
  ): MutationSignal<TData, TVariables> {
    if (this.mutationRegistry.has(mutationKey)) {
      return this.mutationRegistry.get(mutationKey)! as MutationSignal<TData, TVariables>;
    }

    const state = signal<ApiMutationState<TData, TVariables>>({
      data: null,
      isLoading: false,
      error: null,
      isSuccess: false,
      isError: false,
      variables: null,
    });

    const data = computed(() => state().data);
    const isLoading = computed(() => state().isLoading);
    const error = computed(() => state().error);
    const isSuccess = computed(() => state().isSuccess);
    const isError = computed(() => state().isError);
    const variables = computed(() => state().variables);

    const mutate = async (variables: TVariables) => {
      if (state().isLoading) return;

      state.update(s => ({
        ...s,
        isLoading: true,
        error: null,
        isError: false,
        variables,
      }));

      try {
        const result = await firstValueFrom(mutator(variables));
        state.set({
          data: result,
          isLoading: false,
          error: null,
          isSuccess: true,
          isError: false,
          variables,
        });

        if (options.onSuccess) {
          options.onSuccess(result);
        }

        if (options.invalidateQueries) {
          options.invalidateQueries.forEach((key: string) => {
            const query = this.queryRegistry.get(key);
            if (query) {
              query.refetch();
            }
          });
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error occurred');
        state.set({
          data: null,
          isLoading: false,
          error,
          isSuccess: false,
          isError: true,
          variables,
        });

        if (options.onError) {
          options.onError(error);
        }
      }
    };

    const reset = () => {
      state.set({
        data: null,
        isLoading: false,
        error: null,
        isSuccess: false,
        isError: false,
        variables: null,
      });
    };

    const mutationSignal = {
      state,
      data,
      isLoading,
      error,
      isSuccess,
      isError,
      variables,
      mutate,
      reset,
      mutationKey,
    };

    this.mutationRegistry.set(mutationKey, mutationSignal);
    return mutationSignal;
  }

  getQuerySignal<T>(queryKey: string) {
    return this.queryRegistry.get(queryKey) as QuerySignal<T> | undefined;
  }

  getMutationSignal<TData, TVariables = any>(mutationKey: string) {
    return this.mutationRegistry.get(mutationKey) as MutationSignal<TData, TVariables> | undefined;
  }

  invalidateQuery(queryKey: string) {
    const query = this.queryRegistry.get(queryKey);
    if (query) {
      query.refetch();
    }
  }

  invalidateQueries(queryKeys: string[]) {
    queryKeys.forEach(key => this.invalidateQuery(key));
  }

  clearAllQueries() {
    this.queryRegistry.forEach(query => {
      query.state.set({
        data: null,
        isLoading: false,
        error: null,
        isSuccess: false,
        isError: false,
      });
    });
  }

  get<T>(endpoint: string, params?: Record<string, any>): Observable<T> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return this.http.get<T>(`${this.baseUrl}/${endpoint}`, { params: httpParams });
  }

  post<T>(endpoint: string, body: any): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}/${endpoint}`, body);
  }

  put<T>(endpoint: string, body: any): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}/${endpoint}`, body);
  }

  patch<T>(endpoint: string, body: any): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}/${endpoint}`, body);
  }

  delete<T>(endpoint: string): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}/${endpoint}`);
  }
}
