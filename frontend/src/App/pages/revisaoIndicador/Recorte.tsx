import type { Indicador } from "../../api/indicadores.js";
import type { PerguntaBruta } from "../../api/pesquisas.js";
import { Field, Checkbox, Muted } from "../../../Styles/ui.js";
import { SelectPergunta, ErroLocal } from "./ConfigPorTipo.js";

export interface EstadoRecorte {
  ligado: boolean;
  para: string;
}

interface Props {
  indicador: Indicador;
  /**
   * true: tipo de formulário (uma pergunta só) com no máximo um par gravado — a tela
   * escolhe a pergunta do APÓS. false: tipos de JSON ou vários pares gravados — a tela
   * só mostra o que está gravado e deixa desligar (a API limpa com `null`).
   */
  escolhePar: boolean;
  /** Pergunta do ANTES: a que a config do formulário lê. */
  de: string;
  perguntas: PerguntaBruta[];
  estado: EstadoRecorte;
  onChange: (e: EstadoRecorte) => void;
}

const enunciado = (perguntas: PerguntaBruta[], id: string) => perguntas.find((p) => p.id === id)?.enunciado ?? id;

export function Recorte({ indicador, escolhePar, de, perguntas, estado, onChange }: Props) {
  const gravadas = indicador.recorteConfig?.substituicoes ?? [];
  return (
    <>
      <Field>
        <Checkbox>
          <input
            type="checkbox"
            checked={estado.ligado}
            disabled={escolhePar && !de && !estado.ligado}
            onChange={(e) => onChange({ ...estado, ligado: e.target.checked })}
          />
          Comparar antes e depois
        </Checkbox>
        {escolhePar && !de && <Muted>Escolha a pergunta do indicador antes de ligar a comparação.</Muted>}
        {!escolhePar && (
          <Muted>
            Par gravado: {gravadas.map((s) => `${enunciado(perguntas, s.de)} → ${enunciado(perguntas, s.para)}`).join("; ")}.
            {" "}Por esta tela dá para desligar; para trocar o par, desligue e use um tipo com pergunta única.
          </Muted>
        )}
      </Field>
      {escolhePar && estado.ligado && (
        <>
          <SelectPergunta
            id="cfg-recorte-para"
            rotulo="Pergunta do depois (APÓS)"
            perguntas={perguntas.filter((p) => p.id !== de)}
            valor={estado.para}
            onChange={(para) => onChange({ ...estado, para })}
          />
          {!estado.para && <ErroLocal>Escolha a pergunta do depois.</ErroLocal>}
        </>
      )}
    </>
  );
}
