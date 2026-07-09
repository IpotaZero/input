# Digital Input

KeyboardとGamepadを統一的に扱うTypeScriptライブラリ

## Install

```bash
npm install @ipota/input
```

## Usage

```ts
import { DigitalInput } from "@ipota/input"

const input = new DigitalInput({
    left: ["ArrowLeft", "gamepad-axis-0-negative"],
    right: ["ArrowRight", "gamepad-axis-0-positive"],
    jump: ["Space", "gamepad-button-0"],
})
```
