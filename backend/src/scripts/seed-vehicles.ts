/**
 * Seed script — 500 anúncios aleatórios
 *
 * Execução dentro do cluster:
 *   kubectl exec -n automarket deployment/backend -- npx tsx src/scripts/seed-vehicles.ts
 *
 * Execução local (requer port-forward do postgres e minio):
 *   npx tsx src/scripts/seed-vehicles.ts
 */

import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import prisma from '../db';
import { uploadFile } from '../storage';

// ─────────────────────────────────────────────────────────────
// BAIRROS
// ─────────────────────────────────────────────────────────────
const NEIGHBORHOODS = [
  { name: 'Pinheiros',         lat: -23.5629, lng: -46.6946 },
  { name: 'Vila Madalena',     lat: -23.5531, lng: -46.6916 },
  { name: 'Alto da Lapa',      lat: -23.5273, lng: -46.7268 },
  { name: 'Santo Amaro',       lat: -23.6516, lng: -46.7070 },
  { name: 'Brooklin',          lat: -23.6196, lng: -46.6929 },
  { name: 'Jardim Marajoara',  lat: -23.6560, lng: -46.7012 },
  { name: 'Vila Sofia',        lat: -23.6340, lng: -46.7040 },
  { name: 'Centro',            lat: -23.5505, lng: -46.6333 },
  { name: 'República',         lat: -23.5421, lng: -46.6416 },
  { name: 'Sé',                lat: -23.5475, lng: -46.6361 },
  { name: 'Jardim Hadad',      lat: -23.6020, lng: -46.7210 },
  { name: 'Vila Prudente',     lat: -23.5856, lng: -46.5845 },
  { name: 'Vila Oratorio',     lat: -23.5960, lng: -46.5900 },
];

