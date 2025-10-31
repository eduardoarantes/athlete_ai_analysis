Thing to do:

- Remove the creation of default config (remove the invoquation and code). If config doesn't exist it should fail.
    - create a sample config file
    - loader.py:58      
        if not config_path.exists():
        # Create default config
        return create_default_config(config_path)
    - loader.py:77 
        def create_default_config(config_path: Path) -> CyclingAIConfig:

- remove hard coded values. It should be on the config. If not fail
    - generate.py: 460
    if not model:
        # Fallback defaults
        defaults = {
            "openai": "gpt-4-turbo-2024-04-09",
            "anthropic": "claude-3-5-sonnet-20241022",
            "gemini": "gemini-2.5-flash",
            "ollama": "llama3.2:3b",
        }

- also no defaults for the code below. It should fail
    - generate.py: 477
    # Fallback to environment variable
    if not api_key:
        env_var_map = {
            "openai": "OPENAI_API_KEY",
            "anthropic": "ANTHROPIC_API_KEY",
            "gemini": "GOOGLE_API_KEY",
            "ollama": "",  # Local, no key needed
        }
        env_var = env_var_map.get(provider_name, "")
        if env_var:
            api_key = os.getenv(env_var, "")

    # Validate API key for non-local providers
    if not api_key and provider_name != "ollama":
        env_var_map = {
            "openai": "OPENAI_API_KEY",
            "anthropic": "ANTHROPIC_API_KEY",
            "gemini": "GOOGLE_API_KEY",
            "ollama": "",
        }
        env_var = env_var_map.get(provider_name, "")
        raise ValueError(
            f"API key not found for {provider_name}. "
            f"Please set {env_var} environment variable or configure in config file."
        )

- the default prompt version should come from .cycling-ai.yaml. Fail if not present