require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data: students } = await supabase.from('students').select('*').eq('is_active', true);
    console.log("=== ALUNOS ATIVOS ===");
    console.log(students.map(s => ({ id: s.id, name: s.name, due_day: s.due_day })));

    const { data: payments } = await supabase.from('payments').select('*').in('reference_month', ['2026-02', '2026-03']);
    console.log("\n=== PAGAMENTOS FEV/MAR ===");
    console.log(payments.map(p => ({ 
        id: p.id, 
        student_id: p.student_id, 
        reference_month: p.reference_month, 
        status: p.status 
    })));
}
run();
