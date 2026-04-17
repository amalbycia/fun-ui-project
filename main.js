/**
 * CRT Terminal — Entry Point
 *
 * All source code lives in src/. This file just kicks off the boot sequence.
 *
 * src/
 *   constants.js      — immutable app-wide constants (THEMES, MENU, etc.)
 *   state.js          — single shared mutable state object
 *   theme.js          — live THEME proxy + AMBER colour helpers
 *   utils.js          — canvas helpers, typewriter, hit registration
 *   data.js           — page data (films, socials, library, arcade)
 *   shaders.js        — WebGL VERT + FRAG source
 *   renderer.js       — drawTerminal, sidebar, ascii, footer, boot overlay
 *   interaction.js    — boot(), openPage(), closePage(), all event handlers
 *   pages/
 *     library.js      — folder grid + site list with scrollability
 *     letterboxd.js   — film diary
 *     socials.js      — links & handles + twitter error
 *     music.js        — Last.fm now-playing + recent tracks
 *     discord.js      — Discord profile card
 *     arcade.js       — game catalogue hub
 *     doom.js         — WASM Doom integration
 *     mario.js        — Mario iframe wrapper
 */

import { boot } from './src/interaction.js';

boot();
