import axios from "axios";

async function createOrder(item: string) {
    const response = await axios.post("/v1/orders", { item });
    return response.data;
}
