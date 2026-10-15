import { useEffect, useMemo, useRef, useState } from "react";
import styled, { useTheme } from "styled-components";
import { Doughnut } from "react-chartjs-2";
import type { ChartOptions, Plugin } from "chart.js";
import { Card, SectionTitle, Muted } from "../../Styles/ui.js";
import { PALETA } from "../../App/data/cria.js";
import "./setup.js";

interface Props {
  titulo?: string;
  labels: string[];
  data: number[];
  /** Rótulo mostrado no centro junto do total (ex.: "respostas"). */
  unidade: string;
  cores?: string[];
  altura?: number;
  dica?: string;
  /** Ocupa a linha inteira do grid (card sozinho na linha). */
  full?: boolean;
  /** Posição da legenda: embaixo (padrão) ou à direita (legenda própria multi-coluna). */
  legenda?: "bottom" | "right";
  /** Renderiza só o gráfico, sem Card/título próprios (para embutir em outro cartão). */
  semCard?: boolean;
}

const Hint = styled.span`
  font-weight: 500;
  font-size: 12px;
  color: ${(p) => p.theme.cores.textMuted};
`;

const Conteudo = styled.div`
  display: flex;
  gap: 18px;
  align-items: center;
  margin-top: 10px;
  flex-wrap: wrap;
`;

const GraficoBox = styled.div`
  position: relative;
  height: 280px;
  flex: 0 0 300px;
  max-width: 100%;
  @media (max-width: 560px) {
    flex-basis: 100%;
  }
`;

const LegendaGrid = styled.div`
  flex: 1;
  min-width: 200px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 3px 12px;
  max-height: 280px;
  overflow: auto;
`;

