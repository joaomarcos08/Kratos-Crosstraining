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
    const today = new Date('2026-03-06T12:00:00Z');
    const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const prevMonthDate = new Date(today);
    prevMonthDate.setMonth(today.getMonth() - 1);
    const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

    const { data: students } = await supabase.from('students').select('*').eq('is_active', true);
    const { data: payments } = await supabase.from('payments').select('*').in('reference_month', [currentMonthStr, prevMonthStr]).eq('status', 'paid');

    const currentDay = today.getDate();
    const defaulters = [];

    for (const student of students) {
        const hasPaidCurrentMonth = payments?.some(p => p.student_id === student.id && p.reference_month === currentMonthStr);
        const hasPaidPrevMonth = payments?.some(p => p.student_id === student.id && p.reference_month === prevMonthStr);

        if (hasPaidCurrentMonth) {
            continue;
        }

        if (student.due_day === currentDay) {
            defaulters.push({ ...student, delayType: 'day0' });
        } else if (student.due_day < currentDay) {
            defaulters.push({ ...student, delayType: 'day5' });
        } else {
            if (!hasPaidPrevMonth) {
                defaulters.push({ ...student, delayType: 'day5' });
            }
        }
    }

    console.log("DEFAULTERS:");
    console.table(defaulters.map(d => ({ name: d.name, delay: d.delayType })));
}

check();
