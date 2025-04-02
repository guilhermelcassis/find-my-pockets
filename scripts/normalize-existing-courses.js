/**
 * Script para normalizar cursos de líderes já existentes no banco de dados
 * 
 * Execute: node scripts/normalize-existing-courses.js
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const { normalizeCourse } = require('./normalize-courses');

// Carregar variáveis de ambiente
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Inicializar cliente Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Credenciais do Supabase não encontradas no arquivo .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function normalizeExistingCourses() {
  try {
    // Buscar todos os líderes
    const { data: leaders, error } = await supabase
      .from('leaders')
      .select('*');
    
    if (error) {
      throw error;
    }
    
    console.log(`Encontrados ${leaders.length} líderes no banco de dados`);
    
    // Mapear cursos atuais e normalizados
    const updates = [];
    const courseMapping = {};
    
    for (const leader of leaders) {
      if (leader.curso) {
        const normalizedCourse = normalizeCourse(leader.curso);
        
        // Se o curso já estiver normalizado, pule
        if (normalizedCourse === leader.curso) {
          continue;
        }
        
        courseMapping[leader.curso] = normalizedCourse;
        
        // Adicionar à lista de atualizações
        updates.push({
          id: leader.id,
          curso: normalizedCourse
        });
      }
    }
    
    // Mostrar mapeamento de cursos
    console.log('\nMapeamento de cursos:');
    Object.entries(courseMapping).forEach(([original, normalized]) => {
      console.log(`"${original}" => "${normalized}"`);
    });
    
    if (updates.length === 0) {
      console.log('\nTodos os cursos já estão normalizados!');
      return;
    }
    
    console.log(`\n${updates.length} cursos precisam ser atualizados.`);
    console.log('Pressione Ctrl+C para cancelar ou qualquer tecla para continuar...');
    
    // Aguardar confirmação do usuário
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', async () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      
      try {
        // Atualizar cada registro individualmente
        let successCount = 0;
        
        for (const update of updates) {
          const { error } = await supabase
            .from('leaders')
            .update({ curso: update.curso })
            .eq('id', update.id);
          
          if (error) {
            console.error(`Erro ao atualizar líder ${update.id}:`, error);
          } else {
            successCount++;
          }
        }
        
        console.log(`Atualização concluída! ${successCount} de ${updates.length} cursos foram normalizados.`);
        process.exit(0);
      } catch (error) {
        console.error('Erro ao atualizar cursos:', error);
        process.exit(1);
      }
    });
    
  } catch (error) {
    console.error('Erro ao processar normalização de cursos:', error);
    process.exit(1);
  }
}

normalizeExistingCourses(); 