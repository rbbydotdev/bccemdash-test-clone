// EmDash Live Content Collections: all content types flow through the single
// _emdash collection; query with getEmDashCollection()/getEmDashEntry().
import { defineLiveCollection } from "astro:content";
import { emdashLoader } from "emdash/runtime";

export const collections = {
	_emdash: defineLiveCollection({ loader: emdashLoader() }),
};
