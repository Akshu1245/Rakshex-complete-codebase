from openai import OpenAI

client = OpenAI()
response = client.chat.completions.create(
    model='claude-sonnet-4-6',
    messages=[
        {'role': 'system', 'content': 'You are a senior engineer. Reply with a concise diagnostic.'},
        {'role': 'user', 'content': 'Explain in one paragraph why a lockfile mismatch blocks CI.'},
    ],
    max_tokens=1200,
    extra_body={'thinking': {'type': 'enabled', 'budget_tokens': 512}},
)
print(response.model_dump_json(indent=2))