const LegItem = styled.button<{ $ativo: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  border-radius: 8px;
  padding: 5px 8px;
  cursor: pointer;
  text-align: left;
  font-size: 12px;
  color: ${(p) => p.theme.cores.text};
  background: ${(p) => (p.$ativo ? p.theme.cores.accentSoft : "transparent")};
  transition: background 0.12s ease;
  &:hover {
    background: ${(p) => p.theme.cores.surfaceAlt};
  }
`;

const Swatch = styled.span<{ $cor: string }>`
  width: 11px;
  height: 11px;
  border-radius: 3px;
  flex-shrink: 0;
  background: ${(p) => p.$cor};
`;

const LegNome = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const LegCont = styled.span`
  flex-shrink: 0;
  font-weight: 700;
  color: ${(p) => p.theme.cores.primaryDark};
`;

// Quebra o rótulo central em até 2 linhas para caber no furo da rosca.
function quebrar(ctx: CanvasRenderingContext2D, texto: string, maxW: number): string[] {
  const palavras = texto.split(" ");
  const linhas: string[] = [];
  let atual = "";
  for (const p of palavras) {
    const teste = atual ? `${atual} ${p}` : p;
    if (ctx.measureText(teste).width > maxW && atual) {
      linhas.push(atual);
      atual = p;
    } else {
      atual = teste;
    }
  }
  if (atual) linhas.push(atual);
  return linhas.slice(0, 2);
}

export function DonutInterativo({
  titulo,
  labels,
  data,
  unidade,
  cores,
  altura,
  dica = "clique numa fatia para ver o valor",
  full = false,
  legenda = "bottom",
  semCard = false,
}: Props) {
  const t = useTheme();
  const h = altura ?? (full ? 320 : 260);
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const chartRef = useRef<any>(null);
  const total = useMemo(() => data.reduce((a, b) => a + b, 0), [data]);
  const paleta = useMemo(() => cores ?? labels.map((_, i) => PALETA[i % PALETA.length]), [cores, labels]);

  // Estado lido pelo plugin de texto central (atualizado a cada render).
  const centro = useRef({
    total,
    unidade,
    labels,
    data,
    paleta,
    selecionado,
    corTexto: t.cores.primaryDark,
    corMuted: t.cores.textMuted,
  });
  centro.current = { total, unidade, labels, data, paleta, selecionado, corTexto: t.cores.primaryDark, corMuted: t.cores.textMuted };

  useEffect(() => {
    chartRef.current?.update();
  }, [selecionado]);

  const alternar = (idx: number) => setSelecionado((p) => (p === idx ? null : idx));

  const textoCentral: Plugin<"doughnut"> = {
    id: "textoCentral",
    afterDraw(chart) {
      const area = chart.chartArea;
      if (!area) return;
      const ctx = chart.ctx;
      const s = centro.current;
      const cx = (area.left + area.right) / 2;
      const cy = (area.top + area.bottom) / 2;
      const sel = s.selecionado != null && s.selecionado < s.data.length ? s.selecionado : null;
      const big = sel == null ? s.total : s.data[sel];
      const label = sel == null ? s.unidade : s.labels[sel];
      const corBig = sel == null ? s.corTexto : s.paleta[sel];
      const raio = Math.min(area.right - area.left, area.bottom - area.top) / 2;
      const maxW = raio * 1.5;

      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = corBig;
      ctx.font = "700 32px 'Space Grotesk', sans-serif";
      ctx.fillText(big.toLocaleString("pt-BR"), cx, cy - 12);
      ctx.fillStyle = s.corMuted;
      ctx.font = "600 11.5px Inter, sans-serif";
      quebrar(ctx, label, maxW).forEach((ln, i) => ctx.fillText(ln, cx, cy + 12 + i * 15));
      ctx.restore();
    },
  };

  const options: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "70%",
    onClick: (_e, els) => {
      if (els.length) alternar(els[0].index);
    },
    onHover: (e, els) => {
      const alvo = e.native?.target as HTMLElement | undefined;
      if (alvo) alvo.style.cursor = els.length ? "pointer" : "default";
    },
    plugins: {
      legend: {
        display: legenda === "bottom",
        position: "bottom",
        labels: { color: t.cores.textMuted, font: { size: 11 }, boxWidth: 12, padding: 12 },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const v = ctx.parsed as number;
            const pct = total > 0 ? ((v / total) * 100).toFixed(1) : "0";
            return `${ctx.label}: ${v.toLocaleString("pt-BR")} (${pct}%)`;
          },
        },
      },
    },
  };

  const estiloCard = full ? { gridColumn: "1 / -1" } : undefined;

  if (!labels.length || total === 0) {
    return (
      <Card style={estiloCard}>
        <SectionTitle style={{ margin: 0 }}>{titulo}</SectionTitle>
        <div style={{ height: h, display: "grid", placeItems: "center" }}>
          <Muted style={{ fontSize: 12.5 }}>Sem dados suficientes ainda.</Muted>
        </div>
      </Card>
    );
  }

  const grafico = <Doughnut ref={chartRef} data={{ labels, datasets: [{ data, backgroundColor: paleta, borderColor: t.cores.surface, borderWidth: 2, hoverOffset: 10 }] }} options={options} plugins={[textoCentral]} />;

  if (semCard) {
    return <div style={{ height: h, position: "relative" }}>{grafico}</div>;
  }

  return (
    <Card style={estiloCard}>
      <SectionTitle style={{ margin: 0 }}>
        {titulo} <Hint>· {dica}</Hint>
      </SectionTitle>

      {legenda === "right" ? (
        <Conteudo>
          <GraficoBox>{grafico}</GraficoBox>
          <LegendaGrid>
            {labels.map((l, i) => {
              const pct = total > 0 ? ((data[i] / total) * 100).toFixed(1) : "0";
              return (
                <LegItem key={l} type="button" $ativo={selecionado === i} onClick={() => alternar(i)} title={`${l}: ${data[i]} (${pct}%)`}>
                  <Swatch $cor={paleta[i]} />
                  <LegNome>{l}</LegNome>
                  <LegCont>{data[i]}</LegCont>
                </LegItem>
              );
            })}
          </LegendaGrid>
        </Conteudo>
      ) : (
        <div style={{ height: h, position: "relative", marginTop: 8 }}>{grafico}</div>
      )}
    </Card>
  );
}
