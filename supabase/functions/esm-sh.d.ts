declare module "supabase-js-url-types" {
  export {
    createClient,
    FunctionRegion,
    FunctionsError,
    FunctionsFetchError,
    FunctionsHttpError,
    FunctionsRelayError,
    PostgrestError,
    SupabaseClient,
  } from "@supabase/supabase-js";

  export type {
    AuthSession,
    AuthUser,
    DatabaseWithoutInternals,
    FunctionInvokeOptions,
    PostgrestMaybeSingleResponse,
    PostgrestResponse,
    PostgrestSingleResponse,
    QueryData,
    QueryError,
    QueryResult,
    SupabaseClientOptions,
  } from "@supabase/supabase-js";
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export * from "supabase-js-url-types";
}

declare module "https://esm.sh/@supabase/supabase-js@2.7.1" {
  export * from "supabase-js-url-types";
}

declare module "https://esm.sh/@supabase/supabase-js@2.45.4" {
  export * from "supabase-js-url-types";
}
