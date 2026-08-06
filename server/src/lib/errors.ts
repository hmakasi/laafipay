export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Non authentifié') {
    super(401, message);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'Permission refusée') {
    super(403, message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Introuvable') {
    super(404, message);
  }
}
