import { Application } from "pixi.js";
import { loadAssets } from "./assets";
import { SceneManager } from "./core/SceneManager";
import { MenuScene } from "./scenes/MenuScene";

(async () => {
  const app = new Application();
  await app.init({
    background: "#000000",
    resizeTo: window,
    antialias: true,
  });

  document.getElementById("pixi-container")!.appendChild(app.canvas);

  await loadAssets();

  const manager = new SceneManager(app);
  manager.changeScene(new MenuScene(manager));
})();
