import { Menu, TAbstractFile, TFile, WorkspaceLeaf } from 'obsidian';
import type SuperPinPlugin from './main';

/** Adds the pin / unpin item, plus the reading view toggle for pinned tabs. */
function addPinItems(plugin: SuperPinPlugin, menu: Menu, file: TFile, leaf?: WorkspaceLeaf | null): void {
	const pins = plugin.pins;
	const pinned = pins.isPinned(file.path);

	menu.addItem((item) => {
		item.setSection('pin');
		if (pinned) {
			item.setTitle('Remove pin from right sidebar')
				.setIcon('pin-off')
				.onClick(() => void pins.unpin(file.path));
		} else {
			item.setTitle('Pin to right sidebar')
				.setIcon('pin')
				.onClick(() => void pins.pin(file));
		}
	});

	const entry = leaf && pins.isGuarded(leaf) ? pins.entryFor(leaf) : undefined;
	if (entry) {
		menu.addItem((item) =>
			item
				.setSection('pin')
				.setTitle('Enforce reading view')
				.setIcon('book-open')
				.setChecked(pins.isEnforced(entry))
				.onClick(() => void plugin.toggleReading(entry)),
		);
	}
}

/** Pin and unpin from the file explorer, tab header and "More options" menus. */
export function registerMenus(plugin: SuperPinPlugin): void {
	plugin.registerEvent(
		plugin.app.workspace.on('file-menu', (menu: Menu, file: TAbstractFile, _source: string, leaf?: WorkspaceLeaf) => {
			if (file instanceof TFile) addPinItems(plugin, menu, file, leaf);
		}),
	);
}
