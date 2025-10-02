---
title: "Copilot Hacked my Furby"
date: 2025-10-02T10:00:00.000Z
# post thumb
# TODO: Replace placeholder with 1200x630px image showing Furby Connect with GitHub Copilot branding
images:
  - "/images/post/2025/10/copilot-furby-hero.jpg"
#author
author: "Martin Woodward"
# description
description: "How GitHub Copilot helped me breathe new life into a Furby Connect by porting a reverse-engineered Bluetooth control library to modern Python"
# Taxonomies
categories: ["maker", "ai", "technology", "github"]
tags: ["furby", "bluetooth", "python", "github-copilot", "maker", "hardware-hacking", "ai", "open-source"]
type: "regular"
draft: false
---

Remember Furbies? Those adorable, slightly creepy electronic pets from the late 90s? Well, they made a comeback with the Furby Connect edition featuring LCD eyes and Bluetooth connectivity. Unfortunately, Hasbro discontinued support for the companion app, leaving these charming creatures unable to reach their full potential. That's where GitHub Copilot, some open source magic, and a healthy dose of nostalgia come in.

## Introduction

What happens when you combine a discontinued electronic toy, a reverse-engineered Bluetooth protocol, and GitHub Copilot? You get [`pyfluff`](https://github.com/martinwoodward/pyfluff) - a modern Python library that lets you take complete control of Furby Connect toys via Bluetooth Low Energy. This project breathes new life into these now-unsupported toys, allowing you to control their actions, emotions, antenna colors, and even upload custom content.

The best part? GitHub Copilot did most of the heavy lifting, porting an entire Node.js codebase to Python 3.11+ in what felt like magic. But let me back up and tell you the whole story.

## The Inspiration

The journey started with the incredible work of [Jeija](https://github.com/Jeija) and the [bluefluff](https://github.com/Jeija/bluefluff) community, who reverse-engineered the entire Bluetooth protocol that Furby Connect uses. Their Node.js implementation was brilliant, but I wanted something I could easily run on a Raspberry Pi using Python - my go-to language for hardware projects.

Why Furbies? There's something irresistibly fun about the combination of nostalgia and technical challenge. These toys represent a sweet spot where 90s charm meets 2010s IoT technology. Plus, the idea of making a Furby say and do things it was never meant to do is just too entertaining to pass up. It's hardware hacking meets comfort toy - what's not to love?

When I discovered that the official app was discontinued and these Furbies were essentially becoming expensive paperweights, I knew someone had to step in. And what better way to learn about modern AI-assisted coding than by giving it a real-world challenge?

## Tools and Technologies

The project leverages a fascinating mix of old and new tech:

### Hardware
- **Furby Connect** - The 2016 Bluetooth-enabled version with LCD eyes (the one with the sleeping mask)
- **Raspberry Pi** - My target platform for deployment, though it works on any system with Bluetooth 4.0+
- **Bluetooth Low Energy** - The communication protocol that makes it all possible

### Software Stack
- **Python 3.11+** - Leveraging modern features like improved async performance and better type hints
- **Bleak** - A well-maintained, cross-platform BLE library
- **FastAPI** - For the web server with automatic OpenAPI documentation
- **WebSocket** - Real-time sensor data streaming
- **GitHub Copilot** - The AI pair programmer that made this possible

The bluefluff community had already done the hard work of reverse engineering. They documented every Bluetooth GATT service, characteristic UUID, command byte sequence, and even transcribed all ~1000 possible Furby actions. Their documentation is incredibly thorough - covering everything from how DLC (downloadable content) files work to the complete action system.

## The Process

Here's where things got interesting. I started by studying the original bluefluff Node.js implementation, understanding how it communicated with Furby over Bluetooth. The protocol is fairly complex, involving:

- Multiple GATT characteristics for different command types
- A GeneralPlus processor for main control
- A Nordic SoC for firmware/DLC updates
- Complex action sequences with input, index, subindex, and specific parameters
- Real-time sensor monitoring from antenna joystick, tickle sensors, and accelerometer

Rather than manually translating hundreds of lines of Node.js to Python, I decided to give GitHub Copilot a proper workout. I set up a new Python project structure, created the basic scaffolding, and then started feeding Copilot the Node.js code along with context about what I wanted to achieve.

### How Copilot Assisted

The magic happened in waves:

1. **Initial Structure**: I prompted Copilot with "Create a Python class for Furby Connect BLE communication using Bleak library" along with the Node.js reference. It immediately understood the async patterns needed and generated a solid foundation.

2. **Protocol Translation**: For each command type (set antenna color, trigger action, adjust emotions), I would show Copilot the Node.js implementation and ask it to convert to modern Python with type hints. It nailed the byte array manipulations and async patterns.

3. **FastAPI Integration**: When I wanted to add a web interface, I simply described what endpoints I needed. Copilot generated the FastAPI routes, Pydantic models for request validation, and even suggested WebSocket implementation for real-time sensor streaming.

4. **Documentation Generation**: As I wrote each function, Copilot would suggest comprehensive docstrings following Python conventions. It even helped me write better comments explaining the quirky parts of the Furby protocol.

The entire port from Node.js to Python - which would have taken me days or weeks - was accomplished in a few hours of intensive pair programming with Copilot. It wasn't perfect (more on that in Challenges), but it gave me a massive head start.

## Challenges and Learnings

Of course, it wasn't all smooth sailing. Here are some of the obstacles I faced:

### Challenge 1: Bluetooth Platform Differences
Bleak behaves differently on macOS vs Linux vs Windows. Copilot helped generate the basic BLE code, but I had to manually test and debug platform-specific quirks, especially around device discovery and connection handling.

### Challenge 2: Binary Protocol Complexity
The Furby protocol uses specific byte sequences and bit manipulations. While Copilot understood the concepts, I had to carefully verify each command against the original implementation and the community documentation. A single wrong byte could brick the Furby or cause unpredictable behavior.

### Challenge 3: Async/Await Patterns
Modern Python async is different from Node.js promises. Copilot generally got this right, but there were edge cases in error handling and connection management that required manual refinement.

### What I Learned

The biggest lesson? **GitHub Copilot is an incredible accelerator, but you still need to understand what you're building.** It's not about blindly accepting suggestions - it's about having an AI pair programmer who can handle the boilerplate and patterns while you focus on the logic and verification.

Specific Copilot wins:
- **Pattern Recognition**: It quickly learned the repeating patterns in the codebase and suggested consistent implementations
- **API Design**: When building the FastAPI server, it suggested RESTful endpoints that made intuitive sense
- **Type Safety**: It consistently added proper type hints, catching potential bugs before they happened
- **Error Handling**: It prompted me to add proper error handling in places I might have initially skipped

I also learned that the Furby Connect protocol is beautifully designed. Despite being a toy, the engineering is solid - with proper error handling, state management, and a surprisingly flexible action system.

## The Result

The final [pyfluff library](https://github.com/martinwoodward/pyfluff) is a fully functional, modern Python implementation that can:

✅ **Control Furby's Actions** - Trigger any of ~1000 pre-programmed actions  
✅ **Customize Appearance** - Set antenna LED colors and LCD backlight  
✅ **Adjust Emotions** - Modify hunger, tiredness, wellness, and other emotional states  
✅ **Monitor Sensors** - Real-time streaming of antenna joystick position, tickle sensors, and accelerometer data  
✅ **Upload Custom Content** - Flash custom DLC files for new actions and personalities  
✅ **Debug Features** - Access internal debug menus on the LCD eyes  
✅ **Web Interface** - Control everything through a browser  
✅ **CLI Tools** - Command-line utilities for quick testing  
✅ **API Server** - Full RESTful API with automatic OpenAPI documentation  

The project includes comprehensive examples, from basic control scripts to advanced mood monitoring. It works on Raspberry Pi, macOS, Linux, and Windows - anywhere you have Python 3.11+ and Bluetooth support.

One of my favorite features is the web interface. You can pull up a browser on your phone, connect to your Raspberry Pi running pyfluff, and control Furby wirelessly. It's like having the original app back, but better - because now you have complete control over what Furby can do.

## Reflections

Using GitHub Copilot for this project was genuinely fun. There's something delightful about describing what you want in plain English and having the AI generate working code that's often better than your first attempt would have been.

The experience reminded me why I love open source. The bluefluff community spent countless hours reverse engineering this protocol, documenting everything meticulously, and sharing it freely. I was able to build on their work, using modern AI tools to make it accessible to Python developers. And now, by open sourcing pyfluff, others can build on my work too.

Combining AI-assisted development with open source code and retro hardware creates this wonderful feedback loop of creativity. The Furby Connect could have ended up in a landfill when Hasbro discontinued support. Instead, it's become a platform for learning about Bluetooth LE, Python async programming, and AI-assisted development.

There's also something poetic about using AI to control a toy that was designed to simulate intelligence. GitHub Copilot helped me write code that lets me make Furby say and do exactly what I want - a form of creative expression that wouldn't have been practical without modern AI tools.

## Call to Action

Want to hack your own Furby? Here's how to get started:

1. **Get the Code**: Check out the [pyfluff repository](https://github.com/martinwoodward/pyfluff) on GitHub
2. **Find a Furby Connect**: You'll need the 2016 Bluetooth edition (the one with LCD eyes and a sleeping mask)
3. **Set Up Your Environment**: Python 3.11+ on Raspberry Pi, Linux, or macOS
4. **Start Experimenting**: Begin with the quickstart guide and example scripts

The repository includes:
- Complete installation instructions
- API documentation
- Example scripts for common tasks
- Protocol documentation from the bluefluff community
- Troubleshooting guides

Even if you don't have a Furby, the project is a great example of:
- Modern Python async programming
- Bluetooth Low Energy communication
- AI-assisted code porting
- Building web APIs with FastAPI
- Hardware-software integration

I'm actively maintaining the project and would love to see what you build with it. Have ideas for features? Found a bug? Want to contribute? Open an issue or submit a pull request - the community grows when we share.

And if you're wondering whether GitHub Copilot can help with your next project - whether it's porting legacy code, building hardware interfaces, or creating something entirely new - I can confidently say: absolutely give it a try. Just remember to test thoroughly, understand what the AI generates, and have fun with it.

Now if you'll excuse me, I have a Furby to program with some very questionable vocabulary. 😈

---

*Special thanks to [Jeija](https://github.com/Jeija) and the entire [bluefluff](https://github.com/Jeija/bluefluff) community for their incredible reverse engineering work that made this project possible.*
