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
  /** Pergunta do ANTES: a que a config do formulário lê. */
  de: string;
  perguntas: PerguntaBruta[];
  estado: EstadoRecorte;
  onChange: (e: EstadoRecorte) => void;
}

const enunciado = (perguntas: PerguntaBruta[], id: string) => perguntas.find((p) => p.id === id)?.enunciado ?? id;

/**
 * Par ANTES/APÓS. A edição da API (`atualizarIndicadorSchema`) só aceita `recorte`
 * igual a "ANTES_APOS" ou ausente — ausente quer dizer "não mexer". Então um recorte
 * já gravado não tem como ser desligado nem trocado pela tela: fica só para leitura.
 */
export function Recorte({ indicador, de, perguntas, estado, onChange }: Props) {
  if (indicador.recorte === "ANTES_APOS") {
    const subs = indicador.recorteConfig?.substituicoes ?? [];
    return (
      <Field>
        <Muted>
          Compara antes e depois:{" "}
          {subs.map((s) => `${enunciado(perguntas, s.de)} → ${enunciado(perguntas, s.para)}`).join("; ")}.
          {" "}O recorte já gravado não pode ser desligado nem trocado por esta tela.
        </Muted>
      </Field>
    );
  }

  const opcoes = perguntas.filter((p) => p.id !== de);
  return (
    <>
      <Field>
        <Checkbox>
          <input
            type="checkbox"
            checked={estado.ligado}
            disabled={!de}
            onChange={(e) => onChange({ ...estado, ligado: e.target.checked })}
          />
          Comparar antes e depois
        </Checkbox>
        {!de && <Muted>Escolha a pergunta do indicador antes de ligar a comparação.</Muted>}
      </Field>
      {estado.ligado && (
        <>
          <SelectPergunta
            id="cfg-recorte-para"
            rotulo="Pergunta do depois (APÓS)"
            perguntas={opcoes}
            valor={estado.para}
            onChange={(para) => onChange({ ...estado, para })}
          />
          {!estado.para && <ErroLocal>Escolha a pergunta do depois.</ErroLocal>}
        </>
      )}
    </>
  );
}
