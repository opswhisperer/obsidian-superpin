import { App, EventRef, MarkdownView, Notice, OpenViewState, TFile, ViewState, WorkspaceLeaf, WorkspaceSplit } from 'obsidian';
import type SuperPinPlugin from './main';
import type { PinEntry } from './settings';

const TAB_CLASS = 'super-pin-tab';
const VIEW_CLASS = 'super-pin-view';

/** Internal leaf fields that are stable across Obsidian versions but not part of the public API. */
interface LeafInternals {
	id?: string;
	tabHeaderEl?: HTMLElement;
}

interface ParentInternals {
	children?: unknown[];
}

function internals(leaf: WorkspaceLeaf): LeafInternals {
	return leaf as unknown as LeafInternals;
}

/** File path a leaf is showing, read from its view state so it also works for deferred leaves. */
export function fileOf(leaf: WorkspaceLeaf): string | undefined {
	const file = leaf.getViewState().state?.file;
	return typeof file === 'string' ? file : undefined;
}

/**
 * Every leaf in the workspace. Note that `iterate*Leaves` stops early when the
 * callback returns a truthy value, so callbacks must never return anything.
 */
function allLeaves(app: App): WorkspaceLeaf[] {
	const leaves: WorkspaceLeaf[] = [];
	app.workspace.iterateAllLeaves((leaf) => {
		leaves.push(leaf);
	});
	return leaves;
}

/**
 * Tracks which workspace leaves are Super Pin tabs and keeps them showing their note.
 */
export class PinManager {
	private app: App;
	private plugin: SuperPinPlugin;
	private leaves = new Map<WorkspaceLeaf, PinEntry>();
	private pinRefs = new Map<WorkspaceLeaf, EventRef>();
	/** Leaves Super Pin is navigating itself; the guards let these changes through. */
	private bypass = new WeakSet<WorkspaceLeaf>();
	/** When each pin was last reopened after its tab closed, to stop reopen loops. */
	private reopened = new Map<string, number>();
	/** Most recently active leaf, tracked via `active-leaf-change`. */
	activeLeaf: WorkspaceLeaf | null = null;

	constructor(plugin: SuperPinPlugin) {
		this.plugin = plugin;
		this.app = plugin.app;
	}

	get settings() {
		return this.plugin.settings;
	}

	isGuarded(leaf: WorkspaceLeaf | null | undefined): leaf is WorkspaceLeaf {
		return !!leaf && this.leaves.has(leaf);
	}

	isBypassed(leaf: WorkspaceLeaf): boolean {
		return this.bypass.has(leaf);
	}

	entryFor(leaf: WorkspaceLeaf): PinEntry | undefined {
		return this.leaves.get(leaf);
	}

	leafFor(path: string): WorkspaceLeaf | undefined {
		for (const [leaf, entry] of this.leaves) {
			if (entry.path === path) return leaf;
		}
		return undefined;
	}

	isPinned(path: string): boolean {
		return this.settings.pins.some((p) => p.path === path);
	}

	isEnforced(entry: PinEntry): boolean {
		if (entry.readingMode === 'on') return true;
		if (entry.readingMode === 'off') return false;
		return this.settings.enforceReadingDefault;
	}

	private openState(entry: PinEntry): OpenViewState {
		return { active: false, state: this.isEnforced(entry) ? { mode: 'preview' } : undefined };
	}

	private async withBypass<T>(leaf: WorkspaceLeaf, fn: () => Promise<T>): Promise<T> {
		this.bypass.add(leaf);
		try {
			return await fn();
		} finally {
			this.bypass.delete(leaf);
		}
	}

	// ---------------------------------------------------------------------------
	// Pin lifecycle

	async pin(file: TFile): Promise<void> {
		const existing = this.leafFor(file.path);
		if (existing) {
			await this.app.workspace.revealLeaf(existing);
			return;
		}
		let entry = this.settings.pins.find((p) => p.path === file.path);
		if (!entry) {
			entry = { path: file.path, readingMode: 'default' };
			this.settings.pins.push(entry);
		}
		await this.ensureLeaf(entry, true);
		await this.plugin.saveSettings();
	}

	async unpin(path: string, closeTab = true): Promise<void> {
		this.settings.pins = this.settings.pins.filter((p) => p.path !== path);
		const leaf = this.leafFor(path);
		if (leaf) {
			this.unguard(leaf);
			leaf.setPinned(false);
			if (closeTab) leaf.detach();
		}
		await this.plugin.saveSettings();
	}

