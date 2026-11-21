/** An error whose message is safe to show the user, with an HTTP status and a stable code. */
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}
