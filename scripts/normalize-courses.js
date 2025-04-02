/**
 * Script para normalizar nomes de cursos
 * 
 * Este script pode ser usado independentemente ou importado pelo scripts/import-leaders.js
 */

// Função para limpar e normalizar texto
function cleanText(text) {
  if (!text) return '';
  
  // Converter para minúsculas e remover espaços extras
  return text.toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\.$/, ''); // Remove ponto final
}

// Mapeamento de cursos - mapeie variações para um nome padrão
const courseMapping = {
  // Psicologia e variantes
  'psicologia': 'Psicologia',
  'psi': 'Psicologia',

  // Engenharias
  'engenharia civil': 'Engenharia Civil',
  'engenharia da computação': 'Engenharia da Computação',
  'engenharia de computação': 'Engenharia da Computação',
  'ciência da computação': 'Ciências da Computação',
  'ciências da computação': 'Ciências da Computação',
  'computação': 'Ciências da Computação',
  'engenharia mecânica': 'Engenharia Mecânica',
  'engenharia elétrica': 'Engenharia Elétrica',
  'engenharia mecanica': 'Engenharia Mecânica',
  'engenharia química': 'Engenharia Química',
  'engenharia quimica': 'Engenharia Química',
  'engenharia de materiais': 'Engenharia de Materiais',
  'engenharia ambiental': 'Engenharia Ambiental',
  'eng. mecanica': 'Engenharia Mecânica',
  'eng mecanica': 'Engenharia Mecânica',
  'engenharia de controle e automação': 'Engenharia de Controle e Automação',
  'engenharia naval': 'Engenharia Naval',
  'engenharia de produção': 'Engenharia de Produção',
  'engenharia aeroespacial': 'Engenharia Aeroespacial',
  'engenharia biomédica': 'Engenharia Biomédica',
  'engenharia física': 'Engenharia Física',
  'engenharia agronômica': 'Engenharia Agronômica',
  'engenharia agronomica': 'Engenharia Agronômica',
  
  // Direito
  'direito': 'Direito',
  
  // Medicina e área da saúde
  'medicina': 'Medicina',
  'odontologia': 'Odontologia',
  'farmácia': 'Farmácia',
  'farmacia': 'Farmácia',
  'enfermagem': 'Enfermagem',
  'fisioterapia': 'Fisioterapia',
  'biomedicina': 'Biomedicina',
  'terapia ocupacional': 'Terapia Ocupacional',
  'medicina veterinaria': 'Medicina Veterinária',
  'medicina veterinária': 'Medicina Veterinária',
  'nutrição': 'Nutrição',
  'nutricao': 'Nutrição',
  'nutrição e metabolismo': 'Nutrição',

  // Administração e Negócios
  'administração': 'Administração',
  'administracao': 'Administração',
  'adm': 'Administração',
  'adm foco em empreendedorismo': 'Administração',
  'administração pública': 'Administração Pública',
  'ciências contábeis': 'Ciências Contábeis',
  'ciencias contabeis': 'Ciências Contábeis',
  'contábeis': 'Ciências Contábeis',
  'contabeis': 'Ciências Contábeis',
  'economia': 'Ciências Econômicas',
  'ciências econômicas': 'Ciências Econômicas',
  'ciencias economicas': 'Ciências Econômicas',
  'gestão comercial': 'Gestão Comercial',
  'marketing': 'Marketing',
  'publicidade e propaganda': 'Publicidade e Propaganda',
  'publicidade, propaganda e marketing': 'Publicidade e Propaganda',
  'propaganda e marketing': 'Publicidade e Propaganda',
  'publicidade': 'Publicidade e Propaganda',
  'comunicação social - publicidade e propaganda': 'Publicidade e Propaganda',
  'comunicação social hab. publicidade e propaganda': 'Publicidade e Propaganda',

  // Ciências Humanas
  'filosofia': 'Filosofia',
  'pedagogia': 'Pedagogia',
  'licenciatura em pedagogia': 'Pedagogia',
  'serviço social': 'Serviço Social',
  'servico social': 'Serviço Social',
  'antropologia': 'Antropologia',
  'geografia': 'Geografia',
  'bacharelado em geografia': 'Geografia',
  'licenciatura em geografia': 'Geografia',
  'história': 'História',
  'historia': 'História',
  'licenciatura em matemática': 'Matemática',
  'licenciatura em matematica': 'Matemática',
  'matemática': 'Matemática',
  'matematica': 'Matemática',
  'letras': 'Letras',
  'letras - português/literaturas': 'Letras',
  'letras - língua inglesa': 'Letras',
  'letras - lingua inglesa': 'Letras',
  
  // Artes e Design
  'arquitetura': 'Arquitetura e Urbanismo',
  'arquitetura e urbanismo': 'Arquitetura e Urbanismo',
  'design': 'Design',
  'design grafico': 'Design Gráfico',
  'design gráfico': 'Design Gráfico',
  'design de moda': 'Design de Moda',
  'moda': 'Design de Moda',
  'fotografia': 'Fotografia',
  'artes visuais': 'Artes Visuais',
  'licenciatura em artes visuais': 'Artes Visuais',
  
  // Comunicação
  'jornalismo': 'Jornalismo',
  'rádio, tv e internet': 'Rádio, TV e Internet',
  'radio, tv e internet': 'Rádio, TV e Internet',
  'relações públicas': 'Relações Públicas',
  'relacoes publicas': 'Relações Públicas',
  'comunicação social': 'Comunicação Social',

  // TI e Computação
  'análise e desenvolvimento de sistemas': 'Análise e Desenvolvimento de Sistemas',
  'analise e desenvolvimento de sistemas': 'Análise e Desenvolvimento de Sistemas',
  'segurança da informação': 'Segurança da Informação',
  'sistemas de informação': 'Sistemas de Informação',
  'ti': 'Tecnologia da Informação',
  'tecnologia da informação': 'Tecnologia da Informação',

  // Ciências Biológicas e Exatas
  'ciências biológicas': 'Ciências Biológicas',
  'ciencias biologicas': 'Ciências Biológicas',
  'biologia': 'Ciências Biológicas',
  'biologia com ênfase em biotecnologia e produção': 'Biotecnologia',
  'biotecnologia': 'Biotecnologia',
  'física': 'Física',
  'fisica': 'Física',
  'bacharelado em física': 'Física',
  'química': 'Química',
  'quimica': 'Química',
  'bacharelado em química': 'Química',
  'licenciatura em química': 'Química',
  'licenciatura e bacharelado em química': 'Química',
  'doutorado em química': 'Química (Doutorado)',
  
  // Educação Física
  'educação física': 'Educação Física',
  'educacao fisica': 'Educação Física',
  'ciências do esporte': 'Ciências do Esporte',
  'ciencias do esporte': 'Ciências do Esporte',

  // Interdisciplinares
  'interdisciplinar em ciência e tecnologia': 'Interdisciplinar em Ciência e Tecnologia',
  'bacharelado interdisciplinar em humanidades': 'Interdisciplinar em Humanidades',
};

