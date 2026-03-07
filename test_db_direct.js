const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
let NEXT_PUBLIC_SUPABASE_URL = '';
let SUPABASE_SERVICE_ROLE_KEY = '';

envFile.split('\n').forEach(line => {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) NEXT_PUBLIC_SUPABASE_URL = line.split('=')[1].trim().replace(/['"]/g, '');
    if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) SUPABASE_SERVICE_ROLE_KEY = line.split('=')[1].trim().replace(/['"]/g, '');
});

async function run() {
    console.log("Deletando pagamento indevido...");
    const payRes = await fetch(`${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/payments?id=eq.3818e246-0df6-4be5-b8b7-55ce1e9173b4`, {
        method: 'DELETE',
        headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
    });
    console.log("Delete status:", payRes.status);
}
run();
