import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeModeProvider } from "../../App/theme/ThemeModeContext.js";
import { CartaoIndicador, coresFaixas } from "./CartaoIndicador.js";
import type { Indicador } from "../../App/api/indicadores.js";
import type { ResultadoComRecorte } from "../../App/lib/resultadoIndicador.js";

// jsdom não tem ResizeObserver (exigido pelo Chart.js): troca a rosca por um stub que expõe os dados.
vi.mock("../charts/DonutInterativo.js", () => ({
  DonutInterativo: (p: { semCard?: boolean; labels: string[]; data: number[] }) => (
    <div data-testid="rosca" data-labels={p.labels.join("|")} data-data={p.data.join("|")} data-semcard={String(p.semCard)}/>
  ),
}));

function indicador(extra: Partial<Indicador> = {}): Indicador {
  return {
    id: "i1", codigo: "IND-1", nome: "Cobertura vacinal", tipo: "PROPORCAO", status: "ATIVO",
    motivoIncompleto: null, pesquisaId: "p1", config: null, recorte: null, recorteConfig: null,
    apresentacao: ["Escopo"], categoria: null, objetivo: null, meta: null, casasDecimais: 1, idsPlanilha: [], dadosPlanilha: null,
    ...extra,
  };
}

function renderCartao(ind: Indicador, resultado: ResultadoComRecorte | undefined, podeRevisar = false) {
  return render(
    <ThemeModeProvider>
      <MemoryRouter>
        <CartaoIndicador indicador={ind} resultado={resultado} podeRevisar={podeRevisar} />
      </MemoryRouter>
    </ThemeModeProvider>,
  );
}

describe("CartaoIndicador", () => {
  it("número com nome, código, legenda e meta", () => {
    renderCartao(indicador({ tipo: "ZSCORE", meta: 0 }), { status: "OK", valor: -0.35 });
    expect(screen.getByText("Cobertura vacinal")).toBeInTheDocument();
    expect(screen.getByText("IND-1")).toBeInTheDocument();
    expect(screen.getByText("−0,35")).toBeInTheDocument();
    expect(screen.getByText("abaixo da média do estado")).toBeInTheDocument();
    expect(screen.getByText(/meta 0,00/)).toBeInTheDocument();
    expect(screen.getByText(/não atingida/)).toBeInTheDocument();
  });

  it("meta atingida", () => {
    renderCartao(indicador({ meta: 70 }), { status: "OK", valor: 75 });
    expect(screen.getByText("75,0%")).toBeInTheDocument();
    expect(screen.getByText(/meta 70,0% — atingida/)).toBeInTheDocument();
  });

  it("faixas mostram cada rótulo e percentual", () => {
    renderCartao(indicador(), {
      status: "OK_FAIXAS",
      faixas: [{ rotulo: "Baixo", percentual: 20 }, { rotulo: "Médio", percentual: 50.5 }, { rotulo: "Alto", percentual: 29.5 }],
    });
    expect(screen.getByText("Baixo")).toBeInTheDocument();
    expect(screen.getByText("50,5%")).toBeInTheDocument();
    expect(screen.getByLabelText("Alto 29,5%")).toBeInTheDocument();
  });

  it("distribuição com 3 itens renderiza a rosca", () => {
    renderCartao(indicador(), {
      status: "OK_DISTRIBUICAO",
      itens: [
        { opcao: "Sim", contagem: 5, percentual: 50 },
        { opcao: "Não", contagem: 3, percentual: 30 },
        { opcao: "Talvez", contagem: 2, percentual: 20 },
      ],
    });
    const rosca = screen.getByTestId("rosca");
    expect(rosca).toHaveAttribute("data-labels", "Sim|Não|Talvez");
    expect(rosca).toHaveAttribute("data-data", "50|30|20");
    expect(rosca).toHaveAttribute("data-semcard", "true");
  });

  it("distribuição com muitos itens usa barras com rótulos", () => {
    const itens = Array.from({ length: 8 }, (_, i) => ({ opcao: `Opção ${i + 1}`, contagem: 1, percentual: 12.5 }));
    renderCartao(indicador(), { status: "OK_DISTRIBUICAO", itens });
    expect(screen.getByText("Opção 8")).toBeInTheDocument();
    expect(screen.getAllByText("12,5%")).toHaveLength(8);
  });

  it("sem dados mostra o texto, sem número", () => {
    renderCartao(indicador(), { status: "SEM_DADOS" });
    expect(screen.getByText("Sem respostas aprovadas neste recorte")).toBeInTheDocument();
    expect(screen.queryByText(/^0/)).toBeNull();
  });

  it("incompleto mostra o motivo e o link só com podeRevisar", () => {
    const res: ResultadoComRecorte = { status: "INCOMPLETO", motivo: "pergunta não encontrada" };
    const { unmount } = renderCartao(indicador(), res, false);
    expect(screen.getByText(/Não calculável — pergunta não encontrada/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Revisar indicador" })).toBeNull();
    unmount();

    renderCartao(indicador(), res, true);
    expect(screen.getByRole("link", { name: "Revisar indicador" })).toHaveAttribute("href", "/indicadores/i1");
  });

  it("pareado mostra Antes, Após e a diferença", () => {
    renderCartao(indicador(), { antes: { status: "OK", valor: 40 }, apos: { status: "OK", valor: 55 } });
    expect(screen.getByText("Antes do Cartão CRIA")).toBeInTheDocument();
    expect(screen.getByText("Após o Cartão CRIA")).toBeInTheDocument();
    expect(screen.getByText("40,0%")).toBeInTheDocument();
    expect(screen.getByText("55,0%")).toBeInTheDocument();
    expect(screen.getByTestId("diferenca")).toHaveTextContent("+15,0 p.p.");
  });

  it("pareado com um lado sem dados mostra os dois lados e nenhuma diferença", () => {
    renderCartao(indicador(), { antes: { status: "SEM_DADOS" }, apos: { status: "OK", valor: 55 } });
    expect(screen.getByText("Sem respostas aprovadas neste recorte")).toBeInTheDocument();
    expect(screen.getByText("55,0%")).toBeInTheDocument();
    expect(screen.queryByTestId("diferenca")).toBeNull();
  });

  it("tooltip do objetivo no ícone de informação", () => {
    renderCartao(indicador({ objetivo: "Medir a cobertura" }), { status: "SEM_DADOS" });
    expect(screen.getByTitle("Medir a cobertura")).toBeInTheDocument();
  });

  it("as 4 primeiras cores de faixa são distintas em cada tema", () => {
    for (const modo of ["claro", "escuro"] as const) {
      const cores = coresFaixas(modo).slice(0, 4);
      expect(new Set(cores).size).toBe(4);
    }
  });
});
