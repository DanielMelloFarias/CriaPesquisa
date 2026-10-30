import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { prisma } from "../src/config/prisma.js";
import { hashSenha } from "../src/helper/senha.js";
import { senhaForte } from "../src/helper/politicaSenha.js";
import { regionalDoMunicipio } from "../src/helper/regionais.js";
import { PESQUISAS_CARTAO_CRIA, criarPesquisaCompleta } from "./pesquisas-cartao-cria.js";

const __dir = dirname(fileURLToPath(import.meta.url));

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const FATOR_MES = [0.91, 0.94, 0.96, 0.98, 1.0, 1.02, 1.03, 1.04, 1.05, 1.06, 1.08, 1.1];
const FATOR_ANO: Record<number, number> = { 2024: 0.92, 2025: 1.0, 2026: 1.07 };
const ANOS = [2024, 2025, 2026];

// Domínio dos e-mails das contas-base. Configurável para não fixar o domínio
// institucional real no repositório — defina SEED_EMAIL_DOMINIO no .env.
const DOMINIO = process.env.SEED_EMAIL_DOMINIO ?? "@exemplo.local";

async function seedUsuarios() {
  const base = [
    { nome: "Administrador", email: `admin${DOMINIO}`, papel: "ADMIN" as const },
    { nome: "Gestor (PO)", email: `gestor${DOMINIO}`, papel: "GESTOR" as const },
    { nome: "Coletador", email: `coletador${DOMINIO}`, papel: "COLETADOR" as const },
    { nome: "Visualizador", email: `visualizador${DOMINIO}`, papel: "VISUALIZADOR" as const },
  ];
  // Senha inicial das contas-base. Nunca fixe credencial real no repositório:
  // defina SEED_PASSWORD no .env do ambiente. O default abaixo é só para dev local.
  const senhaPadrao = process.env.SEED_PASSWORD ?? "dev-criapesquisa";

  // Em produção as quatro contas nascem com a MESMA senha, conhecida por quem
  // roda o seed. Deixar passar uma senha fraca aqui seria abrir o sistema com a
  // porta encostada — e o default de dev jamais pode virar credencial real.
  if (process.env.NODE_ENV === "production") {
    if (!process.env.SEED_PASSWORD) {
      throw new Error("SEED_PASSWORD é obrigatória em produção.");
    }
    const veredito = senhaForte.safeParse(senhaPadrao);
    if (!veredito.success) {
      throw new Error(`SEED_PASSWORD não atende à política de senha: ${veredito.error.issues[0].message}`);
    }
  }

  const senhaHash = await hashSenha(senhaPadrao);
  for (const u of base) {
    await prisma.usuario.upsert({
      where: { email: u.email },
      update: {},
      // precisaTrocarSenha: quem roda o seed conhece esta senha. A conta só
      // passa a identificar a pessoa depois que ela troca, no primeiro acesso.
      create: { nome: u.nome, email: u.email, papel: u.papel, senhaHash, precisaTrocarSenha: true },
    });
  }
}

async function seedMunicipios() {
  if ((await prisma.municipioMensal.count()) > 0) return;
  const seed = JSON.parse(readFileSync(join(__dir, "..", "data", "seed_municipios.json"), "utf-8")) as Array<{
    municipio: string;
    total_beneficiarios: number;
    criancas: number;
    gestantes: number;
    valor_total: number;
    renda_media: number;
  }>;
  const rows = [];
  for (const d of seed) {
    for (const ano of ANOS) {
      for (let i = 0; i < 12; i++) {
        const f = FATOR_ANO[ano] * FATOR_MES[i];
        rows.push({
          ano,
          mes: i + 1,
          mesNome: MESES[i],
          municipio: d.municipio,
          regional: regionalDoMunicipio(d.municipio),
          totalBeneficiarios: Math.round(d.total_beneficiarios * f),
          criancas: Math.round(d.criancas * f),
          gestantes: Math.round(d.gestantes * f),
          valorTotal: Math.round(d.valor_total * f * 100) / 100,
          rendaMedia: d.renda_media,
        });
      }
    }
  }
  await prisma.municipioMensal.createMany({ data: rows, skipDuplicates: true });
}

async function seedBeneficios() {
  if ((await prisma.beneficioComposicao.count()) > 0) return;
  const base: Array<[string, number]> = [
    ["Bolsa Família", 76445],
    ["BF + PAIF", 6399],
    ["BF + Criança Feliz", 4416],
    ["BF + PL", 3395],
    ["BF + BVG", 1460],
    ["BF + BCN", 1198],
  ];
  await prisma.beneficioComposicao.createMany({
    data: base.map(([label, quantidade]) => ({ ano: 2025, mes: 6, label, quantidade })),
  });
}

// Cria as pesquisas reais do Cartão CRIA (Criança e Gestante) a partir da fonte
// da verdade em pesquisas-cartao-cria.ts. Sem respostas de exemplo — o sistema
// já saiu do modo demonstração.
async function seedPesquisasCRIA(gestorId: string, adminId: string) {
  if ((await prisma.pesquisa.count()) > 0) return;
  for (const p of PESQUISAS_CARTAO_CRIA) {
    await criarPesquisaCompleta({ titulo: p.titulo, descricao: p.descricao, secoes: p.secoes, gestorId, adminId });
  }
}

async function main() {
  await seedUsuarios();
  const [admin, gestor] = await Promise.all([
    prisma.usuario.findUnique({ where: { email: `admin${DOMINIO}` } }),
    prisma.usuario.findUnique({ where: { email: `gestor${DOMINIO}` } }),
  ]);
  // Série mensal e composição de benefícios são dados de demonstração (a série é
  // calculada com fatores fixos, até um mês que ainda não chegou). Em produção o
  // painel os mostraria como números reais, então só entram fora de produção.
  if (process.env.NODE_ENV !== "production") {
    await seedMunicipios();
    await seedBeneficios();
  }
  if (admin && gestor) {
    await seedPesquisasCRIA(gestor.id, admin.id);
  }
  console.log("Seed concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
