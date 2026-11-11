import type { Router } from 'express';
import { SettingsReader } from './application/services/settingsReader.js';
import {
  ListSettingsUseCase,
  ResetSettingUseCase,
  UpdateSettingsUseCase,
} from './application/usecases/settings.usecases.js';
import { SETTINGS } from './domain/settings.registry.js';
import { MongoSettingRepository } from './infrastructure/mongoSetting.adapter.js';
import {
  makeListSettings,
  makeResetSetting,
  makeUpdateSettings,
} from './interface/settings.controller.js';
import { buildSettingsRouter } from './interface/settings.route.js';
import type { SettingsPublicContract } from './settings.public.js';

export interface SettingsContainer {
  contract: SettingsPublicContract;
  buildRouter: () => Router;
}

export function buildSettingsContainer(): SettingsContainer {
  const repo = new MongoSettingRepository();
  const reader = new SettingsReader(repo, SETTINGS);
  const list = new ListSettingsUseCase(reader, SETTINGS);

  return {
    contract: { get: (key) => reader.get(key) },
    buildRouter: () =>
      buildSettingsRouter({
        list: makeListSettings(list),
        update: makeUpdateSettings(new UpdateSettingsUseCase(repo, reader, SETTINGS, list)),
        reset: makeResetSetting(new ResetSettingUseCase(repo, reader, list)),
      }),
  };
}
