/** Erreurs HTTP — remplace les exceptions NestJS. */
export class HttpError extends Error {
  readonly status: number;
  readonly corps: Record<string, unknown>;

  constructor(status: number, payload: string | Record<string, unknown> = 'Erreur') {
    const corps = typeof payload === 'string' ? { message: payload } : { ...payload };
    super(String(corps.message ?? 'Erreur'));
    this.status = status;
    this.corps = corps;
    this.name = 'HttpError';
  }

  getStatus() {
    return this.status;
  }

  getResponse() {
    return this.corps;
  }
}

export class BadRequestException extends HttpError {
  constructor(payload: string | Record<string, unknown> = 'Requête invalide.') {
    super(400, payload);
  }
}

export class UnauthorizedException extends HttpError {
  constructor(payload: string | Record<string, unknown> = 'Non autorisé.') {
    super(401, payload);
  }
}

export class ForbiddenException extends HttpError {
  constructor(payload: string | Record<string, unknown> = 'Accès refusé.') {
    super(403, payload);
  }
}

export class NotFoundException extends HttpError {
  constructor(payload: string | Record<string, unknown> = 'Ressource introuvable.') {
    super(404, payload);
  }
}
