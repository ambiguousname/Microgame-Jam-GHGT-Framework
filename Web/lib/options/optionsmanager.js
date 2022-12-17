import {Selectable, MenuVectorField, MenuVector} from "./menulib.js";
import GlobalInputManager, {MicrogameKeyboard} from "../input.js";
import GlobalGameLoader from "../../gameloader.js";

class GameList extends Selectable {
    #selected = 0;
    #optionFields = [];
    constructor(baseElement) {
        super(baseElement);
        for (var i = 0; i < this.element.children.length; i++) {
            var child = this.element.children[i];
            var options = child.querySelector(".game-options");
            var selectables = Selectable.generateSelectablesArr(options, new MenuVector(0, 0), "isSelectable");
            
            this.#optionFields.push({field: new MenuVectorField(selectables, 0), element: options, selectables: selectables});
        }
        this.#optionsSubSelect = false;
        this.#optionsPick = -1;
    }

    #optionsSubSelect = false;
    #optionsPick = -1;

    optionsSelect(direction, inputReader){
        if (direction.x !== 0 && this.#optionFields[this.#selected].selectables[this.#optionsPick].element.type === "range") {
            var element = this.#optionFields[this.#selected].selectables[this.#optionsPick].element;
            var volumeVal = parseInt(element.value);
            element.value = (volumeVal + (direction.x * 1));
            element.dispatchEvent(new Event("input"));
            return;
        }
        var pick = this.#optionFields[this.#selected].field.getFromDir(direction);
        if (pick === -1) {
            if (direction.y === -1) {
                this.#optionsSubSelect = false;
                this.#optionsPick = -1;
            }
            if (direction.y === 1) {
                this.#optionsSubSelect = false;
                if (this.#selected < this.element.children.length - 1) {
                    this.#selected++;
                }
                this.#optionsPick = -1;
            }
            if (direction.x === -1) {
                inputReader.setElement(0);
                return true;
            }
        } else {
            this.#optionsPick = pick;
        }
    }

