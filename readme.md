# Digital Input

KeyboardとGamepadを統一的に扱うTypeScriptライブラリ

## Install

```bash
npm install @あなたの名前/digital-input
```

## Usage

```ts
import { DigitalInput } from "@あなたの名前/digital-input"

const input = new DigitalInput({
    left: ["ArrowLeft", "gamepad-axis-0-negative"],
    right: ["ArrowRight", "gamepad-axis-0-positive"],
    jump: ["Space", "gamepad-button-0"],
})
```