// Função principal para normalizar o nome do curso
function normalizeCourse(course) {
  if (!course) return '';
  
  // Limpar e normalizar o texto
  const cleanedCourse = cleanText(course);
  
  // Verificar no mapeamento
  if (courseMapping[cleanedCourse]) {
    return courseMapping[cleanedCourse];
  }
  
  // Se não encontrou correspondência exata, tente encontrar o mais próximo
  for (const key in courseMapping) {
    if (cleanedCourse.includes(key) || key.includes(cleanedCourse)) {
      return courseMapping[key];
    }
  }
  
  // Se não encontrou equivalente, formatar apenas a primeira letra maiúscula
  return course.trim().charAt(0).toUpperCase() + course.trim().slice(1);
}

// Exportar a função para ser usada em outros scripts
module.exports = {
  normalizeCourse
};

// Se executado diretamente (para testes)
if (require.main === module) {
  const testCourses = [
    'psicologia',
    'Psicologia',
    'PSICOLOGIA',
    'Engenharia Civil',
    'eng. mecânica',
    'DIREITO',
    'Medicina',
    'administração',
    'ADM',
    'ciências contábeis',
    'Enfermagem',
    'nutrição e metabolismo',
    'PUBLICIDADE E PROPAGANDA',
    'Arquitetura e Urbanismo',
    'Design de Moda',
    'Análise e desenvolvimento de sistemas',
    'Ciências Biológicas',
    'EDUCAÇÃO FÍSICA',
    'Licenciatura em Artes Visuais',
    'Letras - português/Literaturas',
    'Interdisciplinar em ciência e tecnologia',
  ];
  
  console.log('Teste de normalização de cursos:');
  testCourses.forEach(course => {
    console.log(`"${course}" => "${normalizeCourse(course)}"`);
  });
} 