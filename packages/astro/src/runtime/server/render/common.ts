import type { SSRResult } from '../../../@types/astro';
import type { RenderInstruction } from './types.js';

import { HTMLBytes, markHTMLString } from '../escape.js';
import {
	determineIfNeedsHydrationScript,
	determinesIfNeedsDirectiveScript,
	getPrescripts,
	PrescriptType,
} from '../scripts.js';
import { renderAllHeadContent } from './head.js';
import { ScopeFlags } from './scope.js';
import { isSlotString, type SlotString } from './slot.js';

export const Fragment = Symbol.for('astro:fragment');
export const Renderer = Symbol.for('astro:renderer');

export const encoder = new TextEncoder();
export const decoder = new TextDecoder();

// Rendering produces either marked strings of HTML or instructions for hydration.
// These directive instructions bubble all the way up to renderPage so that we
// can ensure they are added only once, and as soon as possible.
export function stringifyChunk(result: SSRResult, chunk: string | SlotString | RenderInstruction) {
	if (typeof (chunk as any).type === 'string') {
		const instruction = chunk as RenderInstruction;
		switch (instruction.type) {
			case 'directive': {
				const { hydration } = instruction;
				let needsHydrationScript = hydration && determineIfNeedsHydrationScript(result);
				let needsDirectiveScript =
					hydration && determinesIfNeedsDirectiveScript(result, hydration.directive);

				let prescriptType: PrescriptType = needsHydrationScript
					? 'both'
					: needsDirectiveScript
					? 'directive'
					: null;
				if (prescriptType) {
					let prescripts = getPrescripts(prescriptType, hydration.directive);
					return markHTMLString(prescripts);
				} else {
					return '';
				}
			}
			case 'head': {
				if (result._metadata.hasRenderedHead) {
					return '';
				}
				return renderAllHeadContent(result);
			}
			case 'maybe-head': {
				if (result._metadata.hasRenderedHead) {
					return '';
				}

				const scope = instruction.scope;
				switch (scope) {
					// JSX with an Astro slot
					case ScopeFlags.JSX | ScopeFlags.Slot | ScopeFlags.Astro:
					case ScopeFlags.JSX | ScopeFlags.Astro | ScopeFlags.HeadBuffer:
					case ScopeFlags.JSX | ScopeFlags.Slot | ScopeFlags.Astro | ScopeFlags.HeadBuffer: {
						return '';
					}

					// Astro.slots.render('default') should never render head content.
					case ScopeFlags.RenderSlot | ScopeFlags.Astro:
					case ScopeFlags.RenderSlot | ScopeFlags.Astro | ScopeFlags.JSX:
					case ScopeFlags.RenderSlot | ScopeFlags.Astro | ScopeFlags.JSX | ScopeFlags.HeadBuffer: {
						return '';
					}
				}

				return renderAllHeadContent(result);
			}
		}
	} else {
		if (isSlotString(chunk as string)) {
			let out = '';
			const c = chunk as SlotString;
			if (c.instructions) {
				for (const instr of c.instructions) {
					out += stringifyChunk(result, instr);
				}
			}
			out += chunk.toString();
			return out;
		}

		return chunk.toString();
	}
}

export class HTMLParts {
	public parts: string;
	constructor() {
		this.parts = '';
	}
	append(part: string | HTMLBytes | RenderInstruction, result: SSRResult) {
		if (ArrayBuffer.isView(part)) {
			this.parts += decoder.decode(part);
		} else {
			this.parts += stringifyChunk(result, part);
		}
	}
	toString() {
		return this.parts;
	}
	toArrayBuffer() {
		return encoder.encode(this.parts);
	}
}

export function chunkToByteArray(
	result: SSRResult,
	chunk: string | HTMLBytes | RenderInstruction
): Uint8Array {
	if (chunk instanceof Uint8Array) {
		return chunk as Uint8Array;
	}
	// stringify chunk might return a HTMLString
	let stringified = stringifyChunk(result, chunk);
	return encoder.encode(stringified.toString());
}
