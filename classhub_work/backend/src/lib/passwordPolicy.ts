export interface PasswordStrengthResult {
  score: number;
  feedback: string[];
  isStrong: boolean;
}

const COMMON_PASSWORDS = new Set([
  'password', '123456', '123456789', 'qwerty', 'abc123', 'password123',
  'admin', 'letmein', 'welcome', 'monkey', 'dragon', 'master',
  'hello', 'freedom', 'whatever', 'qazwsx', 'trustno1', '654321',
]);

function calculateEntropy(password: string): number {
  let poolSize = 0;
  if (/[a-z]/.test(password)) poolSize += 26;
  if (/[A-Z]/.test(password)) poolSize += 26;
  if (/[0-9]/.test(password)) poolSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) poolSize += 32;
  return password.length * Math.log2(poolSize);
}

function hasSequentialChars(password: string): boolean {
  const sequences = [
    'abcdefghijklmnopqrstuvwxyz',
    '0123456789',
    'qwertyuiop',
    'asdfghjkl',
    'zxcvbnm',
  ];
  const lower = password.toLowerCase();
  for (const seq of sequences) {
    for (let i = 0; i <= seq.length - 3; i++) {
      const sub = seq.slice(i, i + 3);
      if (lower.includes(sub) || lower.includes(sub.split('').reverse().join(''))) {
        return true;
      }
    }
  }
  return false;
}

function hasRepeatedChars(password: string): boolean {
  return /(.)\1{2,}/.test(password);
}

export function checkPasswordStrength(password: string): PasswordStrengthResult {
  const feedback: string[] = [];
  let score = 0;

  if (password.length < 12) {
    feedback.push('Senha deve ter pelo menos 12 caracteres');
  } else if (password.length >= 16) {
    score += 20;
  } else {
    score += 10;
  }

  if (/[a-z]/.test(password)) score += 10;
  else feedback.push('Adicione letras minúsculas');

  if (/[A-Z]/.test(password)) score += 10;
  else feedback.push('Adicione letras maiúsculas');

  if (/[0-9]/.test(password)) score += 10;
  else feedback.push('Adicione números');

  if (/[^a-zA-Z0-9]/.test(password)) score += 15;
  else feedback.push('Adicione caracteres especiais (!@#$%^&*)');

  const entropy = calculateEntropy(password);
  if (entropy < 60) {
    feedback.push('Senha muito previsível (entropia baixa)');
  } else if (entropy >= 80) {
    score += 20;
  } else {
    score += 10;
  }

  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    score = 0;
    feedback.push('Senha muito comum, escolha outra');
  }

  if (hasSequentialChars(password)) {
    score -= 10;
    feedback.push('Evite sequências (abc, 123, qwerty)');
  }

  if (hasRepeatedChars(password)) {
    score -= 5;
    feedback.push('Evite caracteres repetidos (aaa, 111)');
  }

  const isStrong = score >= 60 && password.length >= 12 && entropy >= 60;

  return {
    score: Math.max(0, Math.min(100, score)),
    feedback,
    isStrong,
  };
}

export function validatePasswordPolicy(password: string): { valid: boolean; message?: string } {
  const result = checkPasswordStrength(password);
  if (!result.isStrong) {
    return {
      valid: false,
      message: `Senha fraca: ${result.feedback.join(', ')}`,
    };
  }
  return { valid: true };
}