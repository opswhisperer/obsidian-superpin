import { App, PluginSettingTab, SettingDefinitionItem } from 'obsidian';
import type SuperPinPlugin from './main';

export type ReadingMode = 'default' | 'on' | 'off';

export interface PinEntry {
	/** Vault path of the pinned file. */
	path: string;
	/** Whether this pin enforces reading view. `default` follows the global setting. */
	readingMode: ReadingMode;
	/** Internal workspace leaf id, used to re-attach to the same tab after a restart. */
	leafId?: string;
}

export interface SuperPinSettings {
	pins: PinEntry[];
	enforceReadingDefault: boolean;
	restoreOnStartup: boolean;
	closeTabUnpins: boolean;
}

export const DEFAULT_SETTINGS: SuperPinSettings = {
	pins: [],
	enforceReadingDefault: true,
	restoreOnStartup: true,
	closeTabUnpins: true,
};

export class SuperPinSettingTab extends PluginSettingTab {
	plugin: SuperPinPlugin;

	constructor(app: App, plugin: SuperPinPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	private static readonly READING_OPTIONS: Record<string, string> = {
		default: 'Reading view: default',
		on: 'Reading view: always',
		off: 'Reading view: off',
	};

	/** Declarative settings for Obsidian 1.13+, which also makes them searchable. */
	getSettingDefinitions(): SettingDefinitionItem[] {
		const pins = this.plugin.settings.pins;
		return [
			{
				name: 'Enforce reading view by default',
				desc: 'Pinned notes switch back to reading view whenever they are put into editing view. Each pin can override this below.',
				control: { type: 'toggle', key: 'enforceReadingDefault' },
			},
			{
				name: 'Closing a tab removes the pin',
				desc: 'When off, closing a pinned tab reopens it in the right sidebar. Use the unpin command to remove it instead.',
				control: { type: 'toggle', key: 'closeTabUnpins' },
			},
			{
				name: 'Restore pins on startup',
				desc: 'Reopen any pinned notes whose tabs are missing when the app starts.',
				control: { type: 'toggle', key: 'restoreOnStartup' },
			},
			{
				type: 'list',
				heading: 'Pinned notes',
				emptyState: 'No notes are pinned yet.',
				items: pins.map((entry) => ({
					name: entry.path,
					control: { type: 'dropdown', key: `pin:${entry.path}`, options: SuperPinSettingTab.READING_OPTIONS },
				})),
				onDelete: (index: number) => {
					const entry = pins[index];
					if (entry) void this.plugin.pins.unpin(entry.path).then(() => this.update());
				},
				addItem: {
					name: 'Add note',
					action: () => this.plugin.openPinPicker(() => this.update()),
				},
			},
		];
	}

	getControlValue(key: string): unknown {
		if (key.startsWith('pin:')) return this.findPin(key)?.readingMode;
		return super.getControlValue(key);
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		if (key.startsWith('pin:')) {
			const entry = this.findPin(key);
			if (entry) entry.readingMode = value as ReadingMode;
			await this.plugin.saveSettings();
		} else {
			await super.setControlValue(key, value);
		}
		this.plugin.pins.enforceAll();
	}

	private findPin(key: string): PinEntry | undefined {
		const path = key.slice('pin:'.length);
		return this.plugin.settings.pins.find((p) => p.path === path);
	}
}
