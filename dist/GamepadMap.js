export var StandardGamepadMap;
(function (StandardGamepadMap) {
    /**
     * W3C Standard Gamepad のボタンインデックスから物理位置・役割へのマッピング
     */
    StandardGamepadMap.buttonMap = {
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
    };
    // 使い方
    StandardGamepadMap.getButtonName = (index) => {
        if (index in StandardGamepadMap.buttonMap) {
            return StandardGamepadMap.buttonMap[index];
        }
        return "Unknown";
    };
    /**
     * W3C Standard Gamepad の軸インデックス・向きから、物理位置・役割へのマッピング。
     * 軸は「どちらのスティックの上下左右どれか」まで表す。
     */
    StandardGamepadMap.axisMap = {
        0: { positive: "LeftStickRight", negative: "LeftStickLeft" }, // 左スティック 水平方向
        1: { positive: "LeftStickDown", negative: "LeftStickUp" }, // 左スティック 垂直方向
        2: { positive: "RightStickRight", negative: "RightStickLeft" }, // 右スティック 水平方向
        3: { positive: "RightStickDown", negative: "RightStickUp" }, // 右スティック 垂直方向
    };
    // 使い方
    StandardGamepadMap.getAxisName = (index, direction) => {
        if (index in StandardGamepadMap.axisMap) {
            return StandardGamepadMap.axisMap[index][direction];
        }
        return "Unknown";
    };
    /** Sourceからあだ名（人間が読みやすい識別名）を取り出す。 */
    StandardGamepadMap.getSourceAlias = (source) => {
        switch (source.type) {
            case "keyboard":
                return source.code;
            case "gamepad-button":
                return StandardGamepadMap.getButtonName(source.index);
            case "gamepad-axis":
                return StandardGamepadMap.getAxisName(source.index, source.direction);
        }
        return "Unknown";
    };
})(StandardGamepadMap || (StandardGamepadMap = {}));
