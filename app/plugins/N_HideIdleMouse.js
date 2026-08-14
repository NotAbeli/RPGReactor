/* * MIT License
 * * Copyright (c) 2023 Nolonar
 * Modified by Korolev
 * * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

//=============================================================================
// Metadata
//=============================================================================
/*:
 * @target MZ
 * @plugindesc Automatically hides mouse if it hasn't been moved for a while.
 * @author Nolonar (Modified by Korolev)
 * @url https://github.com/Nolonar/RM_Plugins
 * * @param timeout
 * @text Idle timeout
 * @desc How long the mouse can remain idle before it is hidden (in milliseconds).
 * @type number
 * @min 0
 * @default 3000
 * * @param disableSwitch
 * @text Disable Hide Switch
 * @desc If this switch is ON and the player has control, the mouse will not hide.
 * @type switch
 * @default 0
 * * @help Version 1.1.0 (Modified)
 * * This plugin does not provide plugin commands.
 * * Note:
 * The mouse cursor will only be hidden if it is hovering on top of the the
 * game window.
 * * Modification:
 * Added a check for player movement capability and a specific switch 
 * to prevent the cursor from hiding.
 */

(() => {
    const PLUGIN_NAME = "N_HideIdleMouse";

    const parameters = PluginManager.parameters(PLUGIN_NAME);
    parameters.timeout = Number(parameters.timeout) || 3000;
    parameters.disableSwitch = Number(parameters.disableSwitch) || 0;

    const cursorHiddenClass = "cursorHidden";
    const element = document.documentElement;

    let mouseIdleTimeout = null;

    document.head.appendChild(document.createElement("style")).innerText = `.${cursorHiddenClass}, .${cursorHiddenClass} * { cursor: none !important; }`;

    window.addEventListener("mousemove", () => {
        showMouse();
        clearTimeout(mouseIdleTimeout);

        mouseIdleTimeout = setTimeout(hideMouse, parameters.timeout);
    });

    function showMouse() {
        element.classList.remove(cursorHiddenClass);
    };

    function hideMouse() {
        // Проверка: существует ли мир игры и переключатели
        if ($gamePlayer && $gameSwitches) {
            const canMove = $gamePlayer.canMove();
            const switchId = parameters.disableSwitch;
            const isSwitchOn = switchId > 0 ? $gameSwitches.value(switchId) : false;

            // Если контроль включен И переключатель включен — не скрываем
            if (canMove && isSwitchOn) {
                return;
            }
        }
        
        element.classList.add(cursorHiddenClass);
    };

    hideMouse(); // Hidden by default.
})();