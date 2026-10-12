import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import axios, { AxiosError, AxiosResponse } from 'axios';
import { api, fileUrl } from './api';

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

// Adapter custom do axios é responsável por rejeitar status de erro
// (os adapters padrão fazem isso via settle). Sem o reject, o interceptor
// de resposta de erro (401 -> refresh) nunca dispara.
function makeAdapter(handler: (config: any) => { status: number; data: any }) {
  return async (config: any): Promise<AxiosResponse> => {
    const { status, data } = handler(config);
    const response = {
      status,
      statusText: String(status),
      headers: {},
      data,
      config,
      request: {},
    } as unknown as AxiosResponse;
    if (status < 200 || status >= 300) {
      throw new AxiosError(
        `Request failed with status code ${status}`,
        AxiosError.ERR_BAD_RESPONSE,
        config,
        {},
        response
      );
    }
    return response;
  };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  delete (api.defaults as any).adapter;
  delete (axios.defaults as any).adapter;
});

describe('interceptor de sessão (api.ts)', () => {
  it('401 com refresh válido: renova token, repete a requisição e salva a nova sessão', async () => {
    localStorage.setItem('classhub_token', 'token-velho');
    localStorage.setItem('classhub_refresh', 'refresh-valido');
    localStorage.setItem('classhub_user', '{"id":"u1"}');

    let calls = 0;
    let refreshCalls = 0;
    (api.defaults as any).adapter = makeAdapter(() => {
      calls++;
      return calls === 1 ? { status: 401, data: { message: 'expirou' } } : { status: 200, data: { ok: true } };
    });
    (axios.defaults as any).adapter = makeAdapter((config: any) => {
      expect(String(config.url)).toContain('/auth/refresh');
      refreshCalls++;
      return { status: 200, data: { token: 'token-novo', refreshToken: 'refresh-novo' } };
    });

    const res = await api.get('/qualquer');
    expect(refreshCalls).toBe(1);
    expect(calls).toBe(2);
    expect(res.status).toBe(200);
    expect(localStorage.getItem('classhub_token')).toBe('token-novo');
    expect(localStorage.getItem('classhub_refresh')).toBe('refresh-novo');
    expect(localStorage.getItem('classhub_user')).toBe('{"id":"u1"}');
  });

  it('401 com refresh inválido: limpa a sessão e propaga o erro (sem redirect fora do /login)', async () => {
    localStorage.setItem('classhub_token', 'token-expirado');
    localStorage.setItem('classhub_refresh', 'refresh-invalido');
    localStorage.setItem('classhub_user', '{"id":"u1"}');

    (api.defaults as any).adapter = makeAdapter(() => ({ status: 401, data: { message: 'expirou' } }));
    (axios.defaults as any).adapter = makeAdapter(() => ({ status: 401, data: {} }));

    await expect(api.get('/qualquer')).rejects.toMatchObject({ response: { status: 401 } });
    expect(localStorage.getItem('classhub_token')).toBeNull();
    expect(localStorage.getItem('classhub_refresh')).toBeNull();
    expect(localStorage.getItem('classhub_user')).toBeNull();
  });

  it('401 sem refresh salvo: limpa sessão e propaga sem chamar o refresh', async () => {
    localStorage.setItem('classhub_token', 'token-expirado');
    let refreshCalls = 0;
    (api.defaults as any).adapter = makeAdapter(() => ({ status: 401, data: {} }));
    (axios.defaults as any).adapter = makeAdapter(() => {
      refreshCalls++;
      return { status: 200, data: {} };
    });

    await expect(api.get('/outra')).rejects.toMatchObject({ response: { status: 401 } });
    expect(refreshCalls).toBe(0);
    expect(localStorage.getItem('classhub_token')).toBeNull();
  });

  it('anexa o token salvo ao header de autorização', async () => {
    localStorage.setItem('classhub_token', 'meu-token');
    let seen: any = null;
    (api.defaults as any).adapter = (config: any) => {
      seen = config.headers;
      return Promise.resolve({
        status: 200,
        statusText: '200',
        headers: {},
        data: {},
        config,
        request: {},
      } as AxiosResponse);
    };
    await api.get('/qualquer');
    expect(seen.Authorization).toBe('Bearer meu-token');
  });

  it('retry após refresh que também recebe 401 não entra em loop', async () => {
    localStorage.setItem('classhub_refresh', 'refresh-valido');
    let calls = 0;
    (api.defaults as any).adapter = makeAdapter(() => {
      calls++;
      return { status: 401, data: {} };
    });
    (axios.defaults as any).adapter = makeAdapter(() => ({
      status: 200,
      data: { token: 't', refreshToken: 'r' },
    }));

    await expect(api.get('/repetido')).rejects.toMatchObject({ response: { status: 401 } });
    expect(calls).toBe(2);
  });
});
