# Input

## Install

```bash
npm install @ipota/input
```

## Usage

```ts
import { DigitalInput, AnalogInput } from "@ipota/input"

const di = new DigitalInput({
    left: ["ArrowLeft", "gamepad-axis-0-negative"],
    right: ["ArrowRight", "gamepad-axis-0-positive"],
    jump: ["Space", "gamepad-button-0"],
})

// Keyboard input always has a value of 1.
const ai = new AnalogInput({
    horizontal: [
        { type: "gamepad-axis", axis: 0, threshold: 0.1, scalar: 1 },
        { type: "keyboard", positive: "KeyD", negative: "KeyA" },
        { type: "gamepad-button", positive: 1, negative: 4 },
    ],
    // Just `positive` is fine.
    strength: [
        { type: "keyboard", positive: "Space" },
        { type: "gamepad-button", positive: 3 },
    ],
})

function loop() {
    if (di.isPushed("jump")) {
        // ...
    }

    if (ai.getValue("horizontal") > 0.5) {
        // ...
    }

    // Call `update` at the end of each frame
    di.update()
    ai.update()

    requestAnimationFrame(loop)
}
```
