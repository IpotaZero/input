import type { KeyboardEventCode } from "types-keyboardevent"
import type { Source } from "./KeyCode"

export namespace StandardGamepadMap {
    /**
     * W3C Standard Gamepad のボタンインデックスから物理位置・役割へのマッピング
     */
    export const buttonMap = {
        0: "ActionBottom", // A (Xbox), × (PS), B (Switch)
        1: "ActionRight", // B (Xbox), ○ (PS), A (Switch)
        2: "ActionLeft", // X (Xbox), □ (PS), Y (Switch)
        3: "ActionTop", // Y (Xbox), △ (PS), X (Switch)
        4: "BumperLeft", // LB, L1, L
        5: "BumperRight", // RB, R1, R
        6: "TriggerLeft", // LT, L2, ZL
        7: "TriggerRight", // RT, R2, ZR
        8: "Select", // Back, Share, - (Minus)
        9: "Start", // Start, Options, + (Plus)
        10: "StickLeft", // L3 (左スティック押し込み)
        11: "StickRight", // R3 (右スティック押し込み)
        12: "DpadUp", // 十字キー 上
        13: "DpadDown", // 十字キー 下
        14: "DpadLeft", // 十字キー 左
        15: "DpadRight", // 十字キー 右
        16: "Home", // Guide, PS, Homeボタン (※ブラウザやOSに奪われがち)
    } as const

    export type ButtonIndex = keyof typeof buttonMap
    export type ButtonName = (typeof buttonMap)[ButtonIndex]

    // 使い方
    export const getButtonName = (index: number): ButtonName | "Unknown" => {
        if (index in buttonMap) {
            return buttonMap[index as ButtonIndex]
        }
        return "Unknown"
    }

    /**
     * W3C Standard Gamepad の軸インデックス・向きから、物理位置・役割へのマッピング。
     * 軸は「どちらのスティックの上下左右どれか」まで表す。
     */
    export const axisMap = {
        0: { positive: "LeftStickRight", negative: "LeftStickLeft" }, // 左スティック 水平方向
        1: { positive: "LeftStickDown", negative: "LeftStickUp" }, // 左スティック 垂直方向
        2: { positive: "RightStickRight", negative: "RightStickLeft" }, // 右スティック 水平方向
        3: { positive: "RightStickDown", negative: "RightStickUp" }, // 右スティック 垂直方向
    } as const

    export type AxisIndex = keyof typeof axisMap
    export type AxisName = (typeof axisMap)[AxisIndex][keyof (typeof axisMap)[AxisIndex]]

    // 使い方
    export const getAxisName = (index: number, direction: "positive" | "negative"): AxisName | "Unknown" => {
        if (index in axisMap) {
            return axisMap[index as AxisIndex][direction]
        }
        return "Unknown"
    }

    /** Sourceからあだ名（人間が読みやすい識別名）を取り出す。 */
    export const getSourceAlias = (source: Source): KeyboardEventCode | ButtonName | AxisName | "Unknown" => {
        switch (source.type) {
            case "keyboard":
                return source.code
            case "gamepad-button":
                return getButtonName(source.index)
            case "gamepad-axis":
                return getAxisName(source.index, source.direction)
        }

        return "Unknown"
    }
}
