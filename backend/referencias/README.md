# Tabelas de referência do motor de indicadores

Dados oficiais, não digitados à mão. Se for preciso atualizar, regenere — não edite.

## oms-imc-idade.json

- Fonte: OMS, Child Growth Standards (2006), BMI-for-age, *expanded tables* (z-scores), por dia, 0–1856 dias.
- Página: https://www.who.int/TOOLKITS/CHILD-GROWTH-STANDARDS/STANDARDS/BODY-MASS-INDEX-FOR-AGE-BMI-FOR-AGE
- Arquivos: `bfa-boys-zscore-expanded-tables.xlsx` e `bfa-girls-zscore-expanded-tables.xlsx` (links na página).
- Obtido em: 2026-10-15.
- Regenerar: `npx tsx scripts/gerar-referencia-oms.ts <meninos.xlsx> <meninas.xlsx>`.
- Formato: `{ masculino: [[L, M, S], ...], feminino: [...] }`, índice = dia de vida.

## atalah.json

- Fonte: Ministério da Saúde, *Orientações para a coleta e análise de dados antropométricos em serviços de saúde — Norma Técnica do SISVAN* (2011), Quadro 19, p. 25 (Atalah Samur et al., 1997).
- PDF: https://bvsms.saude.gov.br/bvs/publicacoes/orientacoes_coleta_analise_dados_antropometricos.pdf
- Transcrito com `pdftotext -layout`; `tests/referencias.test.ts` confere pontos contra o quadro.
- Campos: `baixoPesoAte` (BP ≤), `sobrepesoDe` (início de S), `obesidadeDe` (O ≥), semanas 6–42.
