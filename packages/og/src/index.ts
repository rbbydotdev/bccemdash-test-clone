/**
 * @myemdash/og — Takumi-rendered Open Graph cards.
 *
 * Scene-based: a card is plain JSON (absolutely-positioned layers with CSS
 * styling, `@colour` tokens and `{{content.bindings}}`) that renders to PNG
 * here and to DOM in the admin editor, from the same source of truth.
 */
export { renderScene, sceneToNode, type RenderSceneOptions, type SceneImage } from "./render-scene.js";
export {
	DEFAULT_WIDTH,
	DEFAULT_HEIGHT,
	FONT_FAMILY,
	collectMediaRefs,
	layerFrameStyle,
	layerText,
	resolveBindings,
	resolveColor,
	textStyle,
	withAlpha,
	type BaseLayer,
	type ImageLayer,
	type OgLayer,
	type OgScene,
	type SceneColors,
	type SceneContext,
	type ShapeLayer,
	type TextLayer,
} from "./scene.js";
export { builtInTemplates, heroTemplate, type OgTemplate } from "./templates.js";
