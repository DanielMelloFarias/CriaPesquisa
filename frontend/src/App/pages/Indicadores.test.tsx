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
  getSpy.mockImplementation((async (url: string, cfg?: { params?: { page?: number } }) => {
    if (url === "/pesquisas") return { data: { itens: [{ id: "p1", titulo: "Criança", status: "PUBLICADA" }] } };
    return {
      data: {
        total: 120,
        page: cfg?.params?.page ?? 1,
        pageSize: 50,
        itens: ITENS,
        contadores: { DEFINICAO_INCOMPLETA: 5, ATIVO: 2, INATIVO: 1 },
      },
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

  it("pagina: mostra o intervalo, pede a página 2 e volta à 1 ao trocar filtro", async () => {
    renderTela();
    // itens do mock: 2 por página, total 120
    expect(await screen.findByText(/Mostrando 1–2 de 120/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    const primeira = chamadasIndicadores()[0][1] as { params: Record<string, unknown> };
    expect(primeira.params.page).toBe(1);
    expect(primeira.params.pageSize).toBe(50);

    await userEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await vi.waitFor(() => {
      const ultima = chamadasIndicadores().at(-1)![1] as { params: Record<string, unknown> };
      expect(ultima.params.page).toBe(2);
    });
    expect(await screen.findByText(/Mostrando 51–52 de 120/)).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText(/apresentação/i), "Perfil");
    await vi.waitFor(() => {
      const ultima = chamadasIndicadores().at(-1)![1] as { params: Record<string, unknown> };
      expect(ultima.params.apresentacao).toBe("Perfil");
      expect(ultima.params.page).toBe(1);
    });
  });

  it("só consulta a busca depois de parar de digitar", async () => {
    renderTela();
    await screen.findByText("Cobertura vacinal");
    const antes = chamadasIndicadores().length;

    await userEvent.type(screen.getByLabelText(/buscar por nome/i), "vac");
    expect(chamadasIndicadores().length).toBe(antes);

    await vi.waitFor(() => {
      const ultima = chamadasIndicadores().at(-1)![1] as { params: Record<string, unknown> };
      expect(ultima.params.q).toBe("vac");
    });
    expect(chamadasIndicadores().length).toBe(antes + 1);
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
