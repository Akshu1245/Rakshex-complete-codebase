import unittest
from production_entrypoint import validate_config


class ProductionConfigTests(unittest.TestCase):
    def setUp(self):
        self.config = {
            "JWT_SECRET": "a" * 64,
            "DEVPULSE_ENCRYPTION_KEY": "persistent-key",
            "DATABASE_URL": "postgresql://user:password@db.example/app",
            "FRONTEND_URL": "https://app.example",
        }

    def test_valid_config(self):
        validate_config(self.config)

    def test_missing_required_values_are_rejected(self):
        for name in self.config:
            with self.subTest(name=name):
                config = dict(self.config)
                config.pop(name)
                with self.assertRaises(RuntimeError):
                    validate_config(config)

    def test_temporary_database_rejected(self):
        self.config["DATABASE_URL"] = "sqlite+aiosqlite:///app.db"
        with self.assertRaises(RuntimeError):
            validate_config(self.config)

    def test_default_signing_secret_rejected(self):
        self.config["JWT_SECRET"] = "devpulse-secret-key-change-in-production"
        with self.assertRaises(RuntimeError):
            validate_config(self.config)


if __name__ == "__main__":
    unittest.main()
