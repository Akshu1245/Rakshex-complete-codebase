// Unrelated endpoint: must stay silent.
async function listProducts() {
    const response = await fetch("/v1/products", {
        method: "POST",
        body: JSON.stringify({})
    });

    return response.json();
}
