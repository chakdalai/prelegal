---
name: cerebras
description: Use this to write code to call an LLM using LiteLLM and OpenRouter with Cerebras inference provider
---

# Calling an LLM via Cerebras

These instructions allow you write code to call an LLM with Cerebras specified as the inference provider.
This method uses LiteLLM and OpenRouter.

## Setup

The OPENROUTER_API_KEY must be set in the .env file and loaded in as an environment variable.
LiteLLM picks it up from the environment for any `openrouter/` model, so no api_base is needed.

The uv project must include litellm and pydantic.
`uv add litellm pydantic`

## Code snippets

Use code like these examples in order to use Cerebras.

### Imports and constants

```python
from litellm import completion

MODEL = "openrouter/openai/gpt-oss-120b"

EXTRA_BODY = {
    "provider": {
        # Provider slugs are lowercase and case-sensitive.
        "order": ["cerebras"],
        # `order` on its own is only a preference: OpenRouter serves the request
        # from a different provider when Cerebras is unavailable, and returns 200
        # without saying so. This pins it, so an outage raises instead.
        "allow_fallbacks": False,
        # Refuses to route to a provider that does not support every parameter
        # sent, rather than silently dropping it. This is what keeps
        # response_format honoured — without it a structured request can come
        # back as prose.
        "require_parameters": True,
    }
}
```

### Code to call via Cerebras for a text response

```python
response = completion(
    model=MODEL,
    messages=messages,
    reasoning_effort="low",
    extra_body=EXTRA_BODY,
)
result = response.choices[0].message.content
```

### Code to call via Cerebras for a Structured Outputs response

```python
response = completion(
    model=MODEL,
    messages=messages,
    response_format=MyBaseModelSubclass,
    reasoning_effort="low",
    extra_body=EXTRA_BODY,
)
result = response.choices[0].message.content
result_as_object = MyBaseModelSubclass.model_validate_json(result)
```

`response_format` takes the Pydantic class itself and LiteLLM converts it to a JSON schema. The
content still arrives as a JSON string, so parse it with `model_validate_json` rather than
reading fields off the message directly.
