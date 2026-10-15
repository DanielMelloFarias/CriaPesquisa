import { useState } from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { BarChart3 } from "lucide-react";
import type { AxiosError } from "axios";
import { useIndicadoresAtivos, useCalculoPainel, useRegionais, type FiltrosPainel, type Indicador } from "../api/indicadores.js";
import { usePesquisas } from "../api/pesquisas.js";
import { MUNICIPIOS_AL } from "../data/pesquisaCrianca.js";
import { useAuth } from "../auth/useAuth.js";
import { podeGerenciarPesquisas } from "../auth/permissoes.js";
import { CartaoIndicador } from "../../Components/indicadores/CartaoIndicador.js";
import {
  PageHeader,
  PageTitle,
  PageSubtitle,
  Muted,
  Banner,
  EmptyState,
  EmptyIcon,
  SectionTitle,
  Field,
  Label,
  Select,
  TextInput,
  Button,
} from "../../Styles/ui.js";

type Aba = "Escopo" | "Perfil";

const Filtros = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px;
  margin-bottom: 8px;
  > div {
    min-width: 150px;
    flex: 1;
    margin-bottom: 8px;
  }
`;

const Abas = styled.div`
  display: flex;
  gap: 6px;
  margin: 8px 0 20px;
  border-bottom: 1px solid ${(p) => p.theme.cores.border};
`;

const AbaBotao = styled.button<{ $ativa: boolean }>`
  background: none;
  border: none;
  cursor: pointer;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 600;
  color: ${(p) => (p.$ativa ? p.theme.cores.primaryDark : p.theme.cores.textMuted)};
  border-bottom: 3px solid ${(p) => (p.$ativa ? p.theme.cores.accent : "transparent")};
  margin-bottom: -1px;
