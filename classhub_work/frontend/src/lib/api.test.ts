import { describe, it, expect } from 'vitest';
import { fileUrl } from './api';

describe('fileUrl', () => {
  it('monta URL absoluta a partir de um caminho de upload', () => {
    expect(fileUrl('uploads/material.pdf')).toBe('http://localhost:4000/uploads/material.pdf');
  });

  it('normaliza barras invertidas (Windows)', () => {
    expect(fileUrl('uploads\\avatar-1.png')).toBe('http://localhost:4000/uploads/avatar-1.png');
  });

  it('tolera caminho iniciando com / (barra dupla, aceita pelo servidor)', () => {
    expect(fileUrl('/uploads/a.docx')).toBe('http://localhost:4000//uploads/a.docx');
  });
});
