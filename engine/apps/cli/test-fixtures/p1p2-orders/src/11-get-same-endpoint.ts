// GET request to the SAME endpoint: the event is about POST /v1/orders,
// so this must stay silent (method mismatch, not an affected call).
async function listOrders() {
    const response = await fetch("/v1/orders");

    return response.json();
}
