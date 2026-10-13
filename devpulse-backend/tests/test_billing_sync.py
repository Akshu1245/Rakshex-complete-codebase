import hashlib
import hmac
import json
import time
from types import SimpleNamespace
import pytest
from services.db_config import AsyncSessionLocal
from models.tables import User
from services.billing_sync import apply_verified_event
from tests.test_wiring import signup


@pytest.mark.asyncio
async def test_verified_billing_sync_is_durable_and_replay_safe(client):
    data, headers = await signup(client)
    async with AsyncSessionLocal() as session:
        user = await session.get(User, data['user']['id'])
        user.stripe_customer_id = 'cus_test'
        await session.commit()
    provider = SimpleNamespace(Subscription=SimpleNamespace(retrieve=lambda _: {
        'customer': 'cus_test', 'status': 'active', 'items': {'data': [{'price': {'id': 'price_test'}}]}}))
    event = {'id': 'evt_replay', 'type': 'checkout.session.completed', 'data': {'object': {'customer': 'cus_test', 'subscription': 'sub_test'}}}
    assert (await apply_verified_event(event, provider, {'pro_monthly': 'price_test'}))['plan'] == 'pro'
    assert (await apply_verified_event(event, provider, {'pro_monthly': 'price_test'}))['duplicate'] is True
    assert (await client.get('/api/billing/status', headers=headers)).json()['plan'] == 'pro'
    history = (await client.get('/api/billing/history', headers=headers)).json()['history']
    assert len(history) == 1


@pytest.mark.asyncio
async def test_billing_webhook_requires_signature_and_updates_after_verification(client, monkeypatch):
    from routes import billing
    from services import stripe_billing
    data, headers = await signup(client)
    async with AsyncSessionLocal() as session:
        user = await session.get(User, data['user']['id'])
        user.stripe_customer_id = 'cus_signed'
        await session.commit()
    for module in (billing, stripe_billing):
        monkeypatch.setattr(module, 'STRIPE_SECRET_KEY', 'sk_test_unit_only')
        monkeypatch.setattr(module, 'STRIPE_WEBHOOK_SECRET', 'unit_webhook_secret')
    monkeypatch.setattr(stripe_billing, 'STRIPE_PRICE_IDS', {'pro_monthly': 'price_test'})
    monkeypatch.setattr(stripe_billing.stripe.Subscription, 'retrieve', lambda _: {'customer': 'cus_signed', 'status': 'active', 'items': {'data': [{'price': {'id': 'price_test'}}]}})
    body = json.dumps({'id': 'evt_signed', 'type': 'checkout.session.completed', 'data': {'object': {'customer': 'cus_signed', 'subscription': 'sub_signed'}}})
    assert (await client.post('/api/billing/webhook', content=body, headers={'stripe-signature': 'invalid'})).status_code == 400
    assert (await client.get('/api/billing/status', headers=headers)).json()['plan'] == 'free'
    timestamp = str(int(time.time()))
    signature = hmac.new(b'unit_webhook_secret', (timestamp + '.' + body).encode(), hashlib.sha256).hexdigest()
    response = await client.post('/api/billing/webhook', content=body, headers={'stripe-signature': f't={timestamp},v1={signature}'})
    assert response.status_code == 200, response.text
    assert (await client.get('/api/billing/status', headers=headers)).json()['plan'] == 'pro'