// ─────────────────────────────────────────────────────────────
// 20 MODELOS MAIS VENDIDOS DO BRASIL
// ─────────────────────────────────────────────────────────────
const MODELS = [
  {
    brand: 'Chevrolet', model: 'Onix',
    versions: ['Joy', 'LT', 'LTZ', 'RS Turbo', 'Plus LT', 'Plus LTZ Turbo'],
    yearRange: [2018, 2024], priceRange: [52000, 108000],
    fuel: 'flex' as const, transmissions: ['manual', 'automatic'],
    condition: 'used' as const,
    colors: ['Branco', 'Prata', 'Preto', 'Vermelho', 'Cinza'],
    doors: 4, imageKeyword: 'chevrolet,onix,car',
    desc: 'Hatch compacto econômico, ideal para o dia a dia na cidade. Revisões em dia, único dono.',
  },
  {
    brand: 'Hyundai', model: 'Creta',
    versions: ['Smart', 'Action', 'Limited', 'N Line', 'Platinum'],
    yearRange: [2017, 2024], priceRange: [85000, 182000],
    fuel: 'flex' as const, transmissions: ['automatic'],
    condition: 'used' as const,
    colors: ['Branco', 'Prata', 'Preto', 'Azul', 'Vermelho'],
    doors: 4, imageKeyword: 'hyundai,creta,suv',
    desc: 'SUV moderno com excelente espaço interno. Multimídia com CarPlay, câmera de ré.',
  },
  {
    brand: 'Volkswagen', model: 'Polo',
    versions: ['MPI', 'TSI', 'Comfortline', 'Highline', 'GTS'],
    yearRange: [2018, 2024], priceRange: [68000, 128000],
    fuel: 'flex' as const, transmissions: ['manual', 'automatic'],
    condition: 'used' as const,
    colors: ['Branco', 'Prata', 'Cinza', 'Azul', 'Vermelho'],
    doors: 4, imageKeyword: 'volkswagen,polo,hatch',
    desc: 'Hatch premium com acabamento superior. Motor turbo eficiente, baixo consumo.',
  },
  {
    brand: 'Chevrolet', model: 'Tracker',
    versions: ['LT', 'LTZ', 'Premier', 'RS'],
    yearRange: [2017, 2024], priceRange: [82000, 162000],
    fuel: 'flex' as const, transmissions: ['automatic'],
    condition: 'used' as const,
    colors: ['Branco', 'Vermelho', 'Cinza', 'Preto', 'Azul'],
    doors: 4, imageKeyword: 'chevrolet,tracker,suv',
    desc: 'SUV compacto com design arrojado. Teto solar panorâmico, central multimídia.',
  },
  {
    brand: 'Volkswagen', model: 'T-Cross',
    versions: ['MPI', 'TSI', 'Comfortline', 'Highline'],
    yearRange: [2019, 2024], priceRange: [90000, 168000],
    fuel: 'flex' as const, transmissions: ['automatic'],
    condition: 'used' as const,
    colors: ['Branco', 'Prata', 'Preto', 'Laranja', 'Cinza'],
    doors: 4, imageKeyword: 'volkswagen,tcross,suv',
    desc: 'SUV espaçoso e elegante. Sistema IQ.Drive, assistentes de direção de série.',
  },
  {
    brand: 'Fiat', model: 'Strada',
    versions: ['Endurance', 'Freedom', 'Volcano', 'Ranch'],
    yearRange: [2016, 2024], priceRange: [70000, 145000],
    fuel: 'flex' as const, transmissions: ['manual', 'automatic'],
    condition: 'used' as const,
    colors: ['Branco', 'Prata', 'Vermelho', 'Preto', 'Cinza'],
    doors: 2, imageKeyword: 'fiat,strada,pickup',
    desc: 'Picape compacta versátil. Cabine dupla, banco traseiro amplo, rodas de liga leve.',
  },
  {
    brand: 'Fiat', model: 'Pulse',
    versions: ['Drive', 'Audace', 'Impetus', 'Abarth'],
    yearRange: [2021, 2024], priceRange: [80000, 148000],
    fuel: 'flex' as const, transmissions: ['automatic'],
    condition: 'used' as const,
    colors: ['Branco', 'Cinza', 'Vermelho', 'Azul', 'Preto'],
    doors: 4, imageKeyword: 'fiat,pulse,suv',
    desc: 'SUV moderno com plataforma robusta. Teto solar, pacote de assistência ao motorista.',
  },
  {
    brand: 'Toyota', model: 'Corolla Cross',
    versions: ['XRE', 'XRX', 'Hybrid'],
    yearRange: [2021, 2024], priceRange: [130000, 215000],
    fuel: 'hybrid' as const, transmissions: ['automatic'],
    condition: 'used' as const,
    colors: ['Branco', 'Prata', 'Preto', 'Cinza', 'Vermelho'],
    doors: 4, imageKeyword: 'toyota,corolla,cross,suv',
    desc: 'SUV híbrido com baixíssimo consumo. Garantia Toyota, revisões na concessionária.',
  },
  {
    brand: 'Fiat', model: 'Argo',
    versions: ['Drive', 'Drive GSR', 'Trekking', 'HGT'],
    yearRange: [2017, 2024], priceRange: [60000, 115000],
    fuel: 'flex' as const, transmissions: ['manual', 'automatic'],
    condition: 'used' as const,
    colors: ['Branco', 'Prata', 'Laranja', 'Cinza', 'Vermelho'],
    doors: 4, imageKeyword: 'fiat,argo,hatch',
    desc: 'Hatch moderno e espaçoso. Maior porta-malas do segmento, multimídia com Bluetooth.',
  },
  {
    brand: 'Jeep', model: 'Renegade',
    versions: ['Sport', 'Longitude', 'Limited', 'Trailhawk', 'Moab'],
    yearRange: [2015, 2024], priceRange: [100000, 198000],
    fuel: 'flex' as const, transmissions: ['manual', 'automatic'],
    condition: 'used' as const,
    colors: ['Branco', 'Verde', 'Preto', 'Cinza', 'Vermelho'],
    doors: 4, imageKeyword: 'jeep,renegade,suv',
    desc: 'SUV aventureiro e urbano. Tração 4x4 disponível, visual icônico, ótimo para trilhas.',
  },
  {
    brand: 'Honda', model: 'HR-V',
    versions: ['LX', 'EX', 'EXL', 'Touring'],
    yearRange: [2015, 2024], priceRange: [100000, 188000],
    fuel: 'flex' as const, transmissions: ['automatic', 'cvt'],
    condition: 'used' as const,
    colors: ['Branco', 'Prata', 'Preto', 'Azul', 'Cinza'],
    doors: 4, imageKeyword: 'honda,hrv,suv',
    desc: 'SUV elegante com melhor aproveitamento de espaço interno. Magic Seat versátil.',
  },
  {
    brand: 'Toyota', model: 'Hilux',
    versions: ['STD', 'SR', 'SRV', 'SRX', 'GR-S'],
    yearRange: [2016, 2024], priceRange: [190000, 355000],
    fuel: 'diesel' as const, transmissions: ['manual', 'automatic'],
    condition: 'used' as const,
    colors: ['Branco', 'Prata', 'Preto', 'Grafite', 'Cinza'],
    doors: 4, imageKeyword: 'toyota,hilux,pickup',
    desc: 'Picape líder de mercado. Tração 4x4, motor diesel potente, excelente capacidade de carga.',
  },
  {
    brand: 'Renault', model: 'Kwid',
    versions: ['Zen', 'Intense', 'Outsider', 'E-Tech'],
    yearRange: [2017, 2024], priceRange: [47000, 82000],
    fuel: 'flex' as const, transmissions: ['manual', 'automatic'],
    condition: 'used' as const,
    colors: ['Branco', 'Amarelo', 'Laranja', 'Cinza', 'Vermelho'],
    doors: 4, imageKeyword: 'renault,kwid,car',
    desc: 'Compacto econômico com visual de SUV. Ótimo para cidade, baixo custo de manutenção.',
  },
  {
    brand: 'Volkswagen', model: 'Virtus',
    versions: ['MPI', 'TSI', 'Comfortline', 'Highline', 'GTS'],
    yearRange: [2018, 2024], priceRange: [73000, 142000],
    fuel: 'flex' as const, transmissions: ['manual', 'automatic'],
    condition: 'used' as const,
    colors: ['Branco', 'Prata', 'Preto', 'Azul', 'Cinza'],
    doors: 4, imageKeyword: 'volkswagen,virtus,sedan',
    desc: 'Sedan elegante com porta-malas generoso. Motor turbo eficiente, acabamento premium.',
  },
  {
    brand: 'Hyundai', model: 'HB20',
    versions: ['Sense', 'Vision', 'Limited', 'Evolution', 'Sport'],
    yearRange: [2015, 2024], priceRange: [55000, 110000],
    fuel: 'flex' as const, transmissions: ['manual', 'automatic'],
    condition: 'used' as const,
    colors: ['Branco', 'Prata', 'Preto', 'Vermelho', 'Cinza'],
    doors: 4, imageKeyword: 'hyundai,hb20,hatch',
    desc: 'Hatch popular com ótimo custo-benefício. Multimídia, direção elétrica, ar-condicionado.',
  },
  {
    brand: 'Jeep', model: 'Compass',
    versions: ['Sport', 'Longitude', 'Limited', 'Trailhawk', 'Overland'],
    yearRange: [2016, 2024], priceRange: [155000, 268000],
    fuel: 'flex' as const, transmissions: ['automatic'],
    condition: 'used' as const,
    colors: ['Branco', 'Preto', 'Cinza', 'Azul', 'Verde'],
    doors: 4, imageKeyword: 'jeep,compass,suv',
    desc: 'SUV premium com alto nível de equipamentos. Teto solar, couro, assistentes de direção.',
  },
  {
    brand: 'Fiat', model: 'Cronos',
    versions: ['Drive', 'Drive GSR', 'Precision'],
    yearRange: [2018, 2024], priceRange: [65000, 112000],
    fuel: 'flex' as const, transmissions: ['manual', 'automatic'],
    condition: 'used' as const,
    colors: ['Branco', 'Prata', 'Preto', 'Vermelho', 'Cinza'],
    doors: 4, imageKeyword: 'fiat,cronos,sedan',
    desc: 'Sedan moderno com melhor consumo do segmento. Porta-malas de 525L, multimídia.',
  },
  {
    brand: 'Chevrolet', model: 'Montana',
    versions: ['Trail', 'Work', 'Sport', 'Premier'],
    yearRange: [2022, 2024], priceRange: [108000, 168000],
    fuel: 'flex' as const, transmissions: ['automatic'],
    condition: 'used' as const,
    colors: ['Branco', 'Preto', 'Cinza', 'Vermelho', 'Azul'],
    doors: 4, imageKeyword: 'chevrolet,montana,pickup',
    desc: 'Picape compacta moderna e versátil. Cabine dupla com amplo espaço, turbo flex.',
  },
  {
    brand: 'Ford', model: 'Maverick',
    versions: ['XL', 'XLT', 'Lariat'],
    yearRange: [2022, 2024], priceRange: [155000, 225000],
    fuel: 'hybrid' as const, transmissions: ['automatic'],
    condition: 'used' as const,
    colors: ['Branco', 'Preto', 'Cinza', 'Azul', 'Vermelho'],
    doors: 4, imageKeyword: 'ford,maverick,pickup',
    desc: 'Picape híbrida inovadora. Ótimo consumo, carroceria versátil, tecnologia embarcada.',
  },
  {
    brand: 'Nissan', model: 'Kicks',
    versions: ['S', 'SV', 'SL', 'Exclusive'],
    yearRange: [2017, 2024], priceRange: [98000, 178000],
    fuel: 'flex' as const, transmissions: ['automatic', 'cvt'],
    condition: 'used' as const,
    colors: ['Branco', 'Prata', 'Preto', 'Laranja', 'Cinza'],
    doors: 4, imageKeyword: 'nissan,kicks,suv',
    desc: 'SUV compacto com excelente eficiência. ProPilot disponível, design moderno e esportivo.',
  },
];

