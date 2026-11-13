import type { Router } from 'express';
import type { IdentityPublicContract } from '@/modules/identity/identity.public.js';
import {
  CreateStockItemUseCase,
  ListMovementsUseCase,
  ListStockItemsUseCase,
  RecordMovementUseCase,
  StockSummaryUseCase,
  UpdateStockItemUseCase,
} from './application/usecases/stocks.usecases.js';
import { IdentityUserDirectory } from './infrastructure/gateways.adapter.js';
import { MongoStockRepository } from './infrastructure/mongoStock.adapter.js';
import * as c from './interface/stocks.controller.js';
import { buildStocksRouter } from './interface/stocks.route.js';
import type { StocksPublicContract } from './stocks.public.js';

export interface StocksContainer {
  contract: StocksPublicContract;
  /** Mounted at `/api/stocks`. */
  buildRouter: () => Router;
}

export interface StocksDeps {
  identity: IdentityPublicContract;
}

export function buildStocksContainer(deps: StocksDeps): StocksContainer {
  const repo = new MongoStockRepository();
  const directory = new IdentityUserDirectory(deps.identity);
  const now = () => new Date();

  return {
    contract: {},
    buildRouter: () =>
      buildStocksRouter({
        list: c.makeList(new ListStockItemsUseCase(repo)),
        create: c.makeCreate(new CreateStockItemUseCase(repo, now)),
        update: c.makeUpdate(new UpdateStockItemUseCase(repo)),
        record: c.makeRecord(new RecordMovementUseCase(repo, directory, now)),
        movements: c.makeMovements(new ListMovementsUseCase(repo, directory)),
        summary: c.makeSummary(new StockSummaryUseCase(repo)),
      }),
  };
}
