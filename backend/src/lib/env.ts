export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production')
      throw new Error('JWT_SECRET é obrigatória em produção. Defina no arquivo .env.');
    return 'dev';
  }
  return secret;
}
