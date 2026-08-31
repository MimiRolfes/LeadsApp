/** Fehlerform des Backends: { error: { code, message?, fields? } }. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function toApiError(res: Response): Promise<ApiError> {
  let code = "error";
  let message = `Fehler ${res.status}`;
  let fields: Record<string, string[]> | undefined;
  try {
    const body = (await res.json()) as {
      error?: {
        code?: string;
        message?: string;
        fields?: Record<string, string[]>;
      };
    };
    if (body.error) {
      code = body.error.code ?? code;
      message = body.error.message ?? message;
      fields = body.error.fields;
    }
  } catch {
    // kein JSON-Body
  }
  return new ApiError(res.status, code, message, fields);
}
