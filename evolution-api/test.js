const urlCreate = "http://localhost:8080/instance/create";
const urlConnect = "http://localhost:8080/instance/connect/kratos_v1";
const urlState = "http://localhost:8080/instance/connectionState/kratos_v1";
const apiKey = "apikey_kratos_global_mvp_2024";

async function main() {
    console.log("Creating instance...");
    const resCreate = await fetch(urlCreate, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "apikey": apiKey
        },
        body: JSON.stringify({
            instanceName: "kratos_v1",
            integration: "WHATSAPP-BAILEYS",
            qrcode: true
        })
    });

    const createData = await resCreate.json();
    console.log("Create Response:", createData);

    for (let i = 1; i <= 8; i++) {
        console.log(`\n--- Attempt ${i} - Waiting 5 seconds ---`);
        await new Promise(r => setTimeout(r, 5000));

        const resState = await fetch(urlState, { headers: { "apikey": apiKey } });
        console.log("State:", await resState.json());

        console.log("Fetching QR code...");
        const resConnect = await fetch(urlConnect, {
            method: "GET",
            headers: { "apikey": apiKey }
        });

        const connectData = await resConnect.json();
        console.log("Connect Response:", JSON.stringify(connectData, null, 2));

        if (connectData.base64 || (connectData.qrcode && connectData.qrcode.base64)) {
            console.log(`✅ Base64 QR code acquired successfully on attempt ${i}!`);
            return;
        }
    }
    console.log("❌ Base64 not found after polling.");
}

main().catch(console.error);
