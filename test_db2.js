const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
envFile.split(/\r?\n/).forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) envVars[match[1].trim()] = match[2].trim();
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: students } = await supabase.from('students').select('*');
    const { data: payments } = await supabase.from('payments').select('*');

    fs.writeFileSync('test_db_out.json', JSON.stringify({ students: students.map(s => ({ id: s.id, name: s.name, due_day: s.due_day })), payments: payments.map(p => ({ id: p.id, student_id: p.student_id, month: p.reference_month })) }, null, 2));
    console.log("Done");
}

check();
