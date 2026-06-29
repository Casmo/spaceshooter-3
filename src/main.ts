import { Application } from "pixi.js";
import { loadAssets } from "./assets";
import { initAudio, playMusic } from "./game/audio";
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
  await initAudio();

  // Assets and audio are ready; drop the HTML loading overlay (see index.html).
  document.getElementById("loader")?.remove();

  // Looping background music plays under every scene. The actual start is
  // deferred behind the first user gesture (browser autoplay policy, ADR-0014).
  playMusic();

  const manager = new SceneManager(app);
  manager.changeScene(new MenuScene(manager));
})();
