import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import styled from "styled-components";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useIndicador, useSalvarIndicador, type Indicador, type StatusIndicador } from "../api/indicadores.js";
import { usePesquisaBruta } from "../api/pesquisas.js";
import {
  PageHeader,
  PageTitle,
  PageSubtitle,
  Card,
  SectionTitle,
  Field,
  Label,
  TextInput,
  Select,
  Checkbox,
  Button,
  Banner,
  Tag,
  Muted,
} from "../../Styles/ui.js";
import {
  TIPOS_INDICADOR,
  TIPOS_COM_FORMULARIO,
  PERGUNTAS_DO_TIPO,
  FormularioDoTipo,
  EditorJson,
  ErroLocal,
  comoObjeto,
  configDoFormulario,
  type ConfigSolta,
} from "./revisaoIndicador/ConfigPorTipo.js";
import { Recorte, type EstadoRecorte } from "./revisaoIndicador/Recorte.js";
import { DaPlanilha } from "./revisaoIndicador/DaPlanilha.js";
import { ResultadoAtual } from "./revisaoIndicador/ResultadoAtual.js";

const STATUS_LABEL: Record<StatusIndicador, string> = {
  DEFINICAO_INCOMPLETA: "Para revisar",
  ATIVO: "Ativo",
  INATIVO: "Inativo",
};
const tomDoStatus = (s: StatusIndicador): "orange" | "green" | "muted" =>
  s === "ATIVO" ? "green" : s === "INATIVO" ? "muted" : "orange";

const Colunas = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr);
  gap: 16px;
  align-items: start;
  @media (max-width: 900px) { grid-template-columns: minmax(0, 1fr); }
`;

const Linha2 = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  @media (max-width: 560px) { grid-template-columns: 1fr; }
`;

const Acoes = styled.div`
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  flex-wrap: wrap;
  margin-top: 8px;
`;

const ListaProblemas = styled.ul`
  margin: 10px 0 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.7;
  color: ${(p) => p.theme.cores.danger};
`;

const Sucesso = styled.div`
  margin-top: 10px;
  font-size: 13px;
  font-weight: 600;
  color: ${(p) => p.theme.cores.success};
  text-align: right;
`;

type Acao = "salvar" | "ativar" | "inativar";
type Retorno = { ok: string } | { erro: string; itens: string[] };

/** Lê o corpo de erro da API: `{ error: { message, details: { problemas } | { fieldErrors } } }`. */
function lerErro(err: unknown): { erro: string; itens: string[] } {
  const e = (err as { response?: { data?: { error?: { message?: string; details?: unknown } } } }).response?.data?.error;
  const details = (e?.details ?? {}) as { problemas?: unknown; fieldErrors?: Record<string, string[]>; formErrors?: unknown };
  const itens: string[] = [];
  if (Array.isArray(details.problemas)) itens.push(...details.problemas.map(String));
  if (Array.isArray(details.formErrors)) itens.push(...details.formErrors.map(String));
  if (details.fieldErrors && typeof details.fieldErrors === "object") {
    for (const [campo, msgs] of Object.entries(details.fieldErrors)) {
      for (const m of msgs ?? []) itens.push(`${campo}: ${m}`);
    }
  }
  return { erro: e?.message ?? "Não foi possível salvar. Tente novamente.", itens };
}

export function RevisaoIndicador() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: indicador, isLoading } = useIndicador(id);

  return (
    <div>
      <PageHeader>
        <div>
          <PageTitle>{indicador?.nome ?? "Indicador"}</PageTitle>
          <PageSubtitle>
            {indicador ? (
              <>
                {indicador.codigo} · <Tag $tone={tomDoStatus(indicador.status)}>{STATUS_LABEL[indicador.status]}</Tag>
              </>
            ) : (
              "Revisão do indicador"
            )}
          </PageSubtitle>
        </div>
        <Button type="button" $variant="ghost" onClick={() => navigate("/indicadores")}>
          <ArrowLeft size={16} />
          Voltar
        </Button>
      </PageHeader>
      {isLoading ? (
        <Muted>Carregando indicador…</Muted>
      ) : !indicador ? (
        <Muted>Indicador não encontrado.</Muted>
      ) : (
        <Colunas>
          <DaPlanilha indicador={indicador} />
          <div>
            <Cadastro key={indicador.id} indicador={indicador} />
            {indicador.status === "ATIVO" && <ResultadoAtual indicador={indicador} />}
          </div>
        </Colunas>
      )}
    </div>
  );
}

