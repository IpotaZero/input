/**
 * キーボードとゲームパッドのアナログ入力（軸/トリガー）を統一的に扱うためのクラス。
 *
 * 例:
 * const ai = new AnalogInput({
 *     horizontal: [
 *         { type: "gamepad-axis", axis: 0, threshold: 0.1, scalar: 1 },
 *         { type: "keyboard", positive: "KeyD", negative: "KeyA" },
 *         { type: "gamepad-button", positive: 1, negative: 4 },
 *     ],
 * })
 *
 * 1つのアクションに複数のソースを割り当てた場合、
 * 各ソースが返す値のうち絶対値が最大のものを採用する
 * （どれか1つの入力方法が「効いていれば」それを優先する、DigitalInputのOR的な発想と同じ）。
 *
 * 基本的にシングルトンとして使うことを想定している。
 * アプリはメインループを持つ。
 */
export class AnalogInput {
    config = new Map();
    values = new Map();
    // 実際に押されているキーボードのコードの集合
    pressedKeys = new Set();
    ac = new AbortController();
    disableReasons = new Set();
    isPaused() {
        return this.disableReasons.size > 0;
    }
    pause(reason) {
        this.disableReasons.add(reason);
    }
    resume(reason) {
        this.disableReasons.delete(reason);
    }
    constructor(config) {
        for (const [action, sources] of Object.entries(config)) {
            this.config.set(action, [...sources]);
        }
        window.addEventListener("keydown", this.onKeyDown, { signal: this.ac.signal });
        window.addEventListener("keyup", this.onKeyUp, { signal: this.ac.signal });
    }
    /**
     * フレームの最後に呼び出す。
     */
    update() {
        this.values.clear();
        if (this.isPaused()) {
            console.log("AnalogInput is paused because of reasons:", this.disableReasons);
            return;
        }
        const gamepads = navigator.getGamepads()?.filter((gamepad) => !!gamepad) ?? [];
        for (const [action, sources] of this.config) {
            let best = 0;
            for (const source of sources) {
                const value = this.readSource(source, gamepads);
                if (Math.abs(value) > Math.abs(best)) {
                    best = value;
                }
            }
            this.values.set(action, best);
        }
    }
    getValue(action) {
        if (this.isPaused())
            return 0;
        return this.values.get(action) ?? 0;
    }
    clear() {
        this.pressedKeys.clear();
        this.values.clear();
    }
    /**
     * イベントリスナーを解除する。
     */
    dispose() {
        this.ac.abort();
    }
    readSource(source, gamepads) {
        switch (source.type) {
            case "keyboard":
                return this.readKeyboard(source);
            case "gamepad-axis":
                return this.readGamepadAxis(source, gamepads);
            case "gamepad-button":
                return this.readGamepadButton(source, gamepads);
        }
    }
    readKeyboard(source) {
        const positive = this.pressedKeys.has(source.positive);
        const negative = this.pressedKeys.has(source.negative);
        if (positive && !negative)
            return 1;
        if (negative && !positive)
            return -1;
        return 0;
    }
    readGamepadAxis(source, gamepads) {
        const threshold = source.threshold ?? 0.1;
        const scalar = source.scalar ?? 1;
        const invert = source.invert ?? false;
        let best = 0;
        for (const gamepad of gamepads) {
            const raw = gamepad.axes[source.axis];
            if (raw === undefined)
                continue;
            const applied = Math.abs(raw) < threshold ? 0 : raw;
            if (Math.abs(applied) > Math.abs(best)) {
                best = applied;
            }
        }
        const signed = invert ? -best : best;
        return this.clamp(signed * scalar);
    }
    readGamepadButton(source, gamepads) {
        const threshold = source.threshold ?? 0;
        const scalar = source.scalar ?? 1;
        let best = 0;
        for (const gamepad of gamepads) {
            const positiveButton = gamepad.buttons[source.positive];
            const positiveValue = positiveButton && positiveButton.value > threshold ? positiveButton.value : 0;
            let negativeValue = 0;
            if (source.negative !== undefined) {
                const negativeButton = gamepad.buttons[source.negative];
                negativeValue = negativeButton && negativeButton.value > threshold ? negativeButton.value : 0;
            }
            const combined = positiveValue - negativeValue;
            if (Math.abs(combined) > Math.abs(best)) {
                best = combined;
            }
        }
        return this.clamp(best * scalar);
    }
    clamp(value) {
        if (value > 1)
            return 1;
        if (value < -1)
            return -1;
        return value;
    }
    onKeyDown = (e) => {
        this.pressedKeys.add(e.code);
    };
    onKeyUp = (e) => {
        this.pressedKeys.delete(e.code);
    };
}