// ─────────────────────────────────────────────────────────────
// USUÁRIOS — 22 pessoas + 8 lojas
// ─────────────────────────────────────────────────────────────
const USERS_DATA = [
  // Pessoas físicas
  { name: 'Carlos Eduardo Silva',     email: 'carlos.silva@gmail.com',         phone: '(11) 99123-4567', isDealer: false },
  { name: 'Ana Paula Ferreira',        email: 'ana.ferreira@hotmail.com',       phone: '(11) 98234-5678', isDealer: false },
  { name: 'Roberto Alves',            email: 'roberto.alves@gmail.com',        phone: '(11) 97345-6789', isDealer: false },
  { name: 'Mariana Costa',            email: 'mariana.costa@outlook.com',      phone: '(11) 96456-7890', isDealer: false },
  { name: 'João Henrique Souza',       email: 'joao.souza@gmail.com',           phone: '(11) 95567-8901', isDealer: false },
  { name: 'Patricia Mendes',          email: 'patricia.mendes@gmail.com',      phone: '(11) 94678-9012', isDealer: false },
  { name: 'Fernando Rodrigues',       email: 'fernando.rodrigues@hotmail.com', phone: '(11) 93789-0123', isDealer: false },
  { name: 'Camila Oliveira',          email: 'camila.oliveira@gmail.com',      phone: '(11) 92890-1234', isDealer: false },
  { name: 'Rafael Martins',           email: 'rafael.martins@gmail.com',       phone: '(11) 91901-2345', isDealer: false },
  { name: 'Juliana Pereira',          email: 'juliana.pereira@outlook.com',    phone: '(11) 90012-3456', isDealer: false },
  { name: 'Marcos Vieira',            email: 'marcos.vieira@gmail.com',        phone: '(11) 99321-6547', isDealer: false },
  { name: 'Fernanda Lima',            email: 'fernanda.lima@gmail.com',        phone: '(11) 98432-7658', isDealer: false },
  { name: 'Gustavo Nascimento',       email: 'gustavo.nasc@hotmail.com',       phone: '(11) 97543-8769', isDealer: false },
  { name: 'Beatriz Santos',           email: 'bia.santos@gmail.com',           phone: '(11) 96654-9870', isDealer: false },
  { name: 'Diego Moreira',            email: 'diego.moreira@gmail.com',        phone: '(11) 95765-0981', isDealer: false },
  { name: 'Aline Carvalho',           email: 'aline.carvalho@outlook.com',     phone: '(11) 94876-1092', isDealer: false },
  { name: 'Bruno Teixeira',           email: 'bruno.teixeira@gmail.com',       phone: '(11) 93987-2103', isDealer: false },
  { name: 'Larissa Gomes',            email: 'larissa.gomes@gmail.com',        phone: '(11) 92098-3214', isDealer: false },
  { name: 'Thiago Barbosa',           email: 'thiago.barbosa@hotmail.com',     phone: '(11) 91109-4325', isDealer: false },
  { name: 'Vanessa Araújo',           email: 'vanessa.araujo@gmail.com',       phone: '(11) 90210-5436', isDealer: false },
  { name: 'Leonardo Castro',          email: 'leo.castro@gmail.com',           phone: '(11) 99876-5432', isDealer: false },
  { name: 'Priscila Nunes',           email: 'priscila.nunes@outlook.com',     phone: '(11) 98765-4321', isDealer: false },
  // Lojas / concessionárias
  { name: 'AutoSP Multimarcas',       email: 'vendas@autospmultimarcas.com.br', phone: '(11) 3456-7890', isDealer: true },
  { name: 'Pinheiros Motors',         email: 'contato@pinheiromotors.com.br',   phone: '(11) 3567-8901', isDealer: true },
  { name: 'TopCar Veículos',          email: 'vendas@topcarveiculos.com.br',    phone: '(11) 3678-9012', isDealer: true },
  { name: 'Lapa Auto Center',         email: 'vendas@lapaauto.com.br',          phone: '(11) 3789-0123', isDealer: true },
  { name: 'Sul Car Comércio',         email: 'contato@sulcarsp.com.br',         phone: '(11) 3890-1234', isDealer: true },
  { name: 'Império dos Carros SP',    email: 'vendas@imperiodoscarros.com.br',  phone: '(11) 3901-2345', isDealer: true },
  { name: 'Villa Nova Veículos',      email: 'contato@villanovaveiculos.com.br',phone: '(11) 3012-3456', isDealer: true },
  { name: 'Zona Sul Automóveis',      email: 'vendas@zonasulautom.com.br',      phone: '(11) 3123-4567', isDealer: true },
];