    // Pick an element to select from a direction.
    selectElement(direction, inputReader){
        if (this.#optionsSubSelect) {
            if (this.optionsSelect(direction, inputReader)) {
                return;
            }
        } else {
            if (direction.x === -1) {
                inputReader.setElement(0);
                return;
            }
            
            this.clearSelect();

            if (direction.y === 1 && this.#selected < this.element.children.length) {
                if (this.element.children[this.#selected].className === "active") {
                    this.#optionsSubSelect = true;
                    this.#optionsPick = 0;
                    this.#optionFields[this.#selected].field.currPos = 0;
                } else if (this.#selected < this.element.children.length - 1) {
                    this.#selected++;
                }
            }
            if (direction.y === -1 && this.#selected > 0) {    
                if (this.element.children[this.#selected - 1].className === "active") {
                    this.#optionsSubSelect = true;
                    this.#optionsPick = this.#optionFields[this.#selected - 1].selectables.length - 1;
                    this.#optionFields[this.#selected - 1].field.currPos = this.#optionsPick;
                }
                this.#selected--;
            }
        }
        this.select();
    }

    // Actually hover over the selected element. 
    // Called when this element is first selected (and gets overrided by selectElement for subsequent calls with the arrow keys).
    select() {
        if (this.#optionsSubSelect) {
            this.#optionFields[this.#selected].selectables[this.#optionsPick].element.classList.add("hover");
        } else {
            var selected = this.element.children[this.#selected];
            selected.classList.add("hover");

            var selectedPos = selected.offsetTop - this.element.scrollTop;
            while (selectedPos + selected.offsetHeight > this.element.offsetHeight) {
                this.element.scrollTop += selected.offsetHeight;
                selectedPos = selected.offsetTop - this.element.scrollTop;
            }

            while (selectedPos < 0) {
                this.element.scrollTop -= selected.offsetHeight;
                selectedPos = selected.offsetTop - this.element.scrollTop;
            }
        }
    }

    click() {
        if (this.#optionsSubSelect) {
            this.#optionFields[this.#selected].selectables[this.#optionsPick].element.click();
        } else {
            this.element.children[this.#selected].click();
            
            if (this.#selected === this.element.children.length - 1) {
                // Because if you click on the bottom, it doesn't scroll to the expanded options. This is a cheap fix.
                var scrollTo = setInterval(function(){
                    this.element.scrollTo(0, this.element.scrollHeight + 200);
                    if (this.element.children[this.#selected].scrollHeight > 240 || this.#selected !== this.element.children.length - 1) {
                        clearInterval(scrollTo);
                    }
                }.bind(this), 1);
            }
        }
    }

    clearSelect() {
        if (this.#optionsSubSelect) {
            this.#optionFields[this.#selected].selectables[this.#optionsPick].element.classList.remove("hover");
        } else {
            this.element.children[this.#selected].classList.remove("hover");
        }
    }
}

export class OptionsManager {
	#currentOption = "all";
    #MainMenuManager;
    #enabledGames = new Set();
    #optionsSelect;
    #optionsStorage;

	constructor(MainMenuManager) {
        this.#optionsStorage = localStorage.getItem("options");
        if (this.#optionsStorage === null) {
            this.#optionsStorage = {};
        } else {
            // From https://stackoverflow.com/questions/29085197/how-do-you-json-stringify-an-es6-map
            this.#optionsStorage = JSON.parse(this.#optionsStorage, (key, value) => {
                if (typeof value === "object" && value !== null) {
                    if (value.dataType === "Map") {
                        return new Map(value.value);
                    }
                }
                return value;
            });
            for (var game in this.#optionsStorage) {
                var gameOption = this.#optionsStorage[game]
                for (var dir in gameOption.dir) {
                    GlobalInputManager.clearBindings(game, dir);
                    GlobalInputManager.setBindingFromOption(game, dir, gameOption.dir[dir]);   
                }
            }
        }

        this.#MainMenuManager = MainMenuManager;

        this.#optionsSelect = document.getElementById("options-select-games");

		var gameNames = {all : "Microgame Settings (All Games)", ... GlobalGameLoader.gameNames};

        Object.keys(gameNames).forEach((game) => {
            if (!(game in this.#optionsStorage)) {
                this.#optionsStorage[game] = {
                    enabled: true
                };
            }

            var div = document.createElement("div");
            var gameName = gameNames[game];
            
            var gameSelectDiv = document.createElement("div");
            gameSelectDiv.className = "game-select";

            if (game !== "all"){
                var check = document.createElement("input");
                check.type = "checkbox";
                check.id = game + "enable";
                check.checked = this.#optionsStorage[game].enabled;
                check.name = game + "enable";
                gameSelectDiv.appendChild(check);
                check.oninput = this.updateEnabled.bind(this, game);

                if (this.#optionsStorage[game].enabled) {
                    this.#enabledGames.add(game);
                }
            }
            var label = document.createElement("label");
            label.innerText = gameName;

            // We want to be able to click each game to set individual settings.
            // label.htmlFor = game + "enable";
            gameSelectDiv.appendChild(label);

            div.appendChild(gameSelectDiv);

            div.id = "options-select-games-" + game;

            div.onclick = this.#swapToOptions.bind(this, game);

            var optionsDiv = document.createElement("div");
            optionsDiv.id = "game-options-" + game;
            optionsDiv.className = "game-options";

            if (game !== "all"){
                var enabledP = document.createElement("p");
                enabledP.className = "game-enable";
                enabledP.name = "game-enable";

                var enabledCheck = document.createElement("input");
                enabledCheck.type = "checkbox";
                enabledCheck.checked = this.#optionsStorage[game].enabled;
                enabledCheck.id = game + "-options-enable";
                enabledCheck.oninput = this.updateEnabled.bind(this, game);

                var enabledLabel = document.createElement("label");
                enabledLabel.innerText = "Enabled";
                enabledLabel.htmlFor = game + "-options-enable";

                enabledP.appendChild(enabledCheck);
                enabledP.appendChild(enabledLabel);

                optionsDiv.appendChild(enabledP);
            }

            var remapDiv = document.createElement("div");
            remapDiv.className = "remap-options";

            var dirs = ["Up", "Right", "Down", "Left", "Space"];

            dirs.forEach(function(d){
                var direction = document.createElement("div");
                direction.className = "remap-" + d;

                var text = document.createElement("p");
                text.innerText = d + " Bindings:";

                direction.appendChild(text);

                var bindButtonP = document.createElement("p");
                var bindButton = document.createElement("button");

                var bindingName = "Arrow" + d;
                if (d === "Space") {
                    bindingName = " ";
                }
                bindButton.onclick = this.updateBinding.bind(this, game, bindingName);
                var bindButtonText = document.createElement("div");
                bindButtonText.className = "remap-button-text";

                var strings = GlobalInputManager.getBindingsStrings(game);
                if (d.toLowerCase() in strings) {
                    bindButtonText.innerText = strings[d.toLowerCase()];
                }

                bindButton.appendChild(bindButtonText);

                var bindBackground = document.createElement("div");
                bindBackground.className = "remap-button-background";

                var bindMaskSize = Math.floor(Math.random() * 100) + 100;

                bindBackground.style.maskSize = bindMaskSize + "%";
                bindBackground.style.maskPosition = Math.floor(Math.random() * 100) + "% " + Math.floor(Math.random() * 100) + "%";

                bindButton.appendChild(bindBackground);

                bindButtonP.className = "bind-button";

                bindButtonP.appendChild(bindButton);
                
                direction.appendChild(bindButtonP);

                var clearButtonP = document.createElement("p");
                var clearButton = document.createElement("button");

                clearButton.onclick = this.clearBindButton.bind(this, game, bindingName);

                clearButtonP.className = "clear-button";

                var clearButtonText = document.createElement("div");
                clearButtonText.className = "remap-button-text";
                if (bindButtonText.innerText.length === 0) {
                    clearButtonText.innerText = "Reset";
                } else {
                    clearButtonText.innerText = "Clear";
                }
                clearButton.appendChild(clearButtonText);

                var clearButtonBackground = document.createElement("div");
                clearButtonBackground.className = "remap-button-background";

                var clearMaskSize = Math.floor(Math.random() * 100) + 100;
                clearButtonBackground.style.maskSize = clearMaskSize + "%";
                clearButtonBackground.style.maskPosition = Math.floor(Math.random() * 100) + "% " + Math.floor(Math.random() * 100) + "%";
                
                clearButton.appendChild(clearButtonBackground);

                clearButtonP.appendChild(clearButton);
                direction.appendChild(clearButtonP);

                remapDiv.appendChild(direction);
            }, this);

            optionsDiv.appendChild(remapDiv);

            div.appendChild(optionsDiv);

            this.#optionsSelect.appendChild(div);
        }, this);

        // We can't add directly to innerHTML because it'll mess with the events.

        document.getElementById("game-options-all").insertAdjacentHTML("afterbegin", `
        <div style="float: left; height: 92px; width: 50px; margin-left: 10px;" id="game-options-all-volume">
            <p style="width: 170px; text-align: center;">Main Menu Volume</p>
            <input id="options-volume" type="range" min="1" max="100" value="100"/>
        </div>`);

        document.getElementById("options-select-games-all").className = "active";

        this.optionsSave();
	}

    optionsSave() {
        // From https://stackoverflow.com/questions/29085197/how-do-you-json-stringify-an-es6-map
        localStorage.setItem("options", JSON.stringify(this.#optionsStorage, (key, value) => {
            if (value instanceof Map) {
                return {
                    dataType: "Map",
                    value: [...value]
                }
            } else if (key === "type" && typeof value === "function") {
                return value.name
            } else {
                return value;
            }
        }));
    }

    updateEnabled(game, event) {
        var enabled = event.target.checked;
        if (enabled) {
            this.#enabledGames.add(enabled);
        } else {
            this.#enabledGames.delete(enabled);
        }
        this.#optionsStorage[game].enabled = enabled;

        document.getElementById(game + "enable").checked = event.target.checked;
        document.getElementById(game + "-options-enable").checked = event.target.checked;
        
        this.optionsSave();
    }

    #selectPressed = false;

    updateBindingCapture(target, game, bindingName, bindingPressed) {
        if (!MicrogameKeyboard.allKeysDown.has(" ")) {
            this.#selectPressed = false;
        }
        if (!this.#selectPressed && bindingPressed !== null){
            var has = GlobalInputManager.hasBinding(game, bindingPressed);
            if (has.has) {
                // If the binding exists anywhere else in the control scheme, we don't update it:
                target.innerText = (bindingPressed.control === " " ? "Space" : bindingPressed.control) + " Already Bound";
                setTimeout(() => {
                    target.innerText = GlobalInputManager.getBindingsStringsByBindingName(game)[bindingName];
                }, 1000);
                this.#bindingTarget = null;
                return true;
            }
            GlobalInputManager.addBinding(game, bindingName, bindingPressed);
            target.innerText = GlobalInputManager.getBindingsStringsByBindingName(game)[bindingName];

            if (!("dir" in this.#optionsStorage[game])) {
                this.#optionsStorage[game].dir = {
                    ...GlobalInputManager.getAllBindings(game)
                };
            }
            this.#MainMenuManager.pauseInputs(100);
            this.#optionsStorage[game].dir[bindingName].set(bindingPressed.control, bindingPressed);
            this.optionsSave();
            this.#bindingTarget = null;
            return true;
        }
    }

    stopBinding() {
        if (this.#bindingTarget !== null){
            this.#bindingTarget.element.innerText = GlobalInputManager.getBindingsStringsByBindingName(this.#bindingTarget.gameName)[this.#bindingTarget.bindingName];
            GlobalInputManager.cancelCaptureInput();
            this.#bindingTarget = null;
        }
    }

    #bindingTarget = null;

    updateBinding(game, bindingName, event) {
        if (this.#bindingTarget !== null) {
            this.stopBinding();
        }
        var target = event.currentTarget.querySelector(".remap-button-text");
        // Additionally, if we're already capturing a binding, don't update our behavior.
        if (target.innerText.includes("Already Bound")){
            return;
        }
        target.innerText = "<<Press>>";
        this.#bindingTarget = {element: target, bindingName: bindingName, gameName: game};
        this.#selectPressed = true;
        GlobalInputManager.captureNextInput(this.updateBindingCapture.bind(this, target, game, bindingName));
        event.currentTarget.parentElement.parentElement.querySelector(".clear-button .remap-button-text").innerText = "Clear";
    }

    clearBindButton(game, bindingName, ev) {
        if (this.#bindingTarget !== null) {
            this.stopBinding();
        }
        if (!("dir" in this.#optionsStorage[game])) {
            this.#optionsStorage[game].dir = {
                ...GlobalInputManager.getAllBindings(game)
            };
        }
        if (ev.currentTarget.querySelector(".remap-button-text").innerText === "Reset") {
            this.resetBindings(game, bindingName);
            ev.currentTarget.parentElement.parentElement.querySelector(".bind-button .remap-button-text").innerText = GlobalInputManager.getBindingsStringsByBindingName(game)[bindingName];
            ev.currentTarget.querySelector(".remap-button-text").innerText = "Clear";
        } else {
            ev.currentTarget.parentElement.parentElement.querySelector(".bind-button .remap-button-text").innerText = "";
            this.clearBindings(game, bindingName);
            this.#optionsStorage[game].dir[bindingName].clear();
            ev.currentTarget.querySelector(".remap-button-text").innerText = "Reset";
        }
        this.optionsSave();
    }

    resetBindings(gameName, bindingName) {
        GlobalInputManager.resetBindings(gameName, bindingName);
        this.#optionsStorage[gameName].dir[bindingName] = GlobalInputManager.getAllBindings(gameName)[bindingName];
    }

    clearBindings(gameName, bindingName) {
        GlobalInputManager.clearBindings(gameName, bindingName);
        this.#optionsStorage[gameName].dir[bindingName].clear();
    }

    startManagingOptions() {
        this.#MainMenuManager.addSelectable(new GameList(this.#optionsSelect));
    }

    get enabledGames() {
        return this.#enabledGames;
    }

	#swapToOptions(gameName) {
        if (this.#currentOption !== gameName) {
            if (this.#bindingTarget !== null) {
                this.stopBinding();
            }
            document.getElementById("options-select-games-" + this.#currentOption).classList.remove("active");
            document.getElementById("options-select-games-" + gameName).classList.add("active");
            this.#currentOption = gameName;
        }
	}
}