import { FuzzySuggestModal, Plugin, TFile } from 'obsidian';
import { installGuards } from './guard';
import { registerMenus } from './menus';
import { PinManager } from './pinManager';
import { DEFAULT_SETTINGS, PinEntry, SuperPinSettings, SuperPinSettingTab } from './settings';

export default class SuperPinPlugin extends Plugin {
	settings: SuperPinSettings = DEFAULT_SETTINGS;
	pins!: PinManager;

	async onload() {
		await this.loadSettings();
		this.pins = new PinManager(this);

		installGuards(this);
		registerMenus(this);
		this.registerCommands();
		this.addSettingTab(new SuperPinSettingTab(this.app, this));

		const ws = this.app.workspace;
		this.pins.activeLeaf = ws.getMostRecentLeaf();
		this.registerEvent(
			ws.on('active-leaf-change', (leaf) => {
				this.pins.activeLeaf = leaf;
				this.pins.checkLeaves();
			}),
		);

		ws.onLayoutReady(async () => {
			await this.pins.restoreAll(false);
			this.registerEvent(ws.on('layout-change', () => this.pins.checkLeaves()));
			this.registerEvent(
				this.app.vault.on('rename', (file, oldPath) => {
					if (file instanceof TFile) void this.pins.onRename(file, oldPath);
				}),
			);
			this.registerEvent(this.app.vault.on('delete', (file) => void this.pins.onDelete(file.path)));
		});
	}

	onunload() {
		// Patches are removed automatically via `register`; leaves are left where the user put them.
		this.pins?.releaseAll();
	}

	private registerCommands() {
		this.addCommand({
			id: 'pin-current-note',
			name: 'Pin current note to right sidebar',
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!file || this.pins.isPinned(file.path)) return false;
				if (!checking) void this.pins.pin(file);
				return true;
			},
		});

		this.addCommand({
			id: 'unpin-current-note',
			name: 'Unpin current note',
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!file || !this.pins.isPinned(file.path)) return false;
				if (!checking) void this.pins.unpin(file.path);
				return true;
			},
		});

		this.addCommand({
			id: 'toggle-reading-view',
			name: 'Toggle reading view enforcement for current pin',
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				const entry = file ? this.settings.pins.find((p) => p.path === file.path) : undefined;
				if (!entry) return false;
				if (!checking) void this.toggleReading(entry);
				return true;
			},
		});

		this.addCommand({
			id: 'pick-note-to-pin',
			name: 'Pick a note to pin',
			callback: () => this.openPinPicker(),
		});

		this.addCommand({
			id: 'restore-pins',
			name: 'Restore all pins',
			callback: () => void this.pins.restoreAll(true),
		});
	}

	async toggleReading(entry: PinEntry) {
		entry.readingMode = this.pins.isEnforced(entry) ? 'off' : 'on';
		await this.saveSettings();
		this.pins.enforceAll();
	}

	openPinPicker(onPinned?: () => void) {
		new PinPickerModal(this, onPinned).open();
	}

	async loadSettings() {
		const data = (await this.loadData()) as Partial<SuperPinSettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...data, pins: data?.pins ?? [] };
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class PinPickerModal extends FuzzySuggestModal<TFile> {
	constructor(
		private plugin: SuperPinPlugin,
		private onPinned?: () => void,
	) {
		super(plugin.app);
		this.setPlaceholder('Choose a note to pin to the right sidebar');
	}

	getItems(): TFile[] {
		return this.app.vault.getFiles().filter((file) => !this.plugin.pins.isPinned(file.path));
	}

	getItemText(file: TFile): string {
		return file.path;
	}

	onChooseItem(file: TFile): void {
		void this.plugin.pins.pin(file).then(() => this.onPinned?.());
	}
}
