import type { KeyboardEventCode } from "types-keyboardevent";
import type { Source } from "./KeyCode";
export declare namespace StandardGamepadMap {
    /**
     * W3C Standard Gamepad のボタンインデックスから物理位置・役割へのマッピング
     */
    const buttonMap: {
        readonly 0: "ButtonSouth";
        readonly 1: "ButtonEast";
        readonly 2: "ButtonWest";
        readonly 3: "ButtonNorth";
        readonly 4: "LeftShoulder";
        readonly 5: "RightShoulder";
        readonly 6: "LeftTrigger";
        readonly 7: "RightTrigger";
        readonly 8: "SelectButton";
        readonly 9: "StartButton";
        readonly 10: "LeftStickButton";
        readonly 11: "RightStickButton";
        readonly 12: "DpadUp";
        readonly 13: "DpadDown";
        readonly 14: "DpadLeft";
        readonly 15: "DpadRight";
        readonly 16: "Home";
    };
    type ButtonIndex = keyof typeof buttonMap;
    type ButtonName = (typeof buttonMap)[ButtonIndex];
    const getButtonName: (index: number) => ButtonName | "Unknown";
    /**
     * W3C Standard Gamepad の軸インデックス・向きから、物理位置・役割へのマッピング。
     * 軸は「どちらのスティックの上下左右どれか」まで表す。
     */
    const axisMap: {
        readonly 0: {
            readonly positive: "LeftStickRight";
            readonly negative: "LeftStickLeft";
        };
        readonly 1: {
            readonly positive: "LeftStickDown";
            readonly negative: "LeftStickUp";
        };
        readonly 2: {
            readonly positive: "RightStickRight";
            readonly negative: "RightStickLeft";
        };
        readonly 3: {
            readonly positive: "RightStickDown";
            readonly negative: "RightStickUp";
        };
    };
    type AxisIndex = keyof typeof axisMap;
    type AxisName = (typeof axisMap)[AxisIndex][keyof (typeof axisMap)[AxisIndex]];
    const getAxisName: (index: number, direction: "positive" | "negative") => AxisName | "Unknown";
    /** Sourceからあだ名（人間が読みやすい識別名）を取り出す。 */
    const getSourceAlias: (source: Source) => KeyboardEventCode | ButtonName | AxisName | "Unknown";
}
