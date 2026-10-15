import styled from "styled-components";
import type { PerguntaBruta, TipoPergunta } from "../../api/pesquisas.js";
import { Field, Label, Select, TextInput, Textarea, Checkbox, Muted } from "../../../Styles/ui.js";

export const TIPOS_INDICADOR = [
  "PROPORCAO", "CRUZAMENTO", "MEDIA", "DERIVADA",
  "COMPOSTO", "CLASSIFICACAO", "CONTAGEM", "DISTRIBUICAO",
  "ESCALA", "META_POR_IDADE", "ZSCORE", "PERCENTIL_OMS", "ATALAH",
] as const;

/** Config editável como objeto solto: cada formulário só mexe nas chaves do seu tipo. */
export type ConfigSolta = Record<string, unknown>;

const ESCOLHA: TipoPergunta[] = ["ESCOLHA_UNICA", "MULTIPLA_ESCOLHA"];

/** Tipos com formulário próprio e o tipo de pergunta que cada um lê (CONTAGEM não lê pergunta). */
export const PERGUNTAS_DO_TIPO: Record<string, TipoPergunta[]> = {
  PROPORCAO: ESCOLHA,
  DISTRIBUICAO: ESCOLHA,
  MEDIA: ["NUMERO"],
  ESCALA: ["ESCOLHA_UNICA"],
};

export const TIPOS_COM_FORMULARIO = new Set([...Object.keys(PERGUNTAS_DO_TIPO), "CONTAGEM"]);

export function comoObjeto(valor: unknown): ConfigSolta {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor) ? { ...(valor as ConfigSolta) } : {};
}

/** Só as chaves que a API aceita para o tipo (os schemas são `strict`). */
export function configDoFormulario(tipo: string, c: ConfigSolta): ConfigSolta {
  const perguntaId = typeof c.perguntaId === "string" ? c.perguntaId : "";
  switch (tipo) {
    case "PROPORCAO":
      return { tipo, perguntaId, opcoesNumerador: Array.isArray(c.opcoesNumerador) ? c.opcoesNumerador : [] };
    case "ESCALA":
      return { tipo, perguntaId, notas: comoObjeto(c.notas) };
    case "CONTAGEM":
      return { tipo };
    default:
      return { tipo, perguntaId };
  }
}

const Opcoes = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const LinhaNota = styled.div`
  display: grid;
  grid-template-columns: 1fr 110px auto;
  gap: 10px;
  align-items: center;
  font-size: 13px;
  @media (max-width: 560px) {
    grid-template-columns: 1fr 90px;
    > :last-child { grid-column: 1 / -1; }
  }
`;

interface SelectPerguntaProps {
  id: string;
  rotulo: string;
  perguntas: PerguntaBruta[];
  valor: string;
  onChange: (perguntaId: string) => void;
}

export function SelectPergunta({ id, rotulo, perguntas, valor, onChange }: SelectPerguntaProps) {
  const conhecida = valor === "" || perguntas.some((p) => p.id === valor);
  return (
    <Field>
      <Label htmlFor={id}>{rotulo}</Label>
      <Select id={id} value={valor} onChange={(e) => onChange(e.target.value)}>
        <option value="">Selecione a pergunta…</option>
        {!conhecida && <option value={valor}>Pergunta fora desta pesquisa ({valor})</option>}
        {perguntas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.enunciado}
          </option>
        ))}
      </Select>
    </Field>
  );
}

interface FormProps {
  tipo: string;
  config: ConfigSolta;
  perguntas: PerguntaBruta[];
  onChange: (config: ConfigSolta) => void;
}

