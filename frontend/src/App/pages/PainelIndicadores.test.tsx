import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { PainelIndicadores } from "./PainelIndicadores.js";
import { AuthProvider } from "../auth/AuthContext.js";
import { ThemeModeProvider } from "../theme/ThemeModeContext.js";
import { queryClient } from "../lib/queryClient.js";
import { api } from "../lib/axios.js";

const getSpy = vi.spyOn(api, "get");

const base = {
  tipo: "PROPORCAO", status: "ATIVO", motivoIncompleto: null, config: null, recorte: null, recorteConfig: null,
  categoria: null, objetivo: null, meta: null, casasDecimais: 1, idsPlanilha: [], dadosPlanilha: null,
};
const ITENS = [
  { ...base, id: "i1", codigo: "IND-1", nome: "Cobertura vacinal", pesquisaId: "p1", apresentacao: ["Escopo", "Perfil"] },
  { ...base, id: "i2", codigo: "IND-2", nome: "Sem apresentação", pesquisaId: null, apresentacao: [] },
];

let ativos: unknown[] = ITENS;
let calculo: () => Promise<unknown>;

beforeEach(() => {
  localStorage.clear();
  queryClient.clear();
  getSpy.mockReset();
  ativos = ITENS;
  calculo = async () => ({ data: { resultados: {} } });
  localStorage.setItem("token", "t");
  localStorage.setItem(
    "usuario",
    JSON.stringify({ id: "1", nome: "Ana", email: "ana@exemplo.local", papel: "VISUALIZADOR", precisaTrocarSenha: false }),
  );
  getSpy.mockImplementation((async (url: string) => {
    if (url === "/pesquisas") return { data: { itens: [{ id: "p1", titulo: "Criança", status: "PUBLICADA" }] } };
    if (url === "/regionais") return { data: { regionais: ["1ª Regional"] } };
    if (url === "/indicadores/calculo") return calculo();
    if (url === "/indicadores") return { data: { itens: ativos, total: ativos.length, page: 1, pageSize: 200, contadores: {} } };
    throw new Error(`url inesperada ${url}`);
  }) as never);
});

function renderTela() {
  return render(
    <ThemeModeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter>
            <PainelIndicadores />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeModeProvider>,
  );
}

const paramsCalculo = () =>
  getSpy.mock.calls.filter((c) => c[0] === "/indicadores/calculo").map((c) => (c[1] as { params: Record<string, string> }).params);

describe("PainelIndicadores", () => {
  it("indicador sem apresentacao aparece em Escopo; Perfil mostra só o que tem Perfil", async () => {
    renderTela();
    expect(await screen.findByText("Cobertura vacinal")).toBeInTheDocument();
    expect(screen.getByText("Sem apresentação")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Criança" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ambas as pesquisas" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Perfil" }));
    expect(screen.getByText("Cobertura vacinal")).toBeInTheDocument();
    expect(screen.queryByText("Sem apresentação")).not.toBeInTheDocument();
  });

  it("filtros refazem o cálculo e só enviam parâmetros preenchidos", async () => {
    renderTela();
    await screen.findByText("Cobertura vacinal");
    expect(paramsCalculo()[0]).toEqual({});

    await userEvent.selectOptions(screen.getByLabelText("Município"), "Maceió");
    await waitFor(() => expect(paramsCalculo().some((p) => p.municipio === "Maceió")).toBe(true));

    fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-01-01" } });
    await waitFor(() => expect(paramsCalculo().some((p) => p.de === "2026-01-01")).toBe(true));
    const ultimo = paramsCalculo().at(-1)!;
    expect(ultimo.de).toBe("2026-01-01");
    expect("ate" in ultimo).toBe(false);
  });

  it("erro 409 do cálculo mostra a mensagem da API e mantém as abas", async () => {
    calculo = async () => {
      throw {
        isAxiosError: true,
        response: { status: 409, data: { error: { code: "DEPENDENCIA_CIRCULAR", message: "dependência circular entre indicadores: a → b → a" } } },
      };
    };
    renderTela();
    expect(await screen.findByText(/dependência circular entre indicadores: a → b → a/, undefined, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Escopo" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Perfil" })).toBeInTheDocument();
  });

  it("sem indicadores ativos mostra a mensagem de vazio", async () => {
    ativos = [];
    renderTela();
    expect(await screen.findByText(/Nenhum indicador ativo ainda/)).toBeInTheDocument();
  });
});
