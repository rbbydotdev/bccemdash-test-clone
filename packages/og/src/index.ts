/**
 * @myemdash/og — Takumi-rendered Open Graph cards styled after the site hero.
 *
 *   const png = await renderOgCard({ eyebrow, titleLine1, titleLine2, subhead,
 *                                    colors, imageBytes });
 */
export { renderOgCard, type RenderCardOptions } from "./render.js";
export { OG_WIDTH, OG_HEIGHT, type CardColors, type CardContent } from "./card.js";
