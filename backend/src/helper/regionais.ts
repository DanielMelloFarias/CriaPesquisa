// Mapa das 10 regionais de saúde/assistência de Alagoas → municípios.
// Portado de SECRIA/dashboard_cria_postgresql/app.py (REGIONAL_MAP).
const REGIONAL_MAP: Record<string, string[]> = {
  "1ª Regional – Maceió": ["Maceió", "Marechal Deodoro", "Rio Largo", "Santa Luzia do Norte", "Satuba", "Coqueiro Seco", "Messias", "Murici", "Pilar", "Paripueira", "São Luís do Quitunde", "Flexeiras", "Boca da Mata", "Barra de São Miguel", "Roteiro", "Coruripe", "São Miguel dos Campos", "Jequiá da Praia", "Atalaia"],
  "2ª Regional – Arapiraca": ["Arapiraca", "Craíbas", "Lagoa da Canoa", "São Sebastião", "Taquarana", "Feira Grande", "Limoeiro de Anadia", "Anadia", "Girau do Ponciano", "Junqueiro", "Campo Alegre", "Teotônio Vilela", "Campo Grande", "Coité do Nóia", "Jaramataia", "Olho dÁgua Grande", "Mar Vermelho", "Belém"],
  "3ª Regional – Palmeira dos Índios": ["Palmeira dos Índios", "Cacimbinhas", "Igaci", "Maribondo", "Quebrangulo", "Viçosa", "Ibateguara", "Branquinha", "Santana do Mundaú", "União dos Palmares", "São José da Laje", "Cajueiro", "Joaquim Gomes", "Colônia Leopoldina", "Novo Lino", "Jundiá"],
  "4ª Regional – Santana do Ipanema": ["Santana do Ipanema", "Major Isidoro", "Batalha", "Belo Monte", "Dois Riachos", "Monteirópolis", "Olho dÁgua das Flores", "Poço das Trincheiras", "Água Branca", "Ouro Branco", "Senador Rui Palmeira", "Carneiros", "Canapi", "Inhapi", "Pariconha", "Mata Grande", "Olho dÁgua do Casado"],
  "5ª Regional – Penedo": ["Penedo", "Porto Real do Colégio", "Piaçabuçu", "Igreja Nova", "Traipu", "São Brás", "Feliz Deserto", "Porto de Pedras", "Barra de Santo Antônio"],
  "6ª Regional – União dos Palmares": ["União dos Palmares", "Murici", "Joaquim Gomes", "Branquinha", "Ibateguara", "Cajueiro", "Novo Lino", "Jundiá", "Santana do Mundaú", "São José da Laje"],
  "7ª Regional – Delmiro Gouveia": ["Delmiro Gouveia", "Piranhas", "Pariconha", "Inhapi", "Canapi", "Mata Grande", "Olho dÁgua do Casado", "Senador Rui Palmeira", "Água Branca"],
  "8ª Regional – Maragogi": ["Maragogi", "Japaratinga", "São Miguel dos Milagres", "Porto de Pedras", "Porto Calvo", "Passo de Camaragibe", "Matriz de Camaragibe", "São Luís do Quitunde", "Jacuípe"],
  "9ª Regional – Coruripe": ["Coruripe", "São Miguel dos Campos", "Jequiá da Praia", "Boca da Mata", "Atalaia", "Teotônio Vilela", "Campo Alegre", "Junqueiro"],
  "10ª Regional – Piranhas": ["Piranhas", "Delmiro Gouveia", "Pariconha", "Belo Monte", "Poço das Trincheiras", "Água Branca"],
};

function normalizar(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

// Mantém a PRIMEIRA regional que lista o município (equivalente ao setdefault do app.py).
const porNormalizado = new Map<string, string>();
for (const [regional, municipios] of Object.entries(REGIONAL_MAP)) {
  for (const municipio of municipios) {
    const chave = normalizar(municipio);
    if (!porNormalizado.has(chave)) porNormalizado.set(chave, regional);
  }
}

export function regionalDoMunicipio(nome: string): string {
  return porNormalizado.get(normalizar(nome)) ?? "Sem regional informada";
}

/** Nomes das regionais na ordem do mapa (1ª…10ª). */
export function listarRegionais(): string[] {
  return Object.keys(REGIONAL_MAP);
}

export { REGIONAL_MAP };
