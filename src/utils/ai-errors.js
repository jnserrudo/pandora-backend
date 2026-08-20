export function isModelAccessError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('model_not_found')
    || message.includes('do not have access')
    || message.includes('does not exist')
    || error?.status === 404;
}

export function toPublicAiError(error) {
  const raw = String(error?.message || error || '');
  const status = Number(error?.statusCode || error?.status || 500);
  const isRate = status === 429 || /rate.?limit|too many/i.test(raw);
  const publicError = new Error(
    isRate
      ? 'Demasiadas consultas al asistente. Probá de nuevo más tarde.'
      : 'El asistente no está disponible ahora. Intentá de nuevo en un rato.'
  );
  publicError.statusCode = isRate ? 429 : 503;
  return publicError;
}
