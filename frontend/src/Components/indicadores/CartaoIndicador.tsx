import styled, { useTheme } from "styled-components";
import { Link } from "react-router-dom";
import { Info } from "lucide-react";
import { Card, Muted, Tag } from "../../Styles/ui.js";
import { DonutInterativo } from "../charts/DonutInterativo.js";
import { FunilValores } from "../charts/FunilValores.js";
import type { Indicador } from "../../App/api/indicadores.js";
import { formatarResultado, type Exibicao, type ResultadoComRecorte } from "../../App/lib/resultadoIndicador.js";

const Topo = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
`;

const Nome = styled.h3`
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: ${(p) => p.theme.cores.text};
`;

const Codigo = styled.span`
  font-size: 11px;
  color: ${(p) => p.theme.cores.textMuted};
`;

const IconeInfo = styled.span`
  color: ${(p) => p.theme.cores.textMuted};
  display: inline-flex;
  flex-shrink: 0;
  cursor: help;
`;

const Grande = styled.div`
  font-family: "Space Grotesk", sans-serif;
  font-size: 34px;
  font-weight: 700;
  line-height: 1.1;
  color: ${(p) => p.theme.cores.primaryDark};
`;

const Legenda = styled.div`
  margin-top: 4px;
  font-size: 12px;
  color: ${(p) => p.theme.cores.textMuted};
`;

const Barra = styled.div`
  display: flex;
  height: 14px;
  border-radius: 999px;
  overflow: hidden;
  background: ${(p) => p.theme.cores.surfaceAlt};
`;

const Faixa = styled.div<{ $pct: number; $cor: string }>`
  width: ${(p) => p.$pct}%;
  background: ${(p) => p.$cor};
`;

const LegendaFaixas = styled.ul`
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: ${(p) => p.theme.cores.text};
  li {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  strong {
    margin-left: auto;
    color: ${(p) => p.theme.cores.primaryDark};
  }
`;

const Swatch = styled.span<{ $cor: string }>`
  width: 10px;
  height: 10px;
  border-radius: 3px;
  background: ${(p) => p.$cor};
`;

const Colunas = styled.div`
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 14px;
  align-items: center;
  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const TituloColuna = styled.div`
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: ${(p) => p.theme.cores.textMuted};
  margin-bottom: 8px;
`;

const LinkRevisar = styled(Link)`
  display: inline-block;
  margin-top: 8px;
  font-size: 12.5px;
  font-weight: 600;
  color: ${(p) => p.theme.cores.accent};
`;

const pct = (v: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

function Faixas({ faixas }: { faixas: Array<{ rotulo: string; percentual: number }> }) {
  const t = useTheme();
  const CORES = [t.cores.primaryDark, t.cores.accent, t.cores.warn, t.cores.success, t.cores.danger];
  return (
    <>
      <Barra>
        {faixas.map((f, i) => (
          <Faixa key={f.rotulo} $pct={f.percentual} $cor={CORES[i % CORES.length]} aria-label={`${f.rotulo} ${pct(f.percentual)}`} role="img" />
        ))}
      </Barra>
      <LegendaFaixas>
        {faixas.map((f, i) => (
          <li key={f.rotulo}>
            <Swatch $cor={CORES[i % CORES.length]} />
            <span>{f.rotulo}</span>
            <strong>{pct(f.percentual)}</strong>
          </li>
        ))}
      </LegendaFaixas>
    </>
  );
}


function Corpo({ exibicao, podeRevisar, id }: { exibicao: Exibicao; podeRevisar: boolean; id: string }) {
  switch (exibicao.forma) {
    case "NUMERO":
      return (
        <>
          <Grande>{exibicao.texto}</Grande>
          {exibicao.legenda && <Legenda>{exibicao.legenda}</Legenda>}
          {exibicao.meta && (
            <div style={{ marginTop: 8 }}>
              <Tag $tone={exibicao.meta.atingida ? "green" : "orange"}>
                {exibicao.meta.texto} — {exibicao.meta.atingida ? "atingida" : "não atingida"}
              </Tag>
            </div>
          )}
        </>
      );
    case "FAIXAS":
      return <Faixas faixas={exibicao.faixas} />;
    case "DISTRIBUICAO":
      return exibicao.grafico === "ROSCA" ? (
        <DonutInterativo
          labels={exibicao.itens.map((i) => i.opcao)}
          data={exibicao.itens.map((i) => i.percentual)}
          unidade="%"
          altura={220}
          semCard
        />
      ) : (
        <FunilValores valores={exibicao.itens.map((i) => ({ rotulo: i.opcao, valor: pct(i.percentual), barra: i.percentual }))} />
      );
    case "SEM_DADOS":
      return <Muted style={{ fontSize: 12.5 }}>Sem respostas aprovadas neste recorte</Muted>;
    case "INCOMPLETO":
      return (
        <div style={{ opacity: 0.75 }}>
          <Muted style={{ fontSize: 12.5 }}>Não calculável — {exibicao.motivo}</Muted>
          {podeRevisar && <LinkRevisar to={`/indicadores/${id}`}>Revisar indicador</LinkRevisar>}
        </div>
      );
  }
}

export function CartaoIndicador({
  indicador,
  resultado,
  podeRevisar,
}: {
  indicador: Indicador;
  resultado: ResultadoComRecorte | undefined;
  podeRevisar: boolean;
}) {
  const modelo = formatarResultado(indicador, resultado);
  const objetivo = indicador.objetivo;

  return (
    <Card>
      <Topo>
        <div>
          <Nome>{indicador.nome}</Nome>
          <Codigo>{indicador.codigo}</Codigo>
        </div>
        {objetivo && (
          <IconeInfo title={objetivo} aria-label="Objetivo do indicador">
            <Info size={15} />
          </IconeInfo>
        )}
      </Topo>

      {modelo.pareado ? (
        <Colunas>
          <div>
            <TituloColuna>Antes do Cartão CRIA</TituloColuna>
            <Corpo exibicao={modelo.antes} podeRevisar={podeRevisar} id={indicador.id} />
          </div>
          {modelo.diferenca !== undefined && (
            <Tag $tone="blue" data-testid="diferenca" aria-label="Diferença entre antes e após">
              {modelo.diferenca}
            </Tag>
          )}
          <div>
            <TituloColuna>Após o Cartão CRIA</TituloColuna>
            <Corpo exibicao={modelo.apos} podeRevisar={podeRevisar} id={indicador.id} />
          </div>
        </Colunas>
      ) : (
        <Corpo exibicao={modelo.exibicao} podeRevisar={podeRevisar} id={indicador.id} />
      )}
    </Card>
  );
}