	/** Make sure a pin has a guarded leaf in the right sidebar, creating one if needed. */
	async ensureLeaf(entry: PinEntry, reveal: boolean): Promise<WorkspaceLeaf | null> {
		const file = this.app.vault.getFileByPath(entry.path);
		if (!file) return null;

		let leaf = this.leafFor(entry.path) ?? null;
		const existing = leaf ? undefined : this.findSidebarLeaf(entry.path);
		if (existing) {
			leaf = existing;
			this.guard(leaf, entry);
		}
		if (!leaf) {
			leaf = this.createSidebarLeaf();
			if (!leaf) {
				new Notice('Could not open a tab in the right sidebar.');
				return null;
			}
			this.guard(leaf, entry);
			const target = leaf;
			await this.withBypass(target, () => target.openFile(file, this.openState(entry)));
		}
		leaf.setPinned(true);
		entry.leafId = internals(leaf).id;
		this.decorate(leaf);
		if (reveal) await this.app.workspace.revealLeaf(leaf);
		return leaf;
	}

	/** New tab in the same right-sidebar tab group as existing pins, so pins sit side by side. */
	private createSidebarLeaf(): WorkspaceLeaf | null {
		const ws = this.app.workspace;
		for (const leaf of this.leaves.keys()) {
			if (leaf.getRoot() !== ws.rightSplit) continue;
			const parent = leaf.parent as unknown as WorkspaceSplit & ParentInternals;
			const index = parent.children?.length ?? 0;
			return ws.createLeafInParent(parent, index);
		}
		return ws.getRightLeaf(false);
	}

	/**
	 * Attach saved pins to the leaves Obsidian restored from the workspace layout,
	 * and recreate any that are missing.
	 */
	async restoreAll(force: boolean): Promise<void> {
		const byId = new Map<string, WorkspaceLeaf>();
		for (const leaf of allLeaves(this.app)) {
			const id = internals(leaf).id;
			if (id) byId.set(id, leaf);
		}

		for (const entry of [...this.settings.pins]) {
			if (!this.app.vault.getFileByPath(entry.path)) {
				this.settings.pins.remove(entry);
				continue;
			}
			if (this.leafFor(entry.path)) continue;

			let leaf = entry.leafId ? byId.get(entry.leafId) : undefined;
			if (leaf && (fileOf(leaf) !== entry.path || this.isGuarded(leaf))) leaf = undefined;
			leaf ??= this.findSidebarLeaf(entry.path);

			if (leaf) {
				this.guard(leaf, entry);
				leaf.setPinned(true);
				entry.leafId = internals(leaf).id;
				this.decorate(leaf);
			} else if (force || this.settings.restoreOnStartup) {
				await this.ensureLeaf(entry, false);
			}
		}
		this.closeDuplicates();
		await this.plugin.saveSettings();
		this.enforceAll();
	}

	/** Unguarded right-sidebar leaves showing `path`. */
	private sidebarLeavesFor(path: string): WorkspaceLeaf[] {
		const right = this.app.workspace.rightSplit;
		return allLeaves(this.app).filter((leaf) => leaf.getRoot() === right && fileOf(leaf) === path && !this.isGuarded(leaf));
	}

	private findSidebarLeaf(path: string): WorkspaceLeaf | undefined {
		return this.sidebarLeavesFor(path)[0];
	}

	/** Close extra natively pinned right-sidebar copies of a Super Pin note. */
	private closeDuplicates(): void {
		for (const leaf of this.leaves.keys()) {
			const entry = this.leaves.get(leaf);
			if (!entry) continue;
			for (const dup of this.sidebarLeavesFor(entry.path)) {
				if (dup.getViewState().pinned) dup.detach();
			}
		}
	}

	private guard(leaf: WorkspaceLeaf, entry: PinEntry): void {
		this.leaves.set(leaf, entry);
		if (!this.pinRefs.has(leaf)) {
			const ref = leaf.on('pinned-change', (pinned) => {
				// The native pin can be toggled from the tab header; a Super Pin stays pinned
				// until it is removed with the Super Pin command or menu item.
				if (!pinned && this.isGuarded(leaf)) leaf.setPinned(true);
			});
			this.pinRefs.set(leaf, ref);
		}
	}

	private unguard(leaf: WorkspaceLeaf): void {
		this.leaves.delete(leaf);
		const ref = this.pinRefs.get(leaf);
		if (ref) leaf.offref(ref);
		this.pinRefs.delete(leaf);
		this.undecorate(leaf);
	}

	private decorate(leaf: WorkspaceLeaf): void {
		internals(leaf).tabHeaderEl?.addClass(TAB_CLASS);
		leaf.view?.containerEl.addClass(VIEW_CLASS);
	}

