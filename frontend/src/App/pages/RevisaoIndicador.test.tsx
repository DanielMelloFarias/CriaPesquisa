import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RevisaoIndicador } from "./RevisaoIndicador.js";
import { AuthProvider } from "../auth/AuthContext.js";
import { ThemeModeProvider } from "../theme/ThemeModeContext.js";
import { queryClient } from "../lib/queryClient.js";
import { api } from "../lib/axios.js";
import type { Indicador } from "../api/indicadores.js";

const getSpy = vi.spyOn(api, "get");
const putSpy = vi.spyOn(api, "put");

const PESQUISA = {
  id: "p1",
  titulo: "Cartão CRIA — Criança",
  descricao: null,
  status: "PUBLICADA",
  periodoInicio: null,
  periodoFim: null,
  perguntas: [
    {
      id: "q1", enunciado: "Vacina em dia?", tipo: "ESCOLHA_UNICA", obrigatoria: true, ordem: 1,
      opcoes: [{ id: "o1", texto: "Sim", ordem: 1 }, { id: "o2", texto: "Não", ordem: 2 }],
    },
    { id: "q2", enunciado: "Peso (kg)", tipo: "NUMERO", obrigatoria: false, ordem: 2, opcoes: [] },
    {
      id: "q3", enunciado: "Vacina em dia depois do programa?", tipo: "ESCOLHA_UNICA", obrigatoria: false, ordem: 3,
      opcoes: [{ id: "o3", texto: "Sim", ordem: 1 }, { id: "o4", texto: "Não", ordem: 2 }],
    },
  ],
};

function indicadorBase(extra: Partial<Indicador> = {}): Indicador {
  return {
    id: "i1",
    codigo: "IND-1",
    nome: "Cobertura vacinal",
    tipo: "PROPORCAO",
    status: "DEFINICAO_INCOMPLETA",
    motivoIncompleto: "conferir as opções do numerador",
    pesquisaId: "p1",
    config: { tipo: "PROPORCAO", perguntaId: "q1", opcoesNumerador: [] },
    recorte: null,
    recorteConfig: null,
    apresentacao: ["Escopo"],
    categoria: "Saúde",
    meta: null,
    casasDecimais: 1,
    idsPlanilha: ["CRIA-C-12"],
    dadosPlanilha: {
      nome: "Cobertura vacinal (planilha)",
      formulaCalculo: "(vacinadas / total) * 100",
      formulaDescritiva: "Percentual de crianças com vacina em dia",
      perguntaDescricao: "Vacina em dia?",
      objetivo: "Acompanhar a vacinação",
      observacoes: "",
      categoria: "Saúde",
    },
    ...extra,
  };
}

let indicador: Indicador;
let calculo: unknown;

beforeEach(() => {
  localStorage.clear();
  queryClient.clear();
  getSpy.mockReset();
  putSpy.mockReset();
  localStorage.setItem("token", "t");
  localStorage.setItem(
    "usuario",
    JSON.stringify({ id: "1", nome: "Ana", email: "ana@exemplo.local", papel: "GESTOR", precisaTrocarSenha: false }),
  );
  indicador = indicadorBase();
  calculo = { status: "SEM_DADOS" };
  getSpy.mockImplementation((async (url: string) => {
    if (url === "/indicadores/calculo") return { data: { resultados: { "IND-1": calculo }, cache: false } };
    if (url === "/indicadores/i1") return { data: { indicador } };
    if (url === "/pesquisas/p1") return { data: { pesquisa: PESQUISA } };
    throw new Error(`GET inesperado: ${url}`);
  }) as never);
});

