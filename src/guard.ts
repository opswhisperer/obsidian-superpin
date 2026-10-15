import { around } from 'monkey-around';
import { MarkdownView, ViewStateResult, OpenViewState, PaneType, parseLinktext, SplitDirection, TFile, ViewState, Workspace, WorkspaceLeaf } from 'obsidian';
import type SuperPinPlugin from './main';
import { fileOf } from './pinManager';

type ViewStateLike = Record<string, unknown> | undefined;

function withPreview<T extends ViewStateLike>(state: T): T {
	if (state && state.mode === 'source') return { ...state, mode: 'preview' };
	return state;
}

/**
 * Patches Obsidian's navigation entry points so Super Pin tabs can never be
 * navigated away from their note. Every patch is removed when the plugin unloads.
 *
 * - `Workspace.getLeaf`: when a pinned tab is focused, new and reused leaves come from the main area.
 * - `Workspace.openLinkText`: links into the pinned note itself (headings, blocks) stay in the pinned tab.
 * - `WorkspaceLeaf.openFile` / `setViewState`: anything that targets a pinned tab directly is redirected.
 * - `MarkdownView.setState`: keeps enforced pins in reading view.
 */
export function installGuards(plugin: SuperPinPlugin): void {
	const pins = plugin.pins;
	const app = plugin.app;

	plugin.register(
		around(Workspace.prototype, {
			getLeaf(next) {
				return function (this: Workspace, ...args: [newLeaf?: PaneType | boolean, direction?: SplitDirection]) {
					if (args[0] !== 'window' && pins.isGuarded(pins.activeLeaf)) pins.focusMain();
					return Reflect.apply(next, this, args) as WorkspaceLeaf;
				};
			},

			openLinkText(next) {
				return async function (this: Workspace, linktext: string, sourcePath: string, newLeaf?: PaneType | boolean, openViewState?: OpenViewState) {
					const active = pins.activeLeaf;
					if (!newLeaf && pins.isGuarded(active)) {
						const entry = pins.entryFor(active);
						const { path, subpath } = parseLinktext(linktext);
						const target = path ? app.metadataCache.getFirstLinkpathDest(path, sourcePath) : app.vault.getFileByPath(sourcePath);
						if (entry && target && target.path === entry.path) {
							await active.openFile(target, { ...openViewState, active: true, eState: { ...openViewState?.eState, subpath } });
							return;
						}
					}
					return next.call(this, linktext, sourcePath, newLeaf, openViewState);
				};
			},
		}),
	);

	plugin.register(
		around(WorkspaceLeaf.prototype, {
			openFile(next) {
				return async function (this: WorkspaceLeaf, file: TFile, openState?: OpenViewState) {
					const entry = pins.entryFor(this);
					if (!entry || pins.isBypassed(this)) return next.call(this, file, openState);

					if (file.path !== entry.path) {
						await pins.openInMain(file, openState);
						return;
					}
					const state = pins.isEnforced(entry) ? { ...openState?.state, mode: 'preview' } : openState?.state;
					return next.call(this, file, { ...openState, state });
				};
			},

			setViewState(next) {
				return async function (this: WorkspaceLeaf, viewState: ViewState, eState?: unknown) {
					const entry = pins.entryFor(this);
					if (!entry || pins.isBypassed(this)) return next.call(this, viewState, eState);

					const file = viewState.state?.file;
					const sameFile = file === undefined ? fileOf(this) === entry.path : file === entry.path;
					if (viewState.type !== 'markdown' && viewState.type !== this.getViewState().type) {
						// A different kind of view (graph, canvas, empty tab...) belongs in the main area.
						if (viewState.type !== 'empty') await pins.openViewInMain(viewState, eState);
						return;
					}
					if (!sameFile) {
						await pins.openViewInMain(viewState, eState);
						return;
					}
					const state = pins.isEnforced(entry) ? withPreview(viewState.state) : viewState.state;
					return next.call(this, { ...viewState, state, pinned: true }, eState);
				};
			},
		}),
	);

	plugin.register(
		around(MarkdownView.prototype, {
			setState(next) {
				return function (this: MarkdownView, state: unknown, result: ViewStateResult) {
					const entry = this.leaf ? pins.entryFor(this.leaf) : undefined;
					if (entry && pins.isEnforced(entry) && state && typeof state === 'object') {
						state = withPreview(state as Record<string, unknown>);
					}
					return next.call(this, state, result);
				} as typeof next;
			},
		}),
	);
}