/** PROPORCAO, DISTRIBUICAO, MEDIA, ESCALA e CONTAGEM. */
export function FormularioDoTipo({ tipo, config, perguntas, onChange }: FormProps) {
  if (tipo === "CONTAGEM") return <Muted>Contagem não usa pergunta: conta as respostas aprovadas.</Muted>;

  const aceitas = PERGUNTAS_DO_TIPO[tipo] ?? [];
  const compativeis = perguntas.filter((p) => aceitas.includes(p.tipo));
  const perguntaId = typeof config.perguntaId === "string" ? config.perguntaId : "";
  const pergunta = perguntas.find((p) => p.id === perguntaId);

  // Trocar a pergunta zera o que dependia das opções da anterior.
  const trocarPergunta = (novo: string) => onChange({ ...config, perguntaId: novo, opcoesNumerador: [], notas: {} });

  return (
    <>
      <SelectPergunta id="cfg-pergunta" rotulo="Pergunta" perguntas={compativeis} valor={perguntaId} onChange={trocarPergunta} />
      {tipo === "PROPORCAO" && pergunta && (
        <OpcoesNumerador config={config} opcoes={pergunta.opcoes.map((o) => o.texto)} onChange={onChange} />
      )}
      {tipo === "ESCALA" && pergunta && (
        <NotasEscala config={config} opcoes={pergunta.opcoes.map((o) => o.texto)} onChange={onChange} />
      )}
    </>
  );
}

function OpcoesNumerador({ config, opcoes, onChange }: { config: ConfigSolta; opcoes: string[]; onChange: (c: ConfigSolta) => void }) {
  const marcadas = Array.isArray(config.opcoesNumerador) ? (config.opcoesNumerador as string[]) : [];
  const alternar = (op: string) =>
    onChange({
      ...config,
      opcoesNumerador: marcadas.includes(op) ? marcadas.filter((m) => m !== op) : [...marcadas, op],
    });
  return (
    <Field>
      <Label as="span">Opções que contam no numerador</Label>
      <Opcoes>
        {opcoes.map((op) => (
          <Checkbox key={op}>
            <input type="checkbox" checked={marcadas.includes(op)} onChange={() => alternar(op)} />
            {op}
          </Checkbox>
        ))}
      </Opcoes>
    </Field>
  );
}

function NotasEscala({ config, opcoes, onChange }: { config: ConfigSolta; opcoes: string[]; onChange: (c: ConfigSolta) => void }) {
  const notas = comoObjeto(config.notas) as Record<string, number | null>;
  const definir = (op: string, nota: number | null | undefined) => {
    const novas = { ...notas };
    if (nota === undefined) delete novas[op];
    else novas[op] = nota;
    onChange({ ...config, notas: novas });
  };
  return (
    <Field>
      <Label as="span">Nota de cada opção (0 a 100)</Label>
      <Opcoes>
        {opcoes.map((op) => {
          const nota = notas[op];
          const fora = nota === null;
          return (
            <LinhaNota key={op}>
              <span>{op}</span>
              <TextInput
                type="number"
                min={0}
                max={100}
                aria-label={`Nota de ${op}`}
                disabled={fora}
                value={typeof nota === "number" ? String(nota) : ""}
                onChange={(e) => {
                  const n = e.target.value === "" ? undefined : Number(e.target.value);
                  definir(op, n !== undefined && Number.isFinite(n) ? n : undefined);
                }}
              />
              <Checkbox>
                <input
                  type="checkbox"
                  aria-label={`${op} fora do cálculo`}
                  checked={fora}
                  onChange={() => definir(op, fora ? undefined : null)}
                />
                fora do cálculo
              </Checkbox>
            </LinhaNota>
          );
        })}
      </Opcoes>
    </Field>
  );
}

export function EditorJson({ texto, erro, onChange }: { texto: string; erro: boolean; onChange: (t: string) => void }) {
  return (
    <Field>
      <Label htmlFor="cfg-json">Configuração (JSON)</Label>
      <Textarea
        id="cfg-json"
        value={texto}
        spellCheck={false}
        style={{ fontFamily: "monospace", minHeight: 220 }}
        onChange={(e) => onChange(e.target.value)}
      />
      {erro && <ErroLocal>JSON inválido</ErroLocal>}
    </Field>
  );
}

export const ErroLocal = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${(p) => p.theme.cores.danger};
`;