function renderTela() {
  return render(
    <ThemeModeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/indicadores/i1"]}>
            <Routes>
              <Route path="/indicadores/:id" element={<RevisaoIndicador />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeModeProvider>,
  );
}

describe("RevisaoIndicador", () => {
  it("mostra o texto da planilha e o motivo da revisão", async () => {
    renderTela();

    expect(await screen.findByText("Cobertura vacinal (planilha)")).toBeInTheDocument();
    expect(screen.getByText("(vacinadas / total) * 100")).toBeInTheDocument();
    expect(screen.getByText("Acompanhar a vacinação")).toBeInTheDocument();
    expect(screen.getByText(/CRIA-C-12/)).toBeInTheDocument();
    expect(screen.getByText(/conferir as opções do numerador/)).toBeInTheDocument();
  });

  it("PROPORCAO: marcar 'Sim' e ativar envia opcoesNumerador e status ATIVO", async () => {
    putSpy.mockResolvedValueOnce({ data: { indicador: { ...indicador, status: "ATIVO" } } } as never);
    renderTela();

    await userEvent.click(await screen.findByLabelText("Sim"));
    await userEvent.click(screen.getByRole("button", { name: "Ativar" }));

    await vi.waitFor(() => expect(putSpy).toHaveBeenCalled());
    const [url, corpo] = putSpy.mock.calls[0] as [string, Record<string, unknown>];
    expect(url).toBe("/indicadores/i1");
    expect(corpo.status).toBe("ATIVO");
    expect((corpo.config as { opcoesNumerador: string[] }).opcoesNumerador).toEqual(["Sim"]);
    expect((corpo.config as { perguntaId: string }).perguntaId).toBe("q1");
    expect(await screen.findByText("Ativado")).toBeInTheDocument();
  });

  it("ativar com config incompleta mostra o erro da API e o indicador continua para revisar", async () => {
    putSpy.mockRejectedValueOnce({
      response: {
        status: 422,
        data: {
          error: {
            code: "PERGUNTA_INCOMPATIVEL",
            message: "Configuração não confere com as perguntas",
            details: { problemas: ['opção "Não" sem nota'] },
          },
        },
      },
    });
    renderTela();
    await screen.findByText("Cobertura vacinal (planilha)");

    await userEvent.click(screen.getByRole("button", { name: "Ativar" }));

    expect(await screen.findByText("Configuração não confere com as perguntas")).toBeInTheDocument();
    expect(screen.getByText('opção "Não" sem nota')).toBeInTheDocument();
    expect(screen.getByText("Para revisar")).toBeInTheDocument();
    expect(screen.queryByText("Ativado")).not.toBeInTheDocument();
  });

  it("lista os fieldErrors de uma recusa de validação", async () => {
    putSpy.mockRejectedValueOnce({
      response: {
        status: 422,
        data: {
          error: {
            code: "VALIDACAO",
            message: "Dados inválidos",
            details: { formErrors: [], fieldErrors: { meta: ["Expected number"] } },
          },
        },
      },
    });
    renderTela();
    await screen.findByText("Cobertura vacinal (planilha)");

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Dados inválidos")).toBeInTheDocument();
    expect(screen.getByText("meta: Expected number")).toBeInTheDocument();
  });

  it("JSON inválido no editor de config desabilita Salvar", async () => {
    indicador = indicadorBase({
      tipo: "CLASSIFICACAO",
      config: { tipo: "CLASSIFICACAO", indicadorId: "x", faixas: [] },
    });
    renderTela();

    const editor = await screen.findByLabelText(/configuração \(json\)/i);
    expect(screen.getByRole("button", { name: "Salvar" })).toBeEnabled();
    await userEvent.clear(editor);
    await userEvent.type(editor, "nada");

    expect(screen.getByText("JSON inválido")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  });

  it("indicador ATIVO mostra o resultado atual com %", async () => {
    indicador = indicadorBase({
      status: "ATIVO",
      motivoIncompleto: null,
      config: { tipo: "PROPORCAO", perguntaId: "q1", opcoesNumerador: ["Sim"] },
    });
    calculo = { status: "OK", valor: 62.5 };
    renderTela();

    expect(await screen.findByText("62.5%")).toBeInTheDocument();
    const chamada = getSpy.mock.calls.find((c) => c[0] === "/indicadores/calculo")!;
    expect((chamada[1] as { params: Record<string, unknown> }).params.pesquisaId).toBe("p1");
  });

  it("indicador ATIVO com recorte mostra antes e depois lado a lado", async () => {
    indicador = indicadorBase({
      status: "ATIVO",
      motivoIncompleto: null,
      config: { tipo: "PROPORCAO", perguntaId: "q1", opcoesNumerador: ["Sim"] },
      recorte: "ANTES_APOS",
      recorteConfig: { substituicoes: [{ de: "q1", para: "q2" }] },
    });
    calculo = { antes: { status: "OK", valor: 40 }, apos: { status: "SEM_DADOS" } };
    renderTela();

    expect(await screen.findByText("40%")).toBeInTheDocument();
    expect(screen.getByText("Antes")).toBeInTheDocument();
    expect(screen.getByText("Depois")).toBeInTheDocument();
    expect(screen.getByText("Sem respostas aprovadas ainda")).toBeInTheDocument();
  });

  it("ESCALA: nota e 'fora do cálculo' viram notas da config", async () => {
    indicador = indicadorBase({ tipo: "ESCALA", config: { tipo: "ESCALA", perguntaId: "q1", notas: {} } });
    putSpy.mockResolvedValueOnce({ data: { indicador } } as never);
    renderTela();

    await userEvent.type(await screen.findByLabelText("Nota de Sim"), "100");
    await userEvent.click(screen.getByLabelText("Não fora do cálculo"));
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await vi.waitFor(() => expect(putSpy).toHaveBeenCalled());
    const corpo = putSpy.mock.calls[0][1] as Record<string, unknown>;
    expect(corpo.config).toEqual({ tipo: "ESCALA", perguntaId: "q1", notas: { Sim: 100, "Não": null } });
    expect(corpo.status).toBeUndefined();
    expect(await screen.findByText("Salvo")).toBeInTheDocument();
  });

  it("meta vazia envia meta: null", async () => {
    indicador = indicadorBase({ meta: 80 });
    putSpy.mockResolvedValueOnce({ data: { indicador } } as never);
    renderTela();

    await userEvent.clear(await screen.findByLabelText(/meta/i));
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await vi.waitFor(() => expect(putSpy).toHaveBeenCalled());
    expect((putSpy.mock.calls[0][1] as Record<string, unknown>).meta).toBeNull();
  });

  it("recorte gravado aparece ligado e desligar envia recorte e recorteConfig null", async () => {
    indicador = indicadorBase({ recorte: "ANTES_APOS", recorteConfig: { substituicoes: [{ de: "q1", para: "q3" }] } });
    putSpy.mockResolvedValueOnce({ data: { indicador } } as never);
    renderTela();

    const caixa = await screen.findByLabelText(/comparar antes e depois/i);
    expect(caixa).toBeChecked();
    expect(screen.getByLabelText(/pergunta do depois/i)).toHaveValue("q3");
    await userEvent.click(caixa);
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await vi.waitFor(() => expect(putSpy).toHaveBeenCalled());
    const corpo = putSpy.mock.calls[0][1] as Record<string, unknown>;
    expect(corpo.recorte).toBeNull();
    expect(corpo.recorteConfig).toBeNull();
  });

  it("tipo de JSON com recorte gravado: desligar envia null", async () => {
    indicador = indicadorBase({
      tipo: "CLASSIFICACAO",
      config: { tipo: "CLASSIFICACAO", indicadorId: "x", faixas: [] },
      recorte: "ANTES_APOS",
      recorteConfig: { substituicoes: [{ de: "q1", para: "q3" }] },
    });
    putSpy.mockResolvedValueOnce({ data: { indicador } } as never);
    renderTela();

    await userEvent.click(await screen.findByLabelText(/comparar antes e depois/i));
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await vi.waitFor(() => expect(putSpy).toHaveBeenCalled());
    const corpo = putSpy.mock.calls[0][1] as Record<string, unknown>;
    expect(corpo.recorte).toBeNull();
    expect(corpo.recorteConfig).toBeNull();
  });

  it("trocar a pergunta do ANTES zera a pergunta do APÓS", async () => {
    indicador = indicadorBase({ recorte: "ANTES_APOS", recorteConfig: { substituicoes: [{ de: "q1", para: "q3" }] } });
    renderTela();

    await userEvent.selectOptions(await screen.findByLabelText(/^pergunta$/i), "q3");

    expect(screen.getByLabelText(/pergunta do depois/i)).toHaveValue("");
    expect(screen.getByText("Escolha a pergunta do depois.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  });

  it("enquanto as perguntas carregam não mostra o editor JSON e não deixa salvar", async () => {
    getSpy.mockImplementation((async (url: string) => {
      if (url === "/indicadores/i1") return { data: { indicador } };
      return new Promise(() => {}); // perguntas nunca chegam
    }) as never);
    renderTela();

    expect(await screen.findByText("Carregando perguntas…")).toBeInTheDocument();
    expect(screen.queryByLabelText(/configuração \(json\)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sem pesquisa vinculada/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ativar" })).toBeDisabled();
  });

  it("ESCALA: nota fora de 0–100 mostra aviso e bloqueia Salvar", async () => {
    indicador = indicadorBase({ tipo: "ESCALA", config: { tipo: "ESCALA", perguntaId: "q1", notas: {} } });
    renderTela();

    await userEvent.type(await screen.findByLabelText("Nota de Sim"), "150");

    expect(screen.getByText("As notas precisam ficar entre 0 e 100.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  });

  it("ligar 'Comparar antes e depois' envia recorte e substituição", async () => {
    putSpy.mockResolvedValueOnce({ data: { indicador } } as never);
    renderTela();

    await userEvent.click(await screen.findByLabelText(/comparar antes e depois/i));
    await userEvent.selectOptions(screen.getByLabelText(/pergunta do depois/i), "q3");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await vi.waitFor(() => expect(putSpy).toHaveBeenCalled());
    const corpo = putSpy.mock.calls[0][1] as Record<string, unknown>;
    expect(corpo.recorte).toBe("ANTES_APOS");
    expect(corpo.recorteConfig).toEqual({ substituicoes: [{ de: "q1", para: "q3" }] });
  });
});