/** Coluna "Cadastro": o estado do formulário nasce do indicador carregado e não é sobrescrito pelos refetches. */
function Cadastro({ indicador }: { indicador: Indicador }) {
  const qc = useQueryClient();
  const salvar = useSalvarIndicador(indicador.id);
  const { data: pesquisa } = usePesquisaBruta(indicador.pesquisaId ?? undefined);

  const [nome, setNome] = useState(indicador.nome);
  const [apresentacao, setApresentacao] = useState<string[]>(indicador.apresentacao);
  const [meta, setMeta] = useState(indicador.meta === null ? "" : String(indicador.meta));
  const [tipo, setTipo] = useState(indicador.tipo);
  const [config, setConfig] = useState<ConfigSolta>(comoObjeto(indicador.config));
  const [jsonTexto, setJsonTexto] = useState(JSON.stringify(indicador.config ?? { tipo: indicador.tipo }, null, 2));
  const [recorte, setRecorte] = useState<EstadoRecorte>({ ligado: false, para: "" });
  const [retorno, setRetorno] = useState<Retorno | null>(null);

  const perguntas = pesquisa?.perguntas ?? [];
  // Sem a pesquisa (indicador sem pesquisaId) não há pergunta para escolher: cai no editor JSON.
  const usaFormulario = TIPOS_COM_FORMULARIO.has(tipo) && (tipo === "CONTAGEM" || Boolean(pesquisa));
  const perguntasCompativeis = perguntas.filter((p) => (PERGUNTAS_DO_TIPO[tipo] ?? []).includes(p.tipo));
  const lePergunta = usaFormulario && tipo in PERGUNTAS_DO_TIPO;

  const jsonParseado = useMemo(() => {
    try {
      return { ok: true as const, valor: JSON.parse(jsonTexto) as unknown };
    } catch {
      return { ok: false as const };
    }
  }, [jsonTexto]);

  const metaNumero = meta.trim() === "" ? undefined : Number(meta.replace(",", "."));
  const metaInvalida = metaNumero !== undefined && !Number.isFinite(metaNumero);
  const deRecorte = typeof config.perguntaId === "string" ? config.perguntaId : "";
  const recorteNovo = lePergunta && indicador.recorte === null && recorte.ligado;
  const recorteIncompleto = recorteNovo && !recorte.para;

  const jsonInvalido = !usaFormulario && !jsonParseado.ok;
  const bloqueado = salvar.isPending || jsonInvalido || metaInvalida || !nome.trim() || recorteIncompleto;

  function trocarTipo(novo: string) {
    const base = novo === indicador.tipo ? indicador.config : { tipo: novo };
    setTipo(novo);
    setConfig(comoObjeto(base));
    setJsonTexto(JSON.stringify(base ?? { tipo: novo }, null, 2));
  }

  function corpoEditado(): Partial<Indicador> {
    const corpo: Partial<Indicador> = {
      nome: nome.trim(),
      apresentacao,
      tipo,
      config: usaFormulario ? configDoFormulario(tipo, config) : jsonParseado.ok ? jsonParseado.valor : undefined,
    };
    // A API não aceita `meta: null`: campo vazio só não mexe na meta gravada.
    if (metaNumero !== undefined) corpo.meta = metaNumero;
    if (recorteNovo) {
      corpo.recorte = "ANTES_APOS";
      corpo.recorteConfig = { substituicoes: [{ de: deRecorte, para: recorte.para }] };
    }
    return corpo;
  }

  async function executar(acao: Acao) {
    setRetorno(null);
    const corpo: Partial<Indicador> =
      acao === "inativar" ? { status: "INATIVO" } : acao === "ativar" ? { ...corpoEditado(), status: "ATIVO" } : corpoEditado();
    try {
      await salvar.mutateAsync(corpo);
      qc.invalidateQueries({ queryKey: ["indicador-calculo"] });
      setRetorno({ ok: acao === "ativar" ? "Ativado" : acao === "inativar" ? "Inativado" : "Salvo" });
    } catch (err) {
      setRetorno(lerErro(err));
    }
  }

  const alternarApresentacao = (valor: string) =>
    setApresentacao((atual) => (atual.includes(valor) ? atual.filter((a) => a !== valor) : [...atual, valor]));

  return (
    <Card>
      <SectionTitle>Cadastro</SectionTitle>
      {indicador.status === "DEFINICAO_INCOMPLETA" && indicador.motivoIncompleto && (
        <Banner $tone="warn" style={{ marginBottom: 16 }}>
          Falta conferir: {indicador.motivoIncompleto}
        </Banner>
      )}
      {retorno && "erro" in retorno && (
        <Banner $tone="warn" role="alert" style={{ marginBottom: 16 }}>
          {retorno.erro}
        </Banner>
      )}

      <Field>
        <Label htmlFor="ind-nome">Nome</Label>
        <TextInput id="ind-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
      </Field>
      <Linha2>
        <Field>
          <Label as="span">Apresentação</Label>
          <div style={{ display: "flex", gap: 16 }}>
            {["Escopo", "Perfil"].map((a) => (
              <Checkbox key={a}>
                <input type="checkbox" checked={apresentacao.includes(a)} onChange={() => alternarApresentacao(a)} />
                {a}
              </Checkbox>
            ))}
          </div>
        </Field>
        <Field>
          <Label htmlFor="ind-meta">Meta (opcional)</Label>
          <TextInput id="ind-meta" inputMode="decimal" value={meta} onChange={(e) => setMeta(e.target.value)} />
          {metaInvalida && <ErroLocal>A meta precisa ser um número.</ErroLocal>}
        </Field>
      </Linha2>
      <Field>
        <Label htmlFor="ind-tipo">Tipo</Label>
        <Select id="ind-tipo" value={tipo} onChange={(e) => trocarTipo(e.target.value)}>
          {TIPOS_INDICADOR.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </Field>

      {usaFormulario ? (
        <FormularioDoTipo tipo={tipo} config={config} perguntas={perguntas} onChange={setConfig} />
      ) : (
        <>
          {TIPOS_COM_FORMULARIO.has(tipo) && (
            <Muted style={{ marginBottom: 8 }}>Indicador sem pesquisa vinculada: edite a configuração pelo JSON.</Muted>
          )}
          <EditorJson texto={jsonTexto} erro={!jsonParseado.ok} onChange={setJsonTexto} />
        </>
      )}

      {lePergunta ? (
        <Recorte indicador={indicador} de={deRecorte} perguntas={perguntasCompativeis} estado={recorte} onChange={setRecorte} />
      ) : (
        indicador.recorte === "ANTES_APOS" && (
          <Muted>Compara antes e depois (recorte gravado, só leitura nesta tela).</Muted>
        )
      )}

      <Acoes>
        {indicador.status !== "INATIVO" && (
          <Button type="button" $variant="ghost" disabled={salvar.isPending} onClick={() => executar("inativar")}>
            Inativar
          </Button>
        )}
        <Button type="button" $variant="ghost" disabled={bloqueado} onClick={() => executar("salvar")}>
          Salvar
        </Button>
        {indicador.status !== "ATIVO" && (
          <Button type="button" disabled={bloqueado} onClick={() => executar("ativar")}>
            Ativar
          </Button>
        )}
      </Acoes>
      {retorno && "erro" in retorno && retorno.itens.length > 0 && (
        <ListaProblemas>
          {retorno.itens.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ListaProblemas>
      )}
      {retorno && "ok" in retorno && <Sucesso role="status">{retorno.ok}</Sucesso>}
    </Card>
  );
}
