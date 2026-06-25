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
| Raspberry Pi 5 (8GB recommended) | [Amazon US](https://www.amazon.com/s?k=Raspberry+Pi+5+8GB&tag=woodweb03-20) | [Amazon UK](https://www.amazon.co.uk/s?k=Raspberry+Pi+5+8GB&tag=woodweb03-20) |
| Raspberry Pi AI HAT+ 2 (Hailo-10H) | [Amazon US](https://www.amazon.com/s?k=Raspberry+Pi+AI+HAT%2B+2+Hailo-10H&tag=woodweb03-20) | [Amazon UK](https://www.amazon.co.uk/s?k=Raspberry+Pi+AI+HAT%2B+2+Hailo-10H&tag=woodweb03-20) |
| Official Pi 27W USB-C Power Supply | [Amazon US](https://www.amazon.com/s?k=Raspberry+Pi+27W+USB-C+Power+Supply&tag=woodweb03-20) | [Amazon UK](https://www.amazon.co.uk/s?k=Raspberry+Pi+27W+USB-C+Power+Supply&tag=woodweb03-20) |
| Active Cooler / Case | [Amazon US](https://www.amazon.com/s?k=Raspberry+Pi+5+active+cooler+case&tag=woodweb03-20) | [Amazon UK](https://www.amazon.co.uk/s?k=Raspberry+Pi+5+active+cooler+case&tag=woodweb03-20) |
| Fast microSD card (U3/A2, e.g. SanDisk Extreme Pro) | [Amazon US](https://www.amazon.com/s?k=SanDisk+Extreme+Pro+microSD+U3+A2&tag=woodweb03-20) | [Amazon UK](https://www.amazon.co.uk/s?k=SanDisk+Extreme+Pro+microSD+U3+A2&tag=woodweb03-20) |

## Step 1: Install Hailo runtime and drivers

```bash
sudo apt-get update
sudo apt-get install -y h10-hailort h10-hailort-pcie-driver hailo-h10-all
hailortcli scan
```

You should see your Hailo device listed.

Expected output:

```text
Hailo Devices:
[-] Device: 0001:01:00.0
```

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

## Step 4: Use LiteLLM as the OpenAI-compatible bridge (recommended)

The bridge is needed because Copilot BYOK expects an OpenAI-compatible API shape, while Hailo gives us an Ollama-compatible endpoint. LiteLLM sits in the middle and does the translation cleanly.

```bash
mkdir -p ~/litellm-hailo
cd ~/litellm-hailo
python3 -m venv .venv
. .venv/bin/activate
pip install --upgrade pip "litellm[proxy]"
```

Create `config.yaml`:

```yaml
model_list:
  - model_name: qwen2.5-coder:1.5b
    litellm_params:
      model: ollama_chat/qwen2.5-coder:1.5b
      api_base: http://127.0.0.1:8000
```

Run LiteLLM:

```bash
litellm --config config.yaml --host 127.0.0.1 --port 4000
```

Quick check:

```bash
curl --silent http://127.0.0.1:4000/v1/models | jq
```

Example output:

```json
{
  "data": [
    {
      "id": "qwen2.5-coder:1.5b",
      "object": "model",
      "created": 1677610602,
      "owned_by": "openai"
    }
  ],
  "object": "list"
}
```

## Step 5: Point Copilot CLI at LiteLLM

GitHub Copilot CLI has BYOK/custom provider support, so we point it at LiteLLM's OpenAI-compatible endpoint.

```bash
export COPILOT_PROVIDER_BASE_URL=http://127.0.0.1:4000/v1
export COPILOT_PROVIDER_TYPE=openai
export COPILOT_PROVIDER_MODEL_ID=gpt-4o-mini
export COPILOT_PROVIDER_WIRE_MODEL=qwen2.5-coder:1.5b
export COPILOT_MODEL=gpt-4o-mini
export COPILOT_PROVIDER_MAX_PROMPT_TOKENS=3072
export COPILOT_PROVIDER_MAX_OUTPUT_TOKENS=1024

copilot
```

## Step 6: Run everything as startup services (boot and go)

This is where things get interesting. You can run both `hailo-ollama` and LiteLLM as user services so after boot you can jump straight into Copilot.

Enable lingering so user services start at boot even without an interactive login:

```bash
sudo loginctl enable-linger "$USER"
```

Create `~/.config/systemd/user/hailo-ollama.service`:

```ini
[Unit]
Description=Hailo Ollama Server
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/hailo-ollama
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
```

Create `~/.config/systemd/user/litellm-hailo.service`:

```ini
[Unit]
Description=LiteLLM proxy for Hailo-Ollama
After=network.target hailo-ollama.service
Requires=hailo-ollama.service

[Service]
Type=simple
WorkingDirectory=%h/litellm-hailo
ExecStart=%h/litellm-hailo/.venv/bin/litellm --config %h/litellm-hailo/config.yaml --host 127.0.0.1 --port 4000
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
```

Enable and start:

```bash
systemctl --user daemon-reload
systemctl --user enable --now hailo-ollama.service litellm-hailo.service
systemctl --user status hailo-ollama.service litellm-hailo.service
```

Also pre-set your Copilot BYOK variables in your shell profile so every new terminal is ready:

```bash
cat >> ~/.bashrc <<'EOF'
export COPILOT_PROVIDER_BASE_URL=http://127.0.0.1:4000/v1
export COPILOT_PROVIDER_TYPE=openai
export COPILOT_PROVIDER_MODEL_ID=gpt-4o-mini
export COPILOT_PROVIDER_WIRE_MODEL=qwen2.5-coder:1.5b
export COPILOT_MODEL=gpt-4o-mini
export COPILOT_PROVIDER_MAX_PROMPT_TOKENS=3072
export COPILOT_PROVIDER_MAX_OUTPUT_TOKENS=1024
EOF

source ~/.bashrc
```

Now after reboot, both services come up automatically and your terminal environment is pre-configured, so you can launch Copilot immediately.

## Why this is fun

The real magic is that everything runs on-device: Pi + Hailo acceleration + native Copilot CLI on ARM Linux. It's fast enough to be useful, quiet enough to leave on your desk, and a brilliant way to experiment with private local-first AI coding workflows.

At 1.5B parameters, `qwen2.5-coder:1.5b` is brilliant for a local setup, but for trickier prompts you may need to be a little more explicit than with larger cloud models.

## Pick the right model for the job

One of the best parts of this setup is that you don't always need the biggest model in existence for every prompt. I use local models on the Pi for the quick and simple stuff like summarisation, planning, and first-pass drafts, then switch to the most powerful cloud coding models when I need deeper reasoning or heavier lifting.

Running Copilot CLI on Raspberry Pi makes this workflow rather satisfying, because you can move between local and frontier models from one familiar Copilot experience.

## AI HAT+ 2 stats and power context

Some of the numbers here are pretty compelling:

- Raspberry Pi AI HAT+ 2 uses a Hailo-10H accelerator with **40 TOPS (INT4)** and **8GB dedicated on-board RAM** ([Raspberry Pi product page](https://www.raspberrypi.com/products/ai-hat-plus-2/)).
- The official Raspberry Pi 5 PSU is **27W max**, with **5.1V at 5A (25.5W output)** ([Raspberry Pi 27W PSU specs](https://www.raspberrypi.com/products/27w-power-supply/)).
- Apple lists Mac mini (M4) at **4W idle** and **65W max**, and Mac mini (M4 Pro) at **5W idle** and **140W max** ([Apple power data](https://support.apple.com/en-in/103253)).

It is not a like-for-like performance comparison, but the power envelope is a big plus: this Pi + AI HAT stack can deliver useful local AI workflows in a very low-power setup.

## Useful documentation

- [GitHub Copilot CLI: Using Copilot CLI](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/use-copilot-cli)
- [Hailo Model Zoo GenAI (hailo-ollama)](https://github.com/hailo-ai/hailo_model_zoo_genai)
- [LiteLLM](https://docs.litellm.ai/docs/)
- [HailoRT runtime](https://github.com/hailo-ai/hailort)
- [Raspberry Pi AI HAT+ 2 (Hailo-10H)](https://www.raspberrypi.com/news/introducing-the-raspberry-pi-ai-hat-plus-2-generative-ai-on-raspberry-pi-5/)
- [Raspberry Pi AI HAT+ 2 product page](https://www.raspberrypi.com/products/ai-hat-plus-2/)
- [Raspberry Pi 27W power supply](https://www.raspberrypi.com/products/27w-power-supply/)
- [Mac mini power consumption by model](https://support.apple.com/en-in/103253)
- [Raspberry Pi 5](https://www.raspberrypi.com/products/raspberry-pi-5/)

If you build one of these, I'd love to hear how you get on. Happy making!