// ─────────────────────────────────────────────────────────────
// UTILITÁRIOS
// ─────────────────────────────────────────────────────────────
function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function jitter(coord: number, range = 0.01): number {
  return coord + (Math.random() - 0.5) * range * 2;
}

function randPrice(min: number, max: number): number {
  // Arredonda para múltiplos de R$500
  const raw = min + Math.random() * (max - min);
  return Math.round(raw / 500) * 500;
}

function randMileage(year: number): number {
  const age = 2024 - year;
  const avgKmPerYear = rnd(10000, 22000);
  const base = age * avgKmPerYear;
  return Math.max(0, base + rnd(-5000, 5000));
}

async function downloadImage(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { 'User-Agent': 'AutoMarket-Seed/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ao buscar ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// ─────────────────────────────────────────────────────────────
// PRÉ-CARREGA IMAGENS POR MODELO (5 por modelo = 100 downloads)
// ─────────────────────────────────────────────────────────────
async function preloadImages(): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  const IMAGES_PER_MODEL = 5;

  console.log(`\n📷  Baixando imagens (${MODELS.length * IMAGES_PER_MODEL} total)...`);

  for (const m of MODELS) {
    const urls: string[] = [];
    for (let i = 1; i <= IMAGES_PER_MODEL; i++) {
      const imageUrl = `https://loremflickr.com/800/600/${m.imageKeyword}?lock=${i * 7 + MODELS.indexOf(m) * 37}`;
      const vehicleId = uuidv4(); // id temporário só para nomear o arquivo
      const key = `seed/${m.brand.toLowerCase()}-${m.model.toLowerCase().replace(/\s/g, '-')}-${i}.jpg`;
      try {
        const buffer = await downloadImage(imageUrl);
        const storedUrl = await uploadFile(buffer, key, 'image/jpeg');
        urls.push(storedUrl);
        process.stdout.write('.');
      } catch (err) {
        console.warn(`\n⚠️  Falha na imagem ${imageUrl}: ${err}`);
        // fallback: imagem genérica de carro
        try {
          const fallback = `https://loremflickr.com/800/600/car,vehicle?lock=${i * 13}`;
          const buffer = await downloadImage(fallback);
          const storedUrl = await uploadFile(buffer, key, 'image/jpeg');
          urls.push(storedUrl);
          process.stdout.write('f');
        } catch {
          process.stdout.write('x');
        }
      }
      // Pequena pausa para não sobrecarregar o loremflickr
      await new Promise(r => setTimeout(r, 150));
    }
    map.set(`${m.brand}:${m.model}`, urls);
  }
  console.log('\n✅  Imagens carregadas.\n');
  return map;
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────
async function main() {
  console.log('🚗  AutoMarket — Seed de 500 anúncios\n');

  // ── 1. Criar usuários ────────────────────────────────────────
  console.log('👥  Criando usuários...');
  const passwordHash = await bcrypt.hash('Senha@123', 10);
  const createdUsers: { id: string; name: string; isDealer: boolean }[] = [];

  for (const u of USERS_DATA) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) {
      createdUsers.push({ id: existing.id, name: existing.name, isDealer: u.isDealer });
      continue;
    }
    const user = await prisma.user.create({
      data: {
        name: u.name,
        email: u.email,
        password_hash: passwordHash,
        phone: u.phone,
      },
    });
    createdUsers.push({ id: user.id, name: user.name, isDealer: u.isDealer });
  }
  console.log(`   ${createdUsers.length} usuários prontos.`);

  // Separar pessoas físicas e lojas
  const individuals = createdUsers.filter(u => !u.isDealer);
  const dealers     = createdUsers.filter(u => u.isDealer);

  // ── 2. Pré-carregar imagens ──────────────────────────────────
  const imageMap = await preloadImages();

  // ── 3. Montar lista de 500 veículos ─────────────────────────
  // Garante ao menos 1 de cada modelo (20 garantidos), resto aleatório
  const vehicleQueue: typeof MODELS[number][] = [...MODELS]; // 1 de cada
  while (vehicleQueue.length < 500) {
    vehicleQueue.push(pick(MODELS));
  }
  // Embaralha
  for (let i = vehicleQueue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [vehicleQueue[i], vehicleQueue[j]] = [vehicleQueue[j], vehicleQueue[i]];
  }

  // ── 4. Criar veículos ────────────────────────────────────────
  console.log('🚘  Criando 500 veículos...\n');
  let count = 0;
  const errors: string[] = [];

  for (const m of vehicleQueue) {
    try {
      const neighborhood = pick(NEIGHBORHOODS);
      const version      = pick(m.versions);
      const yearFab      = rnd(m.yearRange[0], m.yearRange[1]);
      const yearModel    = Math.min(yearFab + 1, 2025);
      const transmission = pick(m.transmissions);
      const color        = pick(m.colors);

      // Lojas tendem a ter carros mais caros e novos; pessoas vendem carros usados comuns
      const isDealer = Math.random() < 0.35;
      const owner = isDealer ? pick(dealers) : pick(individuals);
      const priceMultiplier = isDealer ? 1.05 : 1.0;
      const price = randPrice(m.priceRange[0], m.priceRange[1]) * priceMultiplier;

      // Condição: novos apenas em lojas
      let condition: 'new' | 'used' | 'certified';
      if (isDealer && yearFab >= 2023 && Math.random() < 0.2) {
        condition = 'new';
      } else if (isDealer && yearFab >= 2021 && Math.random() < 0.25) {
        condition = 'certified';
      } else {
        condition = 'used';
      }

      const mileage = condition === 'new' ? 0 : randMileage(yearFab);

      const descriptions = [
        m.desc,
        `${m.brand} ${m.model} ${version} ${yearFab}/${yearModel}. Cor ${color}, ${mileage === 0 ? '0 km' : `${mileage.toLocaleString('pt-BR')} km`}. Aceito troca.`,
        `Lindo ${m.model} ${version}, muito bem conservado. IPVA pago, documentação ok. ${isDealer ? 'Financiamento facilitado.' : 'Vendo por motivo de viagem.'}`,
        `${condition === 'certified' ? 'Seminovo certificado. ' : ''}${m.brand} ${m.model} ${version} em excelente estado. ${mileage < 30000 ? 'Baixíssima quilometragem.' : 'Revisões em dia.'}`,
      ];

      const vehicle = await prisma.vehicle.create({
        data: {
          user_id:       owner.id,
          brand:         m.brand,
          model:         m.model,
          version,
          year_fab:      yearFab,
          year_model:    yearModel,
          mileage_km:    mileage,
          price,
          condition,
          description:   pick(descriptions),
          lat:           jitter(neighborhood.lat, 0.008),
          lng:           jitter(neighborhood.lng, 0.008),
          neighborhood:  neighborhood.name,
          city:          'São Paulo',
          state:         'SP',
          status:        Math.random() < 0.92 ? 'active' : (Math.random() < 0.5 ? 'paused' : 'sold'),
          features: {
            create: {
              transmission,
              fuel:           m.fuel,
              color,
              doors:          m.doors,
              ac:             yearFab >= 2018 || Math.random() < 0.85,
              power_steering: yearFab >= 2015 || Math.random() < 0.95,
              abs:            yearFab >= 2014 || Math.random() < 0.90,
              airbags:        yearFab >= 2020 ? rnd(4, 8) : rnd(2, 6),
            },
          },
        },
      });

      // Imagem
      const modelKey = `${m.brand}:${m.model}`;
      const urls = imageMap.get(modelKey) ?? [];
      if (urls.length > 0) {
        const imageUrl = pick(urls);
        await prisma.vehicleImage.create({
          data: {
            vehicle_id: vehicle.id,
            url:        imageUrl,
            order:      0,
            is_cover:   true,
          },
        });
      }

      count++;
      if (count % 50 === 0) {
        console.log(`   ${count}/500 veículos criados...`);
      }
    } catch (err) {
      errors.push(`${m.brand} ${m.model}: ${err}`);
    }
  }

  // ── 5. Resumo ────────────────────────────────────────────────
  console.log(`\n✅  Concluído! ${count} veículos criados.`);
  if (errors.length > 0) {
    console.warn(`⚠️  ${errors.length} erros:\n${errors.slice(0, 5).join('\n')}`);
  }

  // Contagem por modelo
  console.log('\n📊  Veículos por modelo:');
  const counts = await prisma.$queryRaw<{ brand: string; model: string; count: bigint }[]>`
    SELECT brand, model, COUNT(*) as count
    FROM vehicles
    GROUP BY brand, model
    ORDER BY count DESC
  `;
  for (const row of counts) {
    console.log(`   ${row.brand} ${row.model}: ${row.count}`);
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('❌ Erro fatal:', err);
  prisma.$disconnect();
  process.exit(1);
});
