import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api";

const FIRST_SERVER_ERROR_STATUS = 500;
const MAX_QUERY_RETRIES = 2;
const QUERY_STALE_TIME_MS = 15_000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status < FIRST_SERVER_ERROR_STATUS) return false;
        return failureCount < MAX_QUERY_RETRIES;
      },
      staleTime: QUERY_STALE_TIME_MS,
    },
  },
});
