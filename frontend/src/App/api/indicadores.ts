import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { api } from "../lib/axios.js";
import type { ResultadoComRecorte } from "../lib/resultadoIndicador.js";

export type StatusIndicador = "ATIVO" | "DEFINICAO_INCOMPLETA" | "INATIVO";

export interface Indicador {
  id: string;
  codigo: string;
  nome: string;
  tipo: string;
  status: StatusIndicador;
  motivoIncompleto: string | null;
  pesquisaId: string | null;
  config: unknown;
  recorte: "ANTES_APOS" | null;
  recorteConfig: { substituicoes: Array<{ de: string; para: string }> } | null;
  apresentacao: string[];
  categoria: string | null;
  meta: number | null;
  casasDecimais: number;
  idsPlanilha: string[];
  dadosPlanilha: Record<string, string> | null;
}

export interface FiltrosIndicadores {
  status?: StatusIndicador;
  pesquisaId?: string;
  apresentacao?: "Escopo" | "Perfil";
  q?: string;
}

export interface ListaIndicadores {
  itens: Indicador[];
  total: number;
  page: number;
  pageSize: number;
  contadores: Record<StatusIndicador, number>;
}

export const TAMANHO_PAGINA = 50;

export function useIndicadores(filtros: FiltrosIndicadores, pagina = 1) {
  return useQuery<ListaIndicadores>({
    queryKey: ["indicadores", filtros, pagina],
    queryFn: async () => {
      const { data } = await api.get<ListaIndicadores>("/indicadores", {
        params: { ...filtros, page: pagina, pageSize: TAMANHO_PAGINA },
      });
      return {
        itens: data.itens,
        total: data.total,
        page: data.page,
        pageSize: data.pageSize,
        contadores: data.contadores,
      };
    },
  });
}

export function useIndicador(id: string | undefined) {
  return useQuery<Indicador | null>({
    queryKey: ["indicador", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data } = await api.get<{ indicador: Indicador | null }>(`/indicadores/${id}`);
      return data.indicador ?? null;
    },
  });
}

export function useSalvarIndicador(id: string) {
  const qc = useQueryClient();
  return useMutation<Indicador, AxiosError, Partial<Indicador>>({
    mutationFn: async (dados) => {
      const { data } = await api.put<{ indicador: Indicador }>(`/indicadores/${id}`, dados);
      return data.indicador;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["indicadores"] });
      qc.invalidateQueries({ queryKey: ["indicador", id] });
    },
  });
}

export interface FiltrosPainel {
  pesquisaId?: string;
  municipio?: string;
  regional?: string;
  sexo?: string;
  de?: string;
  ate?: string;
}

/** Todos os indicadores ativos (uma página grande; o painel agrupa no cliente). */
export function useIndicadoresAtivos() {
  return useQuery<Indicador[]>({
    queryKey: ["indicadores-ativos"],
    queryFn: async () => {
      const { data } = await api.get<ListaIndicadores>("/indicadores", {
        params: { status: "ATIVO", pageSize: 200 },
      });
      return data.itens;
    },
  });
}

/** Resultado de todos os indicadores por código; só envia os filtros preenchidos. */
export function useCalculoPainel(filtros: FiltrosPainel) {
  const params: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(filtros)) {
    if (valor) params[chave] = valor;
  }
  return useQuery<Record<string, ResultadoComRecorte>>({
    queryKey: ["indicadores-calculo-painel", params],
    queryFn: async () => {
      const { data } = await api.get<{ resultados: Record<string, ResultadoComRecorte> }>("/indicadores/calculo", { params });
      return data.resultados ?? {};
    },
  });
}

export function useRegionais() {
  return useQuery<string[]>({
    queryKey: ["regionais"],
    staleTime: Infinity,
    queryFn: async () => {
      const { data } = await api.get<{ regionais: string[] }>("/regionais");
      return data.regionais;
    },
  });
}

export function useCalculoIndicador(codigo: string | undefined, pesquisaId: string | undefined) {
  return useQuery<unknown>({
    queryKey: ["indicador-calculo", codigo, pesquisaId],
    enabled: Boolean(codigo && pesquisaId),
    queryFn: async () => {
      const { data } = await api.get<{ resultados: Record<string, unknown> }>("/indicadores/calculo", {
        params: { pesquisaId },
      });
      return data.resultados?.[codigo as string] ?? null;
    },
  });
}
