/**
 * キーボードとゲームパッドのアナログ入力（軸/トリガー）を統一的に扱うためのクラス。
 * 各ソースは[0,1]の値を返し、1つのアクションに複数のソースを割り当てた場合はそのうち最大のものを採用する
 * （どれか1つの入力方法が「効いていれば」それを優先する、DigitalInputのOR的な発想と同じ）。
 * 正負両方向が必要な場合（左右移動など）は、アクション自体を分けてdirectionで向きを指定する。
 *
 * 例:
 * const ai = new AnalogInput({
 *     left: [
 *         { type: "gamepad-axis", index: 0, threshold: 0.1, direction: "negative" },
 *         { type: "keyboard", code: "KeyA" },
 *         { type: "gamepad-button", index: 1 },
 *     ],
 *     right: [
 *         { type: "gamepad-axis", index: 0, threshold: 0.1, direction: "positive" },
 *         { type: "keyboard", code: "KeyD" },
 *         { type: "gamepad-button", index: 3 },
 *     ],
 * })
 *
 * 基本的にシングルトンとして使うことを想定している。
 * アプリはメインループを持つ。
 */
export class AnalogInput {
    gamepadIndex;
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
    updateConfig(config) {
        this.config.clear();
        for (const [action, sources] of Object.entries(config)) {
            this.config.set(action, [...sources]);
        }
    }
    constructor(config, gamepadIndex = [0, 1, 2, 3]) {
        this.gamepadIndex = gamepadIndex;
        this.updateConfig(config);
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
        this.process();
    }
    process() {
        const gamepads = navigator.getGamepads();
        for (const [action, sources] of this.config) {
            let best = 0;
            for (const source of sources) {
                const value = this.readSource(source, gamepads);
                if (value > best) {
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
        return this.pressedKeys.has(source.code) ? 1 : 0;
    }
    readGamepadAxis(source, gamepads) {
        const threshold = source.threshold ?? 0.1;
        let best = 0;
        gamepads.forEach((gamepad, index) => {
            if (!this.gamepadIndex.includes(index))
                return;
            if (!gamepad)
                return;
            const raw = gamepad.axes[source.index];
            if (raw === undefined)
                return;
            if (Math.abs(raw) < threshold)
                return;
            // directionに一致する成分だけを[0,1]として取り出す
            const value = source.direction === "positive" ? Math.max(raw, 0) : Math.max(-raw, 0);
            if (value > best) {
                best = value;
            }
        });
        return this.clamp(best);
    }
    readGamepadButton(source, gamepads) {
        const threshold = source.threshold ?? 0;
        let best = 0;
        gamepads.forEach((gamepad, index) => {
            if (!this.gamepadIndex.includes(index))
                return;
            if (!gamepad)
                return;
            const button = gamepad.buttons[source.index];
            if (!button)
                return;
            if (button.value < threshold)
                return;
            if (button.value > best) {
                best = button.value;
            }
        });
        return this.clamp(best);
    }
    /** [0,1]にクランプする。 */
    clamp(value) {
        if (value > 1)
            return 1;
        if (value < 0)
            return 0;
        return value;
    }
    onKeyDown = (e) => {
        this.pressedKeys.add(e.code);
    };
    onKeyUp = (e) => {
        this.pressedKeys.delete(e.code);
    };
}
