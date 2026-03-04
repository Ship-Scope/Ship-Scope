export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export type SortOrder = 'asc' | 'desc';

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: SortOrder;
}

export interface DateRange {
  from?: string;
  to?: string;
}

export interface ApiError {
  error: string;
  details?: Record<string, unknown>;
  statusCode: number;
}

export interface ApiSuccess<T> {
  data: T;
  message?: string;
}
