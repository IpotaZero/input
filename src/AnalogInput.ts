import type { KeyboardEventCode } from "types-keyboardevent"

export namespace AnalogInput {
    /**
     * キーボードのキーを読み取るソース。
     * 押されていれば1、押されていなければ0。
     */
    export type KeyboardSource = {
        type: "keyboard"
        code: KeyboardEventCode
    }

    /**
     * ゲームパッドのアナログ軸（スティック等）を読み取るソース。
     * directionで指定した向き（positive: +方向, negative: -方向）の成分のみを[0,1]で返す。
     * threshold未満の入力はデッドゾーンとして0に丸められる。
     */
    export type AxisSource = {
        type: "gamepad-axis"
        index: number
        direction: "positive" | "negative"
        threshold?: number
    }

    /**
     * ゲームパッドのボタン（アナログトリガー等）を読み取るソース。
     * ボタンの値をそのまま[0,1]で返す。
     * threshold未満の入力はデッドゾーンとして0に丸められる。
     */
    export type ButtonSource = {
        type: "gamepad-button"
        index: number
        threshold?: number
    }

    export type Source = KeyboardSource | AxisSource | ButtonSource

    export type Reader<Action extends string> = {
        /** [0,1]を取る。 */
        getValue(action: Action): number
    }

    export type Config<Action extends string> = Record<Action, readonly AnalogInput.Source[]>
}

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
export class AnalogInput<Action extends string> implements AnalogInput.Reader<Action> {
    private readonly config = new Map<Action, readonly AnalogInput.Source[]>()
    private readonly values = new Map<Action, number>()

    // 実際に押されているキーボードのコードの集合
    private readonly pressedKeys = new Set<KeyboardEventCode>()

    private readonly ac = new AbortController()
    private readonly disableReasons = new Set<string>()

    private isPaused(): boolean {
        return this.disableReasons.size > 0
    }

    pause(reason: string): void {
        this.disableReasons.add(reason)
    }

    resume(reason: string): void {
        this.disableReasons.delete(reason)
    }

    updateConfig(config: AnalogInput.Config<Action>) {
        this.config.clear()

        for (const [action, sources] of Object.entries(config) as Iterable<[Action, readonly AnalogInput.Source[]]>) {
            this.config.set(action, [...sources])
        }
    }

    constructor(
        config: AnalogInput.Config<Action>,
        private readonly gamepadIndex = [0, 1, 2, 3],
    ) {
        this.updateConfig(config)
        window.addEventListener("keydown", this.onKeyDown, { signal: this.ac.signal })
        window.addEventListener("keyup", this.onKeyUp, { signal: this.ac.signal })
    }

    /**
     * フレームの最後に呼び出す。
     */
    update(): void {
        this.values.clear()

        if (this.isPaused()) {
            console.log("AnalogInput is paused because of reasons:", this.disableReasons)
            return
        }

        this.process()
    }

    private process() {
        const gamepads = navigator.getGamepads()

        for (const [action, sources] of this.config) {
            let best = 0

            for (const source of sources) {
                const value = this.readSource(source, gamepads)
                if (value > best) {
                    best = value
                }
            }

            this.values.set(action, best)
        }
    }

    getValue(action: Action): number {
        if (this.isPaused()) return 0

        return this.values.get(action) ?? 0
    }

    clear(): void {
        this.pressedKeys.clear()
        this.values.clear()
    }

    /**
     * イベントリスナーを解除する。
     */
    dispose(): void {
        this.ac.abort()
    }

    private readSource(source: AnalogInput.Source, gamepads: readonly (Gamepad | null)[]): number {
        switch (source.type) {
            case "keyboard":
                return this.readKeyboard(source)
            case "gamepad-axis":
                return this.readGamepadAxis(source, gamepads)
            case "gamepad-button":
                return this.readGamepadButton(source, gamepads)
        }
    }

    private readKeyboard(source: AnalogInput.KeyboardSource): number {
        return this.pressedKeys.has(source.code) ? 1 : 0
    }

    private readGamepadAxis(source: AnalogInput.AxisSource, gamepads: readonly (Gamepad | null)[]): number {
        const threshold = source.threshold ?? 0.1

        let best = 0

        gamepads.forEach((gamepad, index) => {
            if (!this.gamepadIndex.includes(index)) return
            if (!gamepad) return

            const raw = gamepad.axes[source.index]
            if (raw === undefined) return
            if (Math.abs(raw) < threshold) return

            // directionに一致する成分だけを[0,1]として取り出す
            const value = source.direction === "positive" ? Math.max(raw, 0) : Math.max(-raw, 0)

            if (value > best) {
                best = value
            }
        })

        return this.clamp(best)
    }

    private readGamepadButton(source: AnalogInput.ButtonSource, gamepads: readonly (Gamepad | null)[]): number {
        const threshold = source.threshold ?? 0

        let best = 0

        gamepads.forEach((gamepad, index) => {
            if (!this.gamepadIndex.includes(index)) return
            if (!gamepad) return

            const button = gamepad.buttons[source.index]
            if (!button) return
            if (button.value < threshold) return

            if (button.value > best) {
                best = button.value
            }
        })

        return this.clamp(best)
    }

    /** [0,1]にクランプする。 */
    private clamp(value: number): number {
        if (value > 1) return 1
        if (value < 0) return 0
        return value
    }

    private onKeyDown = (e: KeyboardEvent) => {
        this.pressedKeys.add(e.code as KeyboardEventCode)
    }

    private onKeyUp = (e: KeyboardEvent) => {
        this.pressedKeys.delete(e.code as KeyboardEventCode)
    }
}