`;

const Grade = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  margin-bottom: 28px;
  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const FILTROS_VAZIOS = { pesquisaId: "", municipio: "", regional: "", sexo: "", de: "", ate: "" };

function mensagemDeErro(erro: unknown): string {
  const e = erro as AxiosError<{ error?: { message?: string } }> | null;
  return e?.response?.data?.error?.message ?? "Não foi possível calcular os indicadores. Tente novamente.";
}

/** Criança, Gestante e depois qualquer outra; "Ambas" (sem pesquisa) por último. */
function ordemDaPesquisa(titulo: string): number {
  const t = titulo.toLowerCase();
  if (t.includes("crian")) return 0;
  if (t.includes("gestante")) return 1;
  return 2;
}

export function PainelIndicadores() {
  const { usuario } = useAuth();
  const podeRevisar = podeGerenciarPesquisas(usuario?.papel);
  const [aba, setAba] = useState<Aba>("Escopo");
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const muda = (campo: keyof typeof FILTROS_VAZIOS) => (valor: string) => setFiltros((f) => ({ ...f, [campo]: valor }));

  const ativos = useIndicadoresAtivos();
  const calculo = useCalculoPainel(paramsPreenchidos(filtros));
  const { data: pesquisas } = usePesquisas();
  const { data: regionais } = useRegionais();

  const titulos = new Map((pesquisas?.itens ?? []).map((p) => [p.id, p.titulo]));

  const daAba = (ativos.data ?? [])
    .filter((i) => (i.apresentacao.length === 0 ? aba === "Escopo" : i.apresentacao.includes(aba)))
    // Filtro de pesquisa: só a seção dela e a de "Ambas as pesquisas".
    .filter((i) => !filtros.pesquisaId || i.pesquisaId === null || i.pesquisaId === filtros.pesquisaId);
  const porPesquisa = new Map<string | null, Indicador[]>();
  for (const i of daAba) {
    const lista = porPesquisa.get(i.pesquisaId) ?? [];
    lista.push(i);
    porPesquisa.set(i.pesquisaId, lista);
  }
  const secoes = [...porPesquisa.entries()]
    .map(([id, itens]) => ({
      id,
      titulo: id === null ? "Ambas as pesquisas" : (titulos.get(id) ?? "Pesquisa"),
      itens: [...itens].sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true })),
    }))
    .sort((a, b) => {
      const ra = a.id === null ? 9 : ordemDaPesquisa(a.titulo);
      const rb = b.id === null ? 9 : ordemDaPesquisa(b.titulo);
      return ra - rb || a.titulo.localeCompare(b.titulo, "pt-BR");
    });

  const cabecalho = (
    <PageHeader>
      <div>
        <PageTitle>Painel de indicadores</PageTitle>
        <PageSubtitle>Cartão CRIA — indicadores ativos</PageSubtitle>
      </div>
    </PageHeader>
  );

  if (ativos.isLoading) {
    return (
      <>
        {cabecalho}
        <Muted>Carregando…</Muted>
      </>
    );
  }

  if (ativos.isError) {
    return (
      <>
        {cabecalho}
        <Banner $tone="warn">Não foi possível carregar os indicadores. Verifique se o servidor está no ar.</Banner>
      </>
    );
  }

  if ((ativos.data ?? []).length === 0) {
    return (
      <>
        {cabecalho}
        <EmptyState>
          <EmptyIcon>
            <BarChart3 size={28} />
          </EmptyIcon>
          <SectionTitle>Nenhum indicador ativo ainda</SectionTitle>
          <Muted>Os indicadores aparecem aqui depois de revisados e ativados.</Muted>
          {podeRevisar && (
            <p style={{ marginTop: 12 }}>
              <Link to="/indicadores">Revisar indicadores</Link>
            </p>
          )}
        </EmptyState>
      </>
    );
  }

  return (
    <>
      {cabecalho}
      <Filtros>
        <Field>
          <Label htmlFor="pn-pesquisa">Pesquisa</Label>
          <Select id="pn-pesquisa" value={filtros.pesquisaId} onChange={(e) => muda("pesquisaId")(e.target.value)}>
            <option value="">Todas</option>
            {pesquisas?.itens.map((p) => (
              <option key={p.id} value={p.id}>
                {p.titulo}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label htmlFor="pn-municipio">Município</Label>
          <Select id="pn-municipio" value={filtros.municipio} onChange={(e) => muda("municipio")(e.target.value)}>
            <option value="">Todos</option>
            {MUNICIPIOS_AL.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label htmlFor="pn-regional">Regional</Label>
          <Select id="pn-regional" value={filtros.regional} onChange={(e) => muda("regional")(e.target.value)}>
            <option value="">Todas</option>
            {regionais?.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label htmlFor="pn-sexo">Sexo</Label>
          <Select id="pn-sexo" value={filtros.sexo} onChange={(e) => muda("sexo")(e.target.value)}>
            <option value="">Todos</option>
            <option value="Masculino">Masculino</option>
            <option value="Feminino">Feminino</option>
          </Select>
        </Field>
        <Field>
          <Label htmlFor="pn-de">De</Label>
          <TextInput id="pn-de" type="date" value={filtros.de} onChange={(e) => muda("de")(e.target.value)} />
        </Field>
        <Field>
          <Label htmlFor="pn-ate">Até</Label>
          <TextInput id="pn-ate" type="date" value={filtros.ate} onChange={(e) => muda("ate")(e.target.value)} />
        </Field>
        <Field style={{ flex: "0 0 auto", minWidth: 0 }}>
          <Button type="button" $variant="ghost" onClick={() => setFiltros(FILTROS_VAZIOS)}>
            Limpar filtros
          </Button>
        </Field>
      </Filtros>

      <Abas role="tablist">
        {(["Escopo", "Perfil"] as const).map((a) => (
          <AbaBotao key={a} type="button" role="tab" aria-selected={aba === a} $ativa={aba === a} onClick={() => setAba(a)}>
            {a}
          </AbaBotao>
        ))}
      </Abas>

      {calculo.isError && <Banner $tone="warn" role="alert" style={{ marginBottom: 16 }}>{mensagemDeErro(calculo.error)}</Banner>}

      {calculo.isError ? null : calculo.isLoading ? (
        <Muted>Calculando…</Muted>
      ) : secoes.length === 0 ? (
        <Muted>Nenhum indicador nesta aba.</Muted>
      ) : (
        secoes.map((s) => (
          <section key={s.id ?? "ambas"}>
            <SectionTitle>{s.titulo}</SectionTitle>
            <Grade>
              {s.itens.map((i) => (
                <CartaoIndicador key={i.id} indicador={i} resultado={calculo.data?.[i.codigo]} podeRevisar={podeRevisar} />
              ))}
            </Grade>
          </section>
        ))
      )}
    </>
  );
}

function paramsPreenchidos(f: typeof FILTROS_VAZIOS): FiltrosPainel {
  const p: FiltrosPainel = {};
  for (const [k, v] of Object.entries(f)) if (v) p[k as keyof FiltrosPainel] = v;
  return p;
}
