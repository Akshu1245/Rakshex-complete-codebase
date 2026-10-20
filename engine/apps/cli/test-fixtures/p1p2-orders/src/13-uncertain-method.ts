// Options live in a variable: the HTTP method cannot be determined
// statically, so this must be UNKNOWN (never AFFECTED on a guess).
async function createOrder(item: string) {
    const opts = { method: "POST", body: JSON.stringify({ item }) };

    const response = await fetch("/v1/orders", opts);

    return response.json();
}
