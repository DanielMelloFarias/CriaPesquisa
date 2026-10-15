import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { Indicadores } from "./Indicadores.js";
import { AuthProvider } from "../auth/AuthContext.js";
import { ThemeModeProvider } from "../theme/ThemeModeContext.js";
import { queryClient } from "../lib/queryClient.js";
import { api } from "../lib/axios.js";

const getSpy = vi.spyOn(api, "get");

const ITENS = [
  {
    id: "i1", codigo: "IND-1", nome: "Cobertura vacinal", tipo: "PROPORCAO", status: "DEFINICAO_INCOMPLETA",
    motivoIncompleto: "pergunta não encontrada: Vacina em dia?", pesquisaId: null, config: null, recorte: null,
    recorteConfig: null, apresentacao: ["Escopo"], categoria: null, meta: null, idsPlanilha: ["1"], dadosPlanilha: null,
  },
  {
    id: "i2", codigo: "IND-2", nome: "Perfil das gestantes", tipo: "MEDIA", status: "DEFINICAO_INCOMPLETA",
    motivoIncompleto: null, pesquisaId: null, config: null, recorte: null,
    recorteConfig: null, apresentacao: ["Perfil"], categoria: null, meta: null, idsPlanilha: ["2"], dadosPlanilha: null,
  },
];

beforeEach(() => {
  localStorage.clear();
  queryClient.clear();
  getSpy.mockReset();
  localStorage.setItem("token", "t");
  localStorage.setItem(
    "usuario",
    JSON.stringify({ id: "1", nome: "Ana", email: "ana@exemplo.local", papel: "GESTOR", precisaTrocarSenha: false }),
  );
  getSpy.mockImplementation((async (url: string) => {
    if (url === "/pesquisas") return { data: { itens: [{ id: "p1", titulo: "Criança", status: "PUBLICADA" }] } };
    return {
      data: { total: 2, page: 1, pageSize: 50, itens: ITENS, contadores: { DEFINICAO_INCOMPLETA: 5, ATIVO: 2, INATIVO: 1 } },
    };
  }) as never);
});

function renderTela() {
  return render(
    <ThemeModeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter>
            <Indicadores />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeModeProvider>,
  );
}

const chamadasIndicadores = () => getSpy.mock.calls.filter((c) => c[0] === "/indicadores");

describe("Indicadores", () => {
  it("mostra os contadores e os nomes dos indicadores", async () => {
    renderTela();

    expect(await screen.findByText(/5 para revisar/)).toBeInTheDocument();
    expect(screen.getByText("Cobertura vacinal")).toBeInTheDocument();
    expect(screen.getByText("Perfil das gestantes")).toBeInTheDocument();
  });

  it("começa filtrando por 'para revisar'", async () => {
    renderTela();
    await screen.findByText("Cobertura vacinal");

    const params = (chamadasIndicadores()[0][1] as { params: Record<string, unknown> }).params;
    expect(params.status).toBe("DEFINICAO_INCOMPLETA");
  });

  it("refaz a chamada ao filtrar por apresentação Perfil", async () => {
    renderTela();
    await screen.findByText("Cobertura vacinal");

    await userEvent.selectOptions(screen.getByLabelText(/apresentação/i), "Perfil");

    await vi.waitFor(() => {
      const ultima = chamadasIndicadores().at(-1)![1] as { params: Record<string, unknown> };
      expect(ultima.params.apresentacao).toBe("Perfil");
    });
  });
});
