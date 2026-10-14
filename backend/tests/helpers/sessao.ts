import { gerarToken } from "../../src/helper/token.js";

/**
 * Substituto de src/models/sessaoModel.js para testes que não usam o banco.
 * O middleware `autenticar` relê o usuário a cada requisição; aqui essa
 * leitura vem de um mapa em memória preenchido por `tokenDe`.
 *
 * Uso no arquivo de teste:
 *   vi.mock("../src/models/sessaoModel.js", async () => (await import("./helpers/sessao.js")).moduloSessaoFalso);
 *   const token = tokenDe("u1", "GESTOR");
 */

type EstadoUsuario = { id: string; papel: string; ativo: boolean; precisaTrocarSenha: boolean };

const usuarios = new Map<string, EstadoUsuario>();

export const moduloSessaoFalso = {
  sessaoModel: {
    // Função comum (não vi.fn): vi.clearAllMocks/resetAllMocks não a apagam.
    buscarPorId: async (id: string) => usuarios.get(id) ?? null,
  },
};

/** Registra o usuário como existente e ativo e devolve um token para ele. */
export function tokenDe(id: string, papel: string, estado: Partial<Omit<EstadoUsuario, "id" | "papel">> = {}): string {
  usuarios.set(id, { id, papel, ativo: true, precisaTrocarSenha: false, ...estado });
  return gerarToken({ sub: id, papel });
}
