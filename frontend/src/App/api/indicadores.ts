import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { api } from "../lib/axios.js";

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
  contadores: Record<StatusIndicador, number>;
}

export function useIndicadores(filtros: FiltrosIndicadores) {
  return useQuery<ListaIndicadores>({
    queryKey: ["indicadores", filtros],
    queryFn: async () => {
      const { data } = await api.get<ListaIndicadores>("/indicadores", { params: filtros });
      return { itens: data.itens, total: data.total, contadores: data.contadores };
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
