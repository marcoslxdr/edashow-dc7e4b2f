/**
 * Script para gerar 5 novos posts no EdaShow (Supabase)
 *
 * Executa: npx ts-node scripts/seed-5-posts.ts
 *
 * Requer .env.local com:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Erro: Variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são necessárias.')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// IDs das categorias existentes no banco
const CATEGORIES = {
    TECNOLOGIA: '2e1bcd33-0908-4f82-a838-6e852ccf569a',
    SAUDE_SUPLEMENTAR: '387d669a-6499-4850-832e-76b7b7127b97',
    SAUDE_DIGITAL: '38c0a6d9-f2b8-4319-88a3-defb2e3f557b',
    TELEMEDICINA: 'b70e109c-c550-4296-bf02-866252441742',
    INOVACAO: '0bf10001-30ce-4eff-bad8-0f40c2d13b35',
    NOTICIAS: '1ed2d554-f922-4d7e-9769-0637cff30d28',
}

// IDs dos colunistas existentes no banco
const COLUMNISTS = {
    DR_CARLOS_SILVA: '47f8ff64-c65a-43a4-a738-ac756e9577d3',
    MARIA_SANTOS: 'b603fd31-f6b3-4b95-86a6-d1f62526c0f4',
    DRA_ANA_CAROLINA: '04d9e883-b4c6-4288-80a0-ddfdf050d30b',
}

const newPosts = [
    {
        title: 'Robótica Cirúrgica: Precisão Milimétrica Salva Vidas',
        slug: 'robotica-cirurgica-precisao-milimetrica-salva-vidas',
        subtitle: 'Sistemas robóticos de última geração permitem cirurgias minimamente invasivas com recuperação até 50% mais rápida.',
        content: `<p>A robótica cirúrgica está vivendo sua era de ouro no Brasil. Em 2026, mais de 150 hospitais já utilizam sistemas robóticos para procedimentos complexos em urologia, ginecologia, cirurgia cardíaca e oncologia.</p>

<p>Os benefícios são comprovados: menor tempo de internação, menos dor pós-operatória, cicatrizes mínimas e recuperação significativamente mais rápida. Pacientes que antes precisavam de semanas de repouso agora retornam às atividades em poucos dias.</p>

<p>O investimento em robótica também representa uma mudança de paradigma na formação médica. Universidades já incluem simuladores robóticos em seus currículos, preparando a próxima geração de cirurgiões para um futuro cada vez mais tecnológico.</p>

<p>Apesar do custo elevado dos equipamentos, a redução no tempo de internação e nas complicações pós-operatórias torna a tecnologia economicamente viável a médio prazo. A tendência é que, nos próximos cinco anos, a robótica se torne padrão para cirurgias eletivas de média e alta complexidade.</p>`,
        excerpt: 'Hospitais brasileiros ampliam uso de robôs cirúrgicos com resultados impressionantes em recuperação e precisão.',
        category_id: CATEGORIES.INOVACAO,
        columnist_id: COLUMNISTS.DRA_ANA_CAROLINA,
        cover_image_url: '/images/posts/robotica_cirurgica.png',
        status: 'published',
        featured: true,
    },
    {
        title: 'Planos de Saúde Populares: Nova Regulamentação Gera Debate',
        slug: 'planos-saude-populares-nova-regulamentacao-debate',
        subtitle: 'ANS abre consulta pública para definir regras dos planos acessíveis que prometem ampliar a cobertura no Brasil.',
        content: `<p>A proposta de criação de planos de saúde populares voltou ao centro do debate no setor de saúde suplementar. A ANS abriu consulta pública para receber contribuições da sociedade sobre o modelo que pretende democratizar o acesso à saúde privada.</p>

<p>O novo formato prevê planos com cobertura regional, rede credenciada reduzida e coparticipação do beneficiário. A meta é oferecer mensalidades a partir de R$ 100, tornando os planos acessíveis para a classe média que hoje depende exclusivamente do SUS.</p>

<p>Operadoras se dividem sobre a viabilidade do modelo. Enquanto grandes grupos veem oportunidade de crescimento, operadoras menores temem a pressão sobre margens já apertadas. Associações de defesa do consumidor alertam para o risco de planos com cobertura insuficiente.</p>

<p>O Conselho Federal de Medicina reforça que qualquer modelo deve garantir padrões mínimos de qualidade assistencial. A expectativa é que a regulamentação final seja publicada até o segundo semestre de 2026.</p>`,
        excerpt: 'Debate sobre planos populares esquenta com consulta pública da ANS e posições divergentes do setor.',
        category_id: CATEGORIES.SAUDE_SUPLEMENTAR,
        columnist_id: COLUMNISTS.MARIA_SANTOS,
        cover_image_url: '/images/posts/planos_populares.png',
        status: 'published',
        featured: false,
    },
    {
        title: 'Healthtechs Brasileiras Captam R$ 2 Bilhões em 2025',
        slug: 'healthtechs-brasileiras-captam-2-bilhoes-2025',
        subtitle: 'Ecossistema de inovação em saúde do Brasil se consolida como o maior da América Latina.',
        content: `<p>O ecossistema de healthtechs brasileiras encerrou 2025 com uma marca expressiva: R$ 2 bilhões em investimentos captados ao longo do ano, consolidando o Brasil como líder em inovação em saúde na América Latina.</p>

<p>As áreas que mais atraíram investimento foram telemedicina (28%), gestão hospitalar com IA (22%), diagnóstico digital (18%) e saúde mental (15%). Startups focadas em wearables e monitoramento remoto também se destacaram.</p>

<p>Entre os casos de sucesso, uma startup paulista de diagnóstico por imagem com inteligência artificial alcançou status de unicórnio após rodada de US$ 200 milhões. Outra empresa, especializada em prontuário eletrônico integrado, expandiu operações para seis países.</p>

<p>Analistas apontam que a pandemia acelerou em pelo menos cinco anos a digitalização do setor, e que o momento atual representa uma janela de oportunidade única para empreendedores de saúde. O desafio agora é escalar soluções mantendo a qualidade e a segurança dos dados dos pacientes.</p>`,
        excerpt: 'Investimento recorde em startups de saúde consolida Brasil como hub de inovação no setor.',
        category_id: CATEGORIES.TECNOLOGIA,
        columnist_id: COLUMNISTS.DR_CARLOS_SILVA,
        cover_image_url: '/images/posts/healthtechs_brasil.png',
        status: 'published',
        featured: false,
    },
    {
        title: 'Teleconsulta Psiquiátrica: Saúde Mental ao Alcance de Todos',
        slug: 'teleconsulta-psiquiatrica-saude-mental-alcance-todos',
        subtitle: 'Atendimento remoto em psiquiatria cresce 120% e reduz tempo de espera de meses para dias.',
        content: `<p>A teleconsulta psiquiátrica vem transformando o acesso à saúde mental no Brasil. Dados do Conselho Federal de Medicina mostram um crescimento de 120% nos atendimentos remotos em psiquiatria no último ano, beneficiando especialmente pacientes em regiões com escassez de especialistas.</p>

<p>Antes da popularização da telemedicina, pacientes em cidades do interior esperavam meses por uma consulta presencial com psiquiatra. Agora, plataformas digitais conectam profissionais qualificados a pacientes em todo o país, com tempo médio de agendamento de apenas cinco dias.</p>

<p>Estudos publicados na Revista Brasileira de Psiquiatria demonstram que a eficácia da teleconsulta é comparável à presencial para acompanhamento de transtornos como depressão, ansiedade e TDAH. A modalidade também aumentou a adesão ao tratamento em 35%.</p>

<p>O próximo passo é a integração com dispositivos de monitoramento de humor e sono, criando um ecossistema completo de cuidado em saúde mental que combina tecnologia e humanização do atendimento.</p>`,
        excerpt: 'Atendimento psiquiátrico remoto cresce exponencialmente e democratiza acesso à saúde mental no país.',
        category_id: CATEGORIES.TELEMEDICINA,
        columnist_id: COLUMNISTS.DR_CARLOS_SILVA,
        cover_image_url: '/images/posts/teleconsulta_psiquiatrica.png',
        status: 'published',
        featured: false,
    },
    {
        title: 'Prontuário Eletrônico Nacional: O Desafio da Interoperabilidade',
        slug: 'prontuario-eletronico-nacional-desafio-interoperabilidade',
        subtitle: 'Governo federal avança no projeto de unificação dos registros de saúde com padrão FHIR.',
        content: `<p>O Ministério da Saúde anunciou avanços significativos no projeto do Prontuário Eletrônico Nacional, uma iniciativa ambiciosa que pretende unificar os registros de saúde de mais de 200 milhões de brasileiros em uma plataforma interoperável.</p>

<p>O projeto adota o padrão internacional FHIR (Fast Healthcare Interoperability Resources), permitindo que sistemas de hospitais públicos, clínicas privadas e operadoras de planos de saúde compartilhem informações de forma segura e padronizada.</p>

<p>A fase piloto, iniciada em cinco capitais brasileiras, já conectou 500 unidades de saúde e registrou mais de 2 milhões de prontuários. Os primeiros resultados mostram redução de 40% na duplicação de exames e melhoria na continuidade do cuidado para pacientes que transitam entre diferentes serviços.</p>

<p>O principal desafio técnico permanece a integração com os milhares de sistemas legados em uso no país. O governo estima que a implementação completa levará até 2028, mas os benefícios parciais já justificam o investimento de R$ 800 milhões previsto para o programa.</p>`,
        excerpt: 'Projeto ambicioso de prontuário unificado avança com padrão FHIR e promete revolucionar a gestão de dados em saúde.',
        category_id: CATEGORIES.SAUDE_DIGITAL,
        columnist_id: COLUMNISTS.DRA_ANA_CAROLINA,
        cover_image_url: '/images/posts/prontuario_eletronico.png',
        status: 'published',
        featured: true,
    },
]

async function seed() {
    console.log('🌱 Iniciando inserção de 5 novos posts no EdaShow...\n')

    // Primeiro, verificar se as categorias e colunistas existem
    const { data: catCheck } = await supabase.from('categories').select('id').limit(1)
    if (!catCheck || catCheck.length === 0) {
        console.error('⚠️  Nenhuma categoria encontrada. Verifique se o banco está populado.')
        console.log('   Tentando inserir mesmo assim...\n')
    }

    let successCount = 0

    for (const post of newPosts) {
        const { error } = await supabase
            .from('posts')
            .insert([{
                ...post,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                published_at: new Date().toISOString(),
            }])

        if (error) {
            console.error(`❌ Erro ao inserir "${post.title}":`, error.message)
        } else {
            successCount++
            console.log(`✅ Post inserido: "${post.title}"`)
        }
    }

    console.log(`\n✨ Processo concluído! ${successCount}/${newPosts.length} posts inseridos com sucesso.`)
    console.log('🔗 Acesse seu site para ver os novos posts!')
}

seed()
