import * as PIXI from "pixi.js";

export const app = new PIXI.Application();

export async function initPixi(container: HTMLElement) {
  await app.init({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundAlpha: 0,
    antialias: false,
    resolution: 1,
    autoDensity: false,
  });

  app.renderer.roundPixels = true;

  container.appendChild(app.canvas);
}