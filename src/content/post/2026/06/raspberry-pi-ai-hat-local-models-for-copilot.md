---
title: "Unlimited Copilot Running with Local Models on a Raspberry Pi (Yes, really)"
date: 2026-06-25T16:40:00.000Z
images:
  - "/images/image-placeholder.png"
author: "Martin Woodward"
description: "A practical walkthrough for running qwen2.5-coder:1.5b on Raspberry Pi AI HAT+ 2 and wiring it up to GitHub Copilot CLI with a local OpenAI-compatible endpoint."
categories: ["ai", "maker", "programming", "github", "technology"]
tags: ["raspberry-pi", "hailo", "copilot-cli", "local-llm", "qwen", "ai-hat"]
type: "regular"
blueskyPostURI: ""
draft: true
---

Ever wanted to run a coding model locally on a tiny low-power box and still use your usual Copilot workflow? This evening I've been tinkering with exactly that, using a Raspberry Pi + AI HAT+ 2 (Hailo-10H), and it's rather special.

The bit that made me genuinely excited: **GitHub Copilot CLI runs natively on Raspberry Pi**, so the whole stack can stay local on ARM without any weird remote jump boxes.

## What this post covers

We'll set up:

1. Hailo runtime and model server on Raspberry Pi
2. `qwen2.5-coder:1.5b` as the coding model
3. A local OpenAI-compatible endpoint
4. GitHub Copilot CLI configured to use that local model

## Hardware shopping list

There are cheaper ways to achieve some of the same results, but this combo is pretty handy and straightforward.

