import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type SupabaseClient = ReturnType<typeof createClient<Database>>;

// Initialize Supabase with URL and key
export function initializeSupabase(url: string, key: string): void {
  supabaseService.initialize(url, key);
}

class SupabaseService {
  private static instance: SupabaseService;
  private client: SupabaseClient | null = null;
  private url: string | null = null;
  private key: string | null = null;

  private constructor() {}

  public static getInstance(): SupabaseService {
    if (!SupabaseService.instance) {
      SupabaseService.instance = new SupabaseService();
    }
    return SupabaseService.instance;
  }

  public initialize(url: string, key: string): void {
    this.url = url;
    this.key = key;
    this.client = null; // Reset client to force re-initialization
  }

  public getClient(): SupabaseClient {
    if (!this.url || !this.key) {
      throw new Error(
        "Supabase is not initialized. Call initialize() with valid URL and key first."
      );
    }

    if (!this.client) {
      this.client = createClient<Database>(this.url, this.key);
    }

    return this.client;
  }

  public isInitialized(): boolean {
    return !!(this.url && this.key);
  }
}

export const supabaseService = SupabaseService.getInstance();

// Helper functions for common database operations
export async function executeQuery<T>(
  queryFn: (client: SupabaseClient) => Promise<{ data: T | null; error: any }>
): Promise<T> {
  const client = supabaseService.getClient();
  const { data, error } = await queryFn(client);

  if (error) {
    throw new Error(`Database query failed: ${error.message}`);
  }

  if (!data) {
    throw new Error("No data returned from query");
  }

  return data;
}

// Common error handling
export class DatabaseError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public originalError?: any
  ) {
    super(message);
    this.name = "DatabaseError";
  }
}

export function handleDatabaseError(error: any): never {
  if (error instanceof DatabaseError) {
    throw error;
  }

  // Handle Supabase specific errors
  if (error?.code === "PGRST116") {
    throw new DatabaseError("Resource not found", 404, error);
  }

  throw new DatabaseError("An unexpected database error occurred", 500, error);
}
