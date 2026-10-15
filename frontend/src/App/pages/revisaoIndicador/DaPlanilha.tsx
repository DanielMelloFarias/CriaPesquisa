import styled from "styled-components";
import type { Indicador } from "../../api/indicadores.js";
import { Card, SectionTitle, Muted } from "../../../Styles/ui.js";

const CAMPOS: Array<{ chave: string; rotulo: string }> = [
  { chave: "nome", rotulo: "Nome" },
  { chave: "formulaCalculo", rotulo: "Fórmula de cálculo" },
  { chave: "formulaDescritiva", rotulo: "Fórmula descritiva" },
  { chave: "perguntaDescricao", rotulo: "Pergunta" },
  { chave: "objetivo", rotulo: "Objetivo" },
  { chave: "observacoes", rotulo: "Observações" },
  { chave: "categoria", rotulo: "Categoria" },
];

const Item = styled.div`
  margin-bottom: 14px;
`;

const Rotulo = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: ${(p) => p.theme.cores.textMuted};
  margin-bottom: 2px;
`;

const Texto = styled.div`
  font-size: 14px;
  white-space: pre-wrap;
  word-break: break-word;
`;

const Ids = styled.div`
  font-size: 11px;
  color: ${(p) => p.theme.cores.textMuted};
`;

/** Coluna só de leitura com o texto original da planilha. */
export function DaPlanilha({ indicador }: { indicador: Indicador }) {
  const dados = indicador.dadosPlanilha ?? {};
  const auxiliar = Object.keys(dados).length === 0;
  return (
    <Card>
      <SectionTitle>Da planilha</SectionTitle>
      {auxiliar ? (
        <Muted>Indicador auxiliar, criado pela importação a partir das definições decididas.</Muted>
      ) : (
        CAMPOS.filter((c) => dados[c.chave]?.trim()).map((c) => (
          <Item key={c.chave}>
            <Rotulo>{c.rotulo}</Rotulo>
            <Texto>{dados[c.chave]}</Texto>
          </Item>
        ))
      )}
      {indicador.idsPlanilha.length > 0 && <Ids>IDs na planilha: {indicador.idsPlanilha.join(", ")}</Ids>}
    </Card>
  );
}