| Item | US | UK |
|---|---|---|
| Raspberry Pi 5 (8GB recommended) | [Amazon US](https://www.amazon.com/dp/PLACEHOLDER_PI5?tag=woodweb03-20) | [Amazon UK](https://www.amazon.co.uk/dp/PLACEHOLDER_PI5?tag=woodweb03-20) |
| Raspberry Pi AI HAT+ 2 (Hailo-10H) | [Amazon US](https://www.amazon.com/dp/PLACEHOLDER_AIHAT2?tag=woodweb03-20) | [Amazon UK](https://www.amazon.co.uk/dp/PLACEHOLDER_AIHAT2?tag=woodweb03-20) |
| Official Pi Power Supply | [Amazon US](https://www.amazon.com/dp/PLACEHOLDER_PSU?tag=woodweb03-20) | [Amazon UK](https://www.amazon.co.uk/dp/PLACEHOLDER_PSU?tag=woodweb03-20) |
| Active Cooler / Case | [Amazon US](https://www.amazon.com/dp/PLACEHOLDER_COOLING?tag=woodweb03-20) | [Amazon UK](https://www.amazon.co.uk/dp/PLACEHOLDER_COOLING?tag=woodweb03-20) |
| NVMe HAT or fast SD storage | [Amazon US](https://www.amazon.com/dp/PLACEHOLDER_STORAGE?tag=woodweb03-20) | [Amazon UK](https://www.amazon.co.uk/dp/PLACEHOLDER_STORAGE?tag=woodweb03-20) |

## Step 1: Install Hailo runtime and drivers

```bash
sudo apt-get update
sudo apt-get install -y h10-hailort h10-hailort-pcie-driver hailo-h10-all
hailortcli scan
```

You should see your Hailo device listed.

## Step 2: Install Hailo Model Zoo GenAI (`hailo-ollama`)

Thanks to the amazing work by the Hailo team, you can run an Ollama-compatible local API on top of HailoRT.

```bash
sudo apt-get install -y git cmake build-essential curl jq libssl-dev
git clone https://github.com/hailo-ai/hailo_model_zoo_genai.git
cd hailo_model_zoo_genai
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release -j"$(nproc)"
sudo cmake --install build
```

Start the server:

```bash
hailo-ollama
```

In another terminal, list models:

```bash
curl --silent http://localhost:8000/hailo/v1/list | jq
```

On my Pi, this currently returns:

```json
{
  "models": [
    "deepseek_r1:1.5b",
    "llama3.2:1b",
    "manifests:qwen3",
    "qwen2.5-coder:1.5b",
    "qwen2.5:1.5b",
    "qwen2:1.5b"
  ]
}
```

## Step 3: Pull the coding model we want

We're using **`qwen2.5-coder:1.5b`** for this setup.

```bash
curl --silent http://localhost:8000/api/pull \
  -H 'Content-Type: application/json' \
  -d '{ "model": "qwen2.5-coder:1.5b", "stream": true }'
```

Quick chat test:

```bash
curl --silent http://localhost:8000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"model":"qwen2.5-coder:1.5b","stream":false,"messages":[{"role":"user","content":"Write a Python function to debounce button input"}]}'
```

## Step 4: Run an OpenAI-compatible local bridge

Copilot speaks OpenAI-compatible APIs. `hailo-ollama` is Ollama-compatible. The bridge layer connects the two.

```bash
mkdir -p ~/hailo-openai
cd ~/hailo-openai
python3 -m venv .venv
. .venv/bin/activate
pip install --upgrade pip fastapi uvicorn requests
```

Create `hailo_openai_server.py`:

```python
from fastapi import FastAPI
from pydantic import BaseModel
import requests
import time
import uuid

MODEL = "qwen2.5-coder:1.5b"
HAILO_OLLAMA = "http://127.0.0.1:8000"
app = FastAPI()

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    model: str | None = None
    messages: list[Message]
    max_tokens: int | None = None
    stream: bool | None = False

@app.get("/v1/models")
def models():
    return {"object": "list", "data": [{"id": MODEL, "object": "model", "created": int(time.time()), "owned_by": "local-hailo"}]}

@app.post("/v1/chat/completions")
def chat(req: ChatRequest):
    payload = {
        "model": MODEL,
        "stream": False,
        "messages": [m.model_dump() for m in req.messages],
        "options": {"num_predict": req.max_tokens or 512},
    }
    r = requests.post(f"{HAILO_OLLAMA}/api/chat", json=payload, timeout=120)
    r.raise_for_status()
    text = r.json().get("message", {}).get("content", "")
    return {
        "id": f"chatcmpl-{uuid.uuid4().hex[:24]}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": MODEL,
        "choices": [{"index": 0, "message": {"role": "assistant", "content": text}, "finish_reason": "stop"}],
        "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
    }
```

Then run it:

```bash
uvicorn hailo_openai_server:app --host 127.0.0.1 --port 8010
```

Quick health/model check:

```bash
curl --silent http://127.0.0.1:8010/v1/models | jq
```

## Step 5: Point Copilot CLI at your local model endpoint

GitHub Copilot CLI has BYOK/custom provider support. This is where the magic happens for local workflows.

```bash
export COPILOT_PROVIDER_BASE_URL=http://127.0.0.1:8010/v1
export COPILOT_PROVIDER_TYPE=openai
export COPILOT_PROVIDER_WIRE_API=completions
export COPILOT_PROVIDER_MODEL_ID=gpt-4o-mini
export COPILOT_PROVIDER_WIRE_MODEL=qwen2.5-coder:1.5b
export COPILOT_MODEL=gpt-4o-mini
export COPILOT_PROVIDER_MAX_PROMPT_TOKENS=3072
export COPILOT_PROVIDER_MAX_OUTPUT_TOKENS=1024

copilot
```

Keep the bridge from Step 4 running in another terminal while you use Copilot.

## Why this is fun

The real magic is that everything runs on-device: Pi + Hailo acceleration + native Copilot CLI on ARM Linux. It's fast enough to be useful, quiet enough to leave on your desk, and a brilliant way to experiment with private local-first AI coding workflows.

At 1.5B parameters, `qwen2.5-coder:1.5b` is brilliant for a local setup, but for trickier prompts you may need to be a little more explicit than with larger cloud models.

## Pick the right model for the job

One of the best parts of this setup is that you don't always need the biggest model in existence for every prompt. I use local models on the Pi for the quick and simple stuff like summarisation, planning, and first-pass drafts, then switch to the most powerful cloud coding models when I need deeper reasoning or heavier lifting.

Running Copilot CLI on Raspberry Pi makes this workflow rather satisfying, because you can move between local and frontier models from one familiar Copilot experience.

## Useful documentation

- [GitHub Copilot CLI: Using Copilot CLI](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/use-copilot-cli)
- [Hailo Model Zoo GenAI (hailo-ollama)](https://github.com/hailo-ai/hailo_model_zoo_genai)
- [HailoRT runtime](https://github.com/hailo-ai/hailort)
- [Raspberry Pi AI HAT+ 2 (Hailo-10H)](https://www.raspberrypi.com/news/introducing-the-raspberry-pi-ai-hat-plus-2-generative-ai-on-raspberry-pi-5/)
- [Raspberry Pi 5](https://www.raspberrypi.com/products/raspberry-pi-5/)

If you build one of these, I'd love to hear how you get on. Happy making!
