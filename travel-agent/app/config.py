import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    google_api_key: str

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()

# ADK reads GOOGLE_API_KEY directly from os.environ — export it there
os.environ["GOOGLE_API_KEY"] = settings.google_api_key
