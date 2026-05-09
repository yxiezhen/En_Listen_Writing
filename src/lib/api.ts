import { ZodError } from "zod";

export function jsonError(error: unknown, status = 500) {
  if (process.env.NODE_ENV !== "production") {
    console.error(error);
  }

  if (error instanceof ZodError) {
    return Response.json(
      { error: "Invalid request", details: error.issues },
      { status: 400 },
    );
  }

  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const message = error instanceof Error ? error.message : "Unexpected error";
  return Response.json({ error: message }, { status });
}

export function requireFile(value: FormDataEntryValue | null, field: string) {
  if (!(value instanceof File) || value.size === 0) {
    throw new Error(`Missing file field: ${field}`);
  }

  return value;
}

export function requireText(value: FormDataEntryValue | null, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing text field: ${field}`);
  }

  return value.trim();
}
