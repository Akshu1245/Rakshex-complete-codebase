async function createOrder(item: string) {
    const response = await fetch("/v1/orders", {
        method: "POST",
        body: JSON.stringify({ item })
    });

    return response.json();
}
