"""Secrets for one Worker request, never copied into global environment state."""
from contextvars import ContextVar

runtime_secrets = ContextVar('runtime_secrets', default=None)
runtime_bindings = ContextVar('runtime_bindings', default=None)


def required_secret(name):
    config = runtime_secrets.get()
    if not config or not config.get(name):
        raise RuntimeError('Worker runtime configuration is unavailable')
    return config[name]


def required_binding(name):
    bindings = runtime_bindings.get()
    if not bindings:
        raise RuntimeError('Worker bindings are unavailable')
    return getattr(bindings, name)