	private undecorate(leaf: WorkspaceLeaf): void {
		internals(leaf).tabHeaderEl?.removeClass(TAB_CLASS);
		leaf.view?.containerEl.removeClass(VIEW_CLASS);
	}

	/** Called on unload: stop guarding without touching the leaves themselves. */
	releaseAll(): void {
		for (const leaf of [...this.leaves.keys()]) this.unguard(leaf);
	}

	// ---------------------------------------------------------------------------
	// Enforcement

	enforceAll(): void {
		for (const [leaf, entry] of this.leaves) void this.enforce(leaf, entry);
	}

	private async enforce(leaf: WorkspaceLeaf, entry: PinEntry): Promise<void> {
		if (!this.isEnforced(entry) || leaf.isDeferred) return;
		const view = leaf.view;
		if (view instanceof MarkdownView && view.getMode() === 'source') {
			await this.withBypass(leaf, () => view.setState({ ...view.getState(), mode: 'preview' }, { history: false }));
		}
	}

	/** Safety net for anything the guards did not intercept. Runs on every layout change. */
	checkLeaves(): void {
		const alive = new Set(allLeaves(this.app));

		for (const [leaf, entry] of [...this.leaves]) {
			if (!alive.has(leaf)) {
				void this.handleClosed(leaf, entry);
				continue;
			}
			if (this.bypass.has(leaf)) continue;
			if (!leaf.getViewState().pinned) leaf.setPinned(true);
			if (fileOf(leaf) !== entry.path) {
				void this.restoreLeaf(leaf, entry);
				continue;
			}
			this.decorate(leaf);
			void this.enforce(leaf, entry);
		}
	}

	private async handleClosed(leaf: WorkspaceLeaf, entry: PinEntry): Promise<void> {
		this.unguard(leaf);
		if (this.settings.closeTabUnpins) {
			this.settings.pins.remove(entry);
			await this.plugin.saveSettings();
		} else {
			// Never reopen the same pin in a tight loop, whatever the cause.
			const now = Date.now();
			const last = this.reopened.get(entry.path) ?? 0;
			this.reopened.set(entry.path, now);
			if (now - last < 2000) {
				console.error(`Super Pin: stopped reopening "${entry.path}" repeatedly.`);
				return;
			}
			await this.ensureLeaf(entry, false);
			await this.plugin.saveSettings();
		}
	}

	private async restoreLeaf(leaf: WorkspaceLeaf, entry: PinEntry): Promise<void> {
		const file = this.app.vault.getFileByPath(entry.path);
		if (!file) {
			this.unguard(leaf);
			this.settings.pins.remove(entry);
			await this.plugin.saveSettings();
			return;
		}
		await this.withBypass(leaf, () => leaf.openFile(file, this.openState(entry)));
	}

	// ---------------------------------------------------------------------------
	// Vault events

	async onRename(file: TFile, oldPath: string): Promise<void> {
		const entry = this.settings.pins.find((p) => p.path === oldPath);
		if (!entry) return;
		entry.path = file.path;
		await this.plugin.saveSettings();
	}

	async onDelete(path: string): Promise<void> {
		if (!this.isPinned(path)) return;
		await this.unpin(path, true);
	}

	// ---------------------------------------------------------------------------
	// Redirect targets

	/** A leaf in the main area that is safe to navigate, preferring the most recently used one. */
	mainLeaf(): WorkspaceLeaf | null {
		const ws = this.app.workspace;
		const recent = ws.getMostRecentLeaf(ws.rootSplit);
		if (recent && !this.isGuarded(recent)) return recent;
		let found: WorkspaceLeaf | null = null;
		ws.iterateRootLeaves((leaf) => {
			if (!found && !this.isGuarded(leaf)) found = leaf;
		});
		return found;
	}

	/** Make the main area active so that Obsidian's own leaf selection lands there. */
	focusMain(): boolean {
		const main = this.mainLeaf();
		if (!main) return false;
		this.app.workspace.setActiveLeaf(main, { focus: false });
		return true;
	}

	private targetLeaf(): WorkspaceLeaf {
		const ws = this.app.workspace;
		if (this.focusMain()) return ws.getLeaf(false);
		return ws.createLeafInParent(ws.rootSplit, 0);
	}

	async openInMain(file: TFile, openState?: OpenViewState): Promise<void> {
		await this.targetLeaf().openFile(file, openState);
	}

	async openViewInMain(viewState: ViewState, eState?: unknown): Promise<void> {
		await this.targetLeaf().setViewState(viewState, eState);
	}
}
