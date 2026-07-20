import { Keys } from "./KeyCode"

export namespace AnalogInput {
    /**
     * キーボードの2キーを +1 / -1 の軸として扱うソース。
     */
    export type KeyboardSource = {
        type: "keyboard"
        positive: Keys
        negative?: Keys
    }

    /**
     * ゲームパッドのアナログ軸（スティック等）を読み取るソース。
     * threshold未満の入力はデッドゾーンとして0に丸められる。
     * scalarは出力にかける倍率（最終的に-1〜1にクランプされる）。
     * invertを立てると符号を反転する。
     */
    export type AxisSource = {
        type: "gamepad-axis"
        axis: number
        threshold?: number
        scalar?: number
        invert?: boolean
    }

    /**
     * ゲームパッドのボタン（アナログトリガー等）を読み取るソース。
     * positiveボタンの値をそのまま+方向、negativeボタンの値を-方向として扱い、
     * 両方指定されている場合は positive - negative を最終値とする。
     */
    export type ButtonSource = {
        type: "gamepad-button"
        positive: number
        negative?: number
        threshold?: number
        scalar?: number
    }

    export type Source = KeyboardSource | AxisSource | ButtonSource

    export type Reader<Action extends string> = {
        getValue(action: Action): number
    }

    export type Config<Action extends string> = Record<Action, readonly AnalogInput.Source[]>
}

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
export class AnalogInput<Action extends string> implements AnalogInput.Reader<Action> {
    private readonly config = new Map<Action, readonly AnalogInput.Source[]>()
    private readonly values = new Map<Action, number>()

    // 実際に押されているキーボードのコードの集合
    private readonly pressedKeys = new Set<Keys>()

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

    constructor(config: AnalogInput.Config<Action>) {
        for (const [action, sources] of Object.entries(config) as Iterable<[Action, readonly AnalogInput.Source[]]>) {
            this.config.set(action, [...sources])
        }

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

        const gamepads = navigator.getGamepads()?.filter((gamepad): gamepad is Gamepad => !!gamepad) ?? []

        for (const [action, sources] of this.config) {
            let best = 0

            for (const source of sources) {
                const value = this.readSource(source, gamepads)
                if (Math.abs(value) > Math.abs(best)) {
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

    private readSource(source: AnalogInput.Source, gamepads: readonly Gamepad[]): number {
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
        const positive = this.pressedKeys.has(source.positive)
        const negative = source.negative ? this.pressedKeys.has(source.negative) : false

        if (positive && !negative) return 1
        if (negative && !positive) return -1
        return 0
    }

    private readGamepadAxis(source: AnalogInput.AxisSource, gamepads: readonly Gamepad[]): number {
        const threshold = source.threshold ?? 0.1
        const scalar = source.scalar ?? 1
        const invert = source.invert ?? false

        let best = 0

        for (const gamepad of gamepads) {
            const raw = gamepad.axes[source.axis]
            if (raw === undefined) continue

            const applied = Math.abs(raw) < threshold ? 0 : raw

            if (Math.abs(applied) > Math.abs(best)) {
                best = applied
            }
        }

        const signed = invert ? -best : best
        return this.clamp(signed * scalar)
    }

    private readGamepadButton(source: AnalogInput.ButtonSource, gamepads: readonly Gamepad[]): number {
        const threshold = source.threshold ?? 0
        const scalar = source.scalar ?? 1

        let best = 0

        for (const gamepad of gamepads) {
            const positiveButton = gamepad.buttons[source.positive]
            const positiveValue = positiveButton && positiveButton.value > threshold ? positiveButton.value : 0

            let negativeValue = 0
            if (source.negative !== undefined) {
                const negativeButton = gamepad.buttons[source.negative]
                negativeValue = negativeButton && negativeButton.value > threshold ? negativeButton.value : 0
            }

            const combined = positiveValue - negativeValue
            if (Math.abs(combined) > Math.abs(best)) {
                best = combined
            }
        }

        return this.clamp(best * scalar)
    }

    private clamp(value: number): number {
        if (value > 1) return 1
        if (value < -1) return -1
        return value
    }

    private onKeyDown = (e: KeyboardEvent) => {
        this.pressedKeys.add(e.code as Keys)
    }

    private onKeyUp = (e: KeyboardEvent) => {
        this.pressedKeys.delete(e.code as Keys)
    }
}
