export function humanizeErrorMessage(message: string) {
  const value = message || "Something went wrong.";
  const lower = value.toLowerCase();

  if (lower.includes("quota") || lower.includes("insufficient_quota")) {
    return "We couldn't finish because the OpenAI account is out of credits or quota. Add credits, then try again.";
  }

  if (lower.includes("rate limit") || lower.includes("429")) {
    return "The AI service is receiving too many requests right now. Wait a moment, then try again.";
  }

  if (lower.includes("timeout") || lower.includes("aborted")) {
    return "The request took too long and was safely stopped. Try again, or use a smaller input.";
  }

  if (lower.includes("failed with status 500") || lower.includes("internal server error")) {
    return "We couldn't finish that request because a service returned an internal error. Nothing was deleted; try again shortly.";
  }

  if (lower.includes("supabase")) {
    return "The database connection is not ready. Check the Supabase keys and run the latest migrations.";
  }

  return value;
}
